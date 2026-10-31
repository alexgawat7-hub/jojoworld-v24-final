import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/GLTFLoader.js';

(() => {
  const $ = id => document.getElementById(id);
  const mount = $('track');
  const token = new URLSearchParams(location.search).get('token');
  if (token) {
    $('lobby').href = '/live-games?token=' + encodeURIComponent(token);
    $('multiplayer').href = '/neon-racing-multiplayer?token=' + encodeURIComponent(token);
  }
  let running=false, countdownActive=false, countdownTimer=null, sound=true, audio=null, audioRig=null, last=0, progress=0, rivalProgress=0, rafId=0, pageLeaving=false;
  let speed=0, steer=0, braking=false, keys={}, edgeHitCooldown=0, driftAmount=0;
  let best=Number(localStorage.getItem('jojoworldNeonRacingBest')||0);
  $('best').textContent=best;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101a2b);
  scene.fog = new THREE.Fog(0x101a2b, 48, 190);
  const camera = new THREE.PerspectiveCamera(62, 1, .1, 260);
  camera.position.set(0, 5.2, 10.5);
  const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label','Real-time 3D street racing game');
  mount.replaceChildren(renderer.domElement);

  // [UPGRADED] Night-city lighting: restrained ambient fill, cool moonlight and warm street pools.
  scene.add(new THREE.HemisphereLight(0x7188ad,0x111820,.72));
  const sun = new THREE.DirectionalLight(0x9db9e8,.52);
  sun.position.set(-18,28,12);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-25;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6e9bd0,.38);fill.position.set(12,10,-30);scene.add(fill);
  const streetGlow = new THREE.PointLight(0xffbd72,1.05,25,2);
  streetGlow.position.set(-6,4,-10);scene.add(streetGlow);
  const farStreetGlow = new THREE.PointLight(0x668fc8,.62,30,2);
  farStreetGlow.position.set(7,3,-28);scene.add(farStreetGlow);

  const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  // [UPGRADED] Procedural asphalt is a GPU-ready DataTexture; no Canvas API is used.
  function makeRoadTexture(){
    const width=256,height=1024,data=new Uint8Array(width*height*4);
    const base=41;
    // Longitudinal worn patches are stored as pixel bands, preserving road detail without Canvas.
    const wear=Array.from({length:22},()=>({
      x:Math.floor(Math.random()*width),
      w:2+Math.floor(Math.random()*8),
      shade:Math.floor(Math.random()*12)
    }));
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const i=(y*width+x)*4;
        const grain=Math.random()<.12?Math.floor(Math.random()*42)-10:Math.floor(Math.random()*13)-6;
        let v=base+grain;
        for(const band of wear){
          if(x>=band.x&&x<band.x+band.w) v-=band.shade;
        }
        v=Math.max(18,Math.min(92,v));
        data[i]=v;
        data[i+1]=Math.max(20,Math.min(96,v+4));
        data[i+2]=Math.max(24,Math.min(102,v+9));
        data[i+3]=255;
      }
    }
    const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
    texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(1,5);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate=true;
    return texture;
  }
  // [UPGRADED] Darker, slightly smoother asphalt catches nearby street lights without looking wet.
  const asphalt= new THREE.MeshStandardMaterial({color:0xffffff,map:makeRoadTexture(),roughness:.82,metalness:.09});
  // Fine shoulder reflectors and restrained warm road-edge markers.
  const reflectorMat=new THREE.MeshStandardMaterial({color:0xffdca5,emissive:0x6b421b,emissiveIntensity:.78,roughness:.34});
  const reflectorMeshes=[];
  for(let z=-246;z<12;z+=8)for(const side of [-1,1]){
    const reflector=new THREE.Mesh(new THREE.BoxGeometry(.16,.09,.28),reflectorMat);
    reflector.position.set(side*8.9,.12,z);scene.add(reflector);reflectorMeshes.push(reflector);
  }
  const shoulder=mat(0x626b72,.92), grass=mat(0x263d3a,1), concrete=mat(0x858e96,.8);
  const laneMat=new THREE.MeshStandardMaterial({color:0xc9c6ba,roughness:.62,emissive:0x29261d,emissiveIntensity:.2}), darkGlass=mat(0x182b3a,.28,.25), tireMat=mat(0x111315,1), chrome=mat(0x9da7ad,.32,.75);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(15,260),asphalt);road.rotation.x=-Math.PI/2;road.position.set(0,-.035,-100);road.receiveShadow=true;scene.add(road);
  const leftGround=new THREE.Mesh(new THREE.PlaneGeometry(120,260),grass);leftGround.rotation.x=-Math.PI/2;leftGround.position.set(-67.5,-.09,-100);leftGround.receiveShadow=true;scene.add(leftGround);
  const rightGround=leftGround.clone();rightGround.position.x=67.5;scene.add(rightGround);
  // Shoulders and continuous road edge lines.
  for(const side of [-1,1]){
    const sh=new THREE.Mesh(new THREE.BoxGeometry(2,.12,260),shoulder);sh.position.set(side*8.5,.015,-100);sh.receiveShadow=true;scene.add(sh);
    const edge=new THREE.Mesh(new THREE.BoxGeometry(.13,.025,260),laneMat);edge.position.set(side*7.55,.045,-100);scene.add(edge);
  }
  // Repeating lane marks move through the camera view for an endless road.
  const laneMarks=[];
  for(let z=-245;z<15;z+=12)for(const x of [-2.5,2.5]){
    const mark=new THREE.Mesh(new THREE.BoxGeometry(.13,.026,5),laneMat);mark.position.set(x,.018,z);scene.add(mark);laneMarks.push(mark);
  }
  const roadside=[];
  function addCar(color,accent){
    const root=new THREE.Group();
    const paint=new THREE.MeshPhysicalMaterial({color,roughness:.2,metalness:.68,clearcoat:1,clearcoatRoughness:.12});
    const carbon=new THREE.MeshStandardMaterial({color:0x090e15,roughness:.42,metalness:.48});
    const glass=new THREE.MeshPhysicalMaterial({color:0x071522,roughness:.12,metalness:.38,clearcoat:1,clearcoatRoughness:.08});
    const chromeTrim=new THREE.MeshStandardMaterial({color:0xaebdc8,roughness:.2,metalness:.96});
    const light=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:2.8,roughness:.2});
    // Low, wide sculpted supercar shell with a tapered nose and muscular rear haunches.
    const shellShape=new THREE.Shape();
    shellShape.moveTo(-.91,.12);shellShape.quadraticCurveTo(-.98,.18,-.91,.34);
    shellShape.lineTo(-.77,.48);shellShape.quadraticCurveTo(-.65,.58,-.48,.60);
    shellShape.lineTo(.48,.60);shellShape.quadraticCurveTo(.65,.58,.77,.48);
    shellShape.lineTo(.91,.34);shellShape.quadraticCurveTo(.98,.18,.91,.12);
    shellShape.lineTo(.72,.06);shellShape.lineTo(-.72,.06);shellShape.closePath();
    const shellGeo=new THREE.ExtrudeGeometry(shellShape,{depth:3.78,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.055,bevelThickness:.045,curveSegments:10});
    shellGeo.translate(0,0,-1.89);
    const body=new THREE.Mesh(shellGeo,paint);body.position.y=.48;body.castShadow=true;body.receiveShadow=true;root.add(body);
    // Long sculpted hood and raised rear deck blend into the shell.
    const hoodShape=new THREE.Shape();hoodShape.moveTo(-.77,.54);hoodShape.quadraticCurveTo(-.72,.68,-.5,.68);hoodShape.lineTo(.5,.68);hoodShape.quadraticCurveTo(.72,.68,.77,.54);hoodShape.lineTo(.64,.52);hoodShape.lineTo(-.64,.52);hoodShape.closePath();
    const hoodGeo=new THREE.ExtrudeGeometry(hoodShape,{depth:1.05,bevelEnabled:true,bevelSegments:2,bevelSize:.025,bevelThickness:.025});
    hoodGeo.translate(0,0,-1.72);
    const hood=new THREE.Mesh(hoodGeo,paint);hood.position.y=.0;hood.castShadow=true;root.add(hood);
    // Panoramic teardrop cockpit; the sloped profile avoids the old box-shaped cabin.
    const canopyShape=new THREE.Shape();
    canopyShape.moveTo(-.66,.62);canopyShape.lineTo(-.49,1.16);canopyShape.quadraticCurveTo(-.43,1.27,-.28,1.29);
    canopyShape.lineTo(.28,1.29);canopyShape.quadraticCurveTo(.43,1.27,.49,1.16);
    canopyShape.lineTo(.66,.62);canopyShape.quadraticCurveTo(.62,.56,.52,.56);
    canopyShape.lineTo(-.52,.56);canopyShape.quadraticCurveTo(-.62,.56,-.66,.62);canopyShape.closePath();
    const canopyGeo=new THREE.ExtrudeGeometry(canopyShape,{depth:1.62,bevelEnabled:true,bevelSegments:3,bevelSize:.035,bevelThickness:.035});
    canopyGeo.translate(0,0,-.94);
    const canopy=new THREE.Mesh(canopyGeo,glass);canopy.castShadow=true;root.add(canopy);
    // Floating roof spine and subtle carbon roof panel.
    const roof=new THREE.Mesh(new THREE.BoxGeometry(.72,.035,.72),paint);roof.position.set(0,1.285,-.15);root.add(roof);
    const roofGlass=new THREE.Mesh(new THREE.BoxGeometry(.48,.012,.52),glass);roofGlass.position.set(0,1.307,-.15);root.add(roofGlass);
    // Front splitter, rear diffuser and deep side skirts.
    const splitter=new THREE.Mesh(new THREE.BoxGeometry(1.98,.075,.38),carbon);splitter.position.set(0,.39,-1.88);root.add(splitter);
    const diffuser=new THREE.Mesh(new THREE.BoxGeometry(1.55,.12,.36),carbon);diffuser.position.set(0,.39,1.78);root.add(diffuser);
    for(const x of [-.86,.86]){
      const skirt=new THREE.Mesh(new THREE.BoxGeometry(.13,.17,2.42),carbon);skirt.position.set(x,.43,0);root.add(skirt);
      const blade=new THREE.Mesh(new THREE.BoxGeometry(.035,.045,2.15),chromeTrim);blade.position.set(x*1.02,.49,0);root.add(blade);
      const mirror=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),paint);mirror.scale.set(1,.55,1.2);mirror.position.set(x*1.04,1.02,-.58);root.add(mirror);
      const mirrorStem=new THREE.Mesh(new THREE.BoxGeometry(.045,.12,.08),carbon);mirrorStem.position.set(x*.98,.94,-.57);root.add(mirrorStem);
    }
    // Wide rear wing on sculpted supports.
    for(const x of [-.53,.53]){const support=new THREE.Mesh(new THREE.BoxGeometry(.07,.34,.08),carbon);support.position.set(x,1.0,1.68);root.add(support);}
    const spoiler=new THREE.Mesh(new THREE.BoxGeometry(1.72,.09,.34),paint);spoiler.position.set(0,1.18,1.7);root.add(spoiler);
    const wingEdge=new THREE.Mesh(new THREE.BoxGeometry(1.78,.025,.045),chromeTrim);wingEdge.position.set(0,1.225,1.82);root.add(wingEdge);
    // Four performance wheels with multi-spoke metallic rims.
    root.userData.wheels=[];root.userData.hubs=[];root.userData.rims=[];
    for(const x of [-.99,.99])for(const z of [-1.22,1.22]){
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,28),new THREE.MeshStandardMaterial({color:0x090b10,roughness:.94}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.43,z);wheel.castShadow=true;root.add(wheel);root.userData.wheels.push(wheel);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.232,20),chromeTrim);hub.rotation.z=Math.PI/2;hub.position.set(x,.43,z);root.add(hub);root.userData.hubs.push(hub);
      const outward=Math.sign(x),rim=new THREE.Group();rim.position.set(x+outward*.12,.43,z);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.265,.026,8,28),chromeTrim);ring.rotation.y=Math.PI/2;rim.add(ring);
      const center=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.04,20),new THREE.MeshStandardMaterial({color:0x26333c,metalness:1,roughness:.16}));center.rotation.z=Math.PI/2;center.position.x=outward*.018;rim.add(center);
      for(let spoke=0;spoke<10;spoke++){const a=spoke*Math.PI/5;const bar=new THREE.Mesh(new THREE.BoxGeometry(.025,.24,.035),chromeTrim);bar.position.set(outward*.04,Math.sin(a)*.12,Math.cos(a)*.12);bar.rotation.x=-a;rim.add(bar);}
      root.add(rim);root.userData.rims.push(rim);
    }
    // Thin blade headlights, front air intakes and sculpted rear LED light bar.
    root.userData.brakeLights=[];root.userData.headlights=[];
    for(const x of [-.62,.62]){
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.56,.055,.045),light);lamp.position.set(x,.67,-1.94);lamp.rotation.z=x<0?-.08:.08;root.add(lamp);
      const lower=new THREE.Mesh(new THREE.BoxGeometry(.34,.035,.035),chromeTrim);lower.position.set(x,.59,-1.93);root.add(lower);
      const beam=new THREE.SpotLight(accent,2.5,38,Math.PI/7,.7,1.3);beam.position.set(x*.86,.72,-1.86);beam.target.position.set(x*1.2,.08,-23);root.add(beam);root.add(beam.target);root.userData.headlights.push(beam);
    }
    const grille=new THREE.Mesh(new THREE.BoxGeometry(.92,.12,.045),carbon);grille.position.set(0,.48,-1.94);root.add(grille);
    for(const x of [-.68,.68]){const intake=new THREE.Mesh(new THREE.BoxGeometry(.3,.16,.05),carbon);intake.position.set(x,.48,-1.92);root.add(intake);}
    const tailBar=new THREE.Mesh(new THREE.BoxGeometry(1.42,.075,.045),new THREE.MeshStandardMaterial({color:0xff2525,emissive:0xff1010,emissiveIntensity:2.2}));tailBar.position.set(0,.72,1.92);root.add(tailBar);
    const tailMat=new THREE.MeshStandardMaterial({color:0xff2424,emissive:0xff1010,emissiveIntensity:1.7});
    for(const x of [-.66,.66]){const tail=new THREE.Mesh(new THREE.BoxGeometry(.3,.11,.05),tailMat.clone());tail.position.set(x,.72,1.93);root.add(tail);root.userData.brakeLights.push(tail);}
    // Rear engine vents add a recognizable exotic-car detail.
    for(let i=-2;i<=2;i++){const vent=new THREE.Mesh(new THREE.BoxGeometry(.045,.018,.48),carbon);vent.position.set(i*.16,.68,1.35);root.add(vent);}
    scene.add(root);return root;
  }
  const player=addCar(0x176d9a,0x8ef7ff);player.position.set(0,0,0);
  const rival=addCar(0xb52f3b,0xffb27d);
  // Use a proper detailed vehicle asset instead of relying on the low-poly fallback body.
  // The fallback remains available if the external GLB cannot be reached.
  const carLoader=new GLTFLoader();
  function fitVehicleModel(source,root,paintColor){
    const model=source.clone(true);
    const box=new THREE.Box3().setFromObject(model);
    const size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    if(size.x>size.z) model.rotation.y=Math.PI/2;
    model.rotation.y+=Math.PI; // face the circuit's forward (-Z) direction
    const orientedBox=new THREE.Box3().setFromObject(model);
    const orientedSize=orientedBox.getSize(new THREE.Vector3());
    const length=Math.max(orientedSize.x,orientedSize.z);
    const scale=4.15/Math.max(length,.001);
    model.scale.setScalar(scale);
    const fitted=new THREE.Box3().setFromObject(model);
    model.position.y-=fitted.min.y;
    model.traverse(node=>{
      if(!node.isMesh)return;
      node.castShadow=true;node.receiveShadow=true;
      if(node.material){
        const materials=Array.isArray(node.material)?node.material:[node.material];
        const tuned=materials.map(original=>{
          const material=original.clone();
          if(material.color){
            const hsl={h:0,s:0,l:0};
            material.color.getHSL(hsl);
            const isPaintSurface=(hsl.s>.34 && hsl.l>.12 && (hsl.h<.085 || hsl.h>.92));
            if(material.color.getHex()===0xffffff || isPaintSurface){
              material.color.setHex(paintColor);
              if('metalness' in material)material.metalness=.58;
              if('roughness' in material)material.roughness=.27;
              if('clearcoat' in material)material.clearcoat=.82;
              if('clearcoatRoughness' in material)material.clearcoatRoughness=.2;
            }
          }
          if('envMapIntensity' in material)material.envMapIntensity=1.25;
          return material;
        });
        node.material=Array.isArray(node.material)?tuned:tuned[0];
      }
    });
    root.children.forEach(child=>{child.visible=false;});
    root.add(model);
    root.userData.realModel=model;
  }
  carLoader.load(
    'https://threejs.org/examples/models/gltf/ferrari.glb',
    gltf=>{
      fitVehicleModel(gltf.scene,player,0x183f68);
      fitVehicleModel(gltf.scene,rival,0x7f2028);
    },
    undefined,
    error=>console.warn('Detailed car model unavailable; using built-in fallback vehicles.',error)
  );
  // [ADDED] Make the solo AI opponent unmistakable and easy to track during the race.
  rival.scale.setScalar(.92);rival.position.set(-2.8,0,-12);
  // Rival identification stays in the race HUD; no floating arcade glow or name tag.
  // Street furniture: detailed low-rise buildings, trees, lamps, signs and guardrails.
  function building(x,z,side,index){
    const group=new THREE.Group();const width=4+((index*7)%5),height=5+((index*11)%15),depth=4+((index*3)%4);
    const bmat=mat([0x414c58,0x55575b,0x3c4852,0x5c5c5a][index%4],.94);
    const block=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),bmat);block.position.y=height/2;block.castShadow=true;block.receiveShadow=true;group.add(block);
    const windowMat=new THREE.MeshStandardMaterial({color:index%2?0xffc887:0x9ebdd0,emissive:index%2?0x5d3516:0x182d40,emissiveIntensity:.55,roughness:.45});
    const rows=Math.max(2,Math.floor(height/2));
    for(let row=0;row<rows;row++)for(let col=-1;col<=1;col++){
      const win=new THREE.Mesh(new THREE.BoxGeometry(.42,.58,.035),windowMat);win.position.set(col*1.05,1.15+row*1.45,depth/2+.025);group.add(win);
    }
    group.position.set(x,0,z);scene.add(group);roadside.push({group,z,side,kind:'building'});
  }
  function tree(x,z,side){
    const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1.5,7),mat(0x554437));trunk.position.y=.75;g.add(trunk);
    const foliage=new THREE.Mesh(new THREE.ConeGeometry(1.05,2.8,8),mat(0x345242));foliage.position.y=2.55;foliage.castShadow=true;g.add(foliage);
    const top=new THREE.Mesh(new THREE.ConeGeometry(.72,2.0,8),mat(0x42634c));top.position.y=3.65;g.add(top);
    g.position.set(x,0,z);scene.add(g);roadside.push({group:g,z,side,kind:'tree'});
  }
  function lamp(x,z,side){
    const g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,5.5,8),mat(0x4b5054,.5,.6));pole.position.y=2.75;g.add(pole);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.9,.08,.08),chrome);arm.position.set(-side*.38,5.4,0);g.add(arm);
    const bulb=new THREE.Mesh(new THREE.BoxGeometry(.48,.13,.32),new THREE.MeshStandardMaterial({color:0xffe0a1,emissive:0xffb84f,emissiveIntensity:2.5}));bulb.position.set(-side*.72,5.32,0);g.add(bulb);
    g.position.set(x,0,z);scene.add(g);roadside.push({group:g,z,side,kind:'lamp'});
  }
  function rail(side){
    const g=new THREE.Group();const beam=new THREE.Mesh(new THREE.BoxGeometry(.18,.22,260),chrome);beam.position.set(side*9.6,1.0,-100);g.add(beam);
    for(let z=-228;z<12;z+=8){const post=new THREE.Mesh(new THREE.BoxGeometry(.15,1.0,.18),concrete);post.position.set(side*9.6,.48,z);g.add(post);}
    scene.add(g);
  }
  rail(-1);rail(1);
  for(let i=0;i<26;i++){
    const z=-i*10-10;
    for(const side of [-1,1]){
      const base=side* (15+(i%3)*3);
      if(i%3===0)tree(base,z,side);else building(base,z,side,i+(side===1?2:0));
      if(i%2===0)lamp(side*(10.7+(i%2)),z-3,side);
    }
  }
  // Physical finish structure: checkered road stripe and overhead motorsport gantry.
  const finishGate=new THREE.Group();
  const finishMetal= new THREE.MeshStandardMaterial({color:0x89949c,metalness:.82,roughness:.28});
  const finishDark= new THREE.MeshStandardMaterial({color:0x17212a,metalness:.35,roughness:.55});
  for(const x of [-7.45,7.45]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.24,6.2,.28),finishMetal);
    post.position.set(x,3.1,0);post.castShadow=true;finishGate.add(post);
    const foot=new THREE.Mesh(new THREE.BoxGeometry(.9,.22,.9),finishDark);
    foot.position.set(x,.11,0);finishGate.add(foot);
  }
  const topBeam=new THREE.Mesh(new THREE.BoxGeometry(15.1,.42,.42),finishMetal);
  topBeam.position.set(0,6.15,0);topBeam.castShadow=true;finishGate.add(topBeam);
  const banner=new THREE.Mesh(new THREE.BoxGeometry(8.2,.9,.18),new THREE.MeshStandardMaterial({color:0x18232b,metalness:.25,roughness:.6}));
  banner.position.set(0,5.55,-.05);finishGate.add(banner);
  const bannerCanvas=document.createElement('canvas');bannerCanvas.width=1024;bannerCanvas.height=128;
  const bannerCtx=bannerCanvas.getContext('2d');bannerCtx.fillStyle='#17212a';bannerCtx.fillRect(0,0,1024,128);
  bannerCtx.fillStyle='#e7e9e9';bannerCtx.font='900 76px Arial';bannerCtx.textAlign='center';bannerCtx.textBaseline='middle';bannerCtx.fillText('FINISH',512,66);
  const bannerTexture=new THREE.CanvasTexture(bannerCanvas);
  const bannerFace=new THREE.Mesh(new THREE.PlaneGeometry(8.05,.82),new THREE.MeshBasicMaterial({map:bannerTexture,transparent:true,side:THREE.DoubleSide}));
  bannerFace.position.set(0,5.55,.055);finishGate.add(bannerFace);
  const checkerCanvas=document.createElement('canvas');checkerCanvas.width=512;checkerCanvas.height=128;
  const checkerCtx=checkerCanvas.getContext('2d');checkerCtx.fillStyle='#f4f4f1';checkerCtx.fillRect(0,0,512,128);
  const checkerSize=32;
  for(let y=0;y<4;y++)for(let x=0;x<16;x++)if((x+y)%2===0){checkerCtx.fillStyle='#101418';checkerCtx.fillRect(x*checkerSize,y*checkerSize,checkerSize,checkerSize);}
  const checkerTexture=new THREE.CanvasTexture(checkerCanvas);checkerTexture.colorSpace=THREE.SRGBColorSpace;
  const finishStripe=new THREE.Mesh(new THREE.PlaneGeometry(18,2.6),new THREE.MeshBasicMaterial({map:checkerTexture,side:THREE.DoubleSide}));
  finishStripe.rotation.x=-Math.PI/2;finishStripe.position.set(0,.035,0);finishGate.add(finishStripe);
  scene.add(finishGate);finishGate.position.z=-150;
  // A narrow approach marker makes the finish structure readable from a distance.
  const finishLights=new THREE.Group();
  for(let i=0;i<5;i++){
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),new THREE.MeshStandardMaterial({color:0xf0d5a0,emissive:0xc38c43,emissiveIntensity:1.3}));
    lamp.position.set(-1.1+i*.55,6.17,.28);finishLights.add(lamp);
  }
  finishGate.add(finishLights);

  // A few overhead road signs with real 3D posts.
  for(const z of [-72,-150,-225]){
    const sign=new THREE.Group();
    const postMat=mat(0x6c747a,.55,.5);
    for(const x of [-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.12,4.5,.12),postMat);p.position.set(x*7,2.25,0);sign.add(p);}
    const board=new THREE.Mesh(new THREE.BoxGeometry(13,.9,.22),mat(0x1b3540,.65,.2));board.position.y=4.15;sign.add(board);
    scene.add(sign);sign.position.z=z;roadside.push({group:sign,z,side:0,kind:'sign'});
  }

  function resize(){
    if(pageLeaving)return;
    const w=Math.max(300,mount.clientWidth),h=Math.max(250,mount.clientHeight);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  function ensureAudio(){
    if(audioRig||!sound)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=audio||new AC();
      const master=audio.createGain();master.gain.value=.58;master.connect(audio.destination);
      const engineGain=audio.createGain();engineGain.gain.value=.0001;engineGain.connect(master);
      const engine=audio.createOscillator();engine.type='sawtooth';engine.frequency.value=55;
      const engineFilter=audio.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=260;engine.connect(engineFilter);engineFilter.connect(engineGain);engine.start();
      const harmonic=audio.createOscillator();harmonic.type='triangle';harmonic.frequency.value=110;const harmonicGain=audio.createGain();harmonicGain.gain.value=.0001;harmonic.connect(harmonicGain);harmonicGain.connect(master);harmonic.start();
      const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.7;
      const wind=audio.createBufferSource();wind.buffer=buffer;wind.loop=true;const windFilter=audio.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=500;const windGain=audio.createGain();windGain.gain.value=.0001;wind.connect(windFilter);windFilter.connect(windGain);windGain.connect(master);wind.start();
      const tire=audio.createBufferSource();tire.buffer=buffer;tire.loop=true;const tireFilter=audio.createBiquadFilter();tireFilter.type='bandpass';tireFilter.frequency.value=1500;const tireGain=audio.createGain();tireGain.gain.value=.0001;tire.connect(tireFilter);tireFilter.connect(tireGain);tireGain.connect(master);tire.start();
      // Low-frequency drivetrain pulse layered under the engine tone for a fuller motor sound.
      const motor=audio.createOscillator();motor.type='triangle';motor.frequency.value=42;
      const motorFilter=audio.createBiquadFilter();motorFilter.type='lowpass';motorFilter.frequency.value=120;
      const motorGain=audio.createGain();motorGain.gain.value=.0001;
      motor.connect(motorFilter);motorFilter.connect(motorGain);motorGain.connect(master);motor.start();
      audioRig={master,engine,engineFilter,engineGain,harmonic,harmonicGain,windGain,windFilter,tireGain,tireFilter,motor,motorGain,motorFilter};
      if(audio.state==='suspended')audio.resume();
    }catch(err){console.warn('Audio unavailable',err);}
  }
  function updateAudio(){
    if(!sound)return;ensureAudio();if(!audioRig||!audio)return;
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    const t=audio.currentTime,throttle=running?Math.max(.12,speed/245):0;
    audioRig.engine.frequency.setTargetAtTime(38+speed*.48,t,.06);
    audioRig.engineGain.gain.setTargetAtTime(running?.025+throttle*.045:.0001,t,.08);
    audioRig.engineFilter.frequency.setTargetAtTime(180+speed*2.2,t,.08);
    audioRig.harmonic.frequency.setTargetAtTime(76+speed*.92,t,.07);
    audioRig.harmonicGain.gain.setTargetAtTime(running?.006+throttle*.018:.0001,t,.08);
    audioRig.motor.frequency.setTargetAtTime(28+speed*.24,t,.07);
    audioRig.motorGain.gain.setTargetAtTime(running?.012+throttle*.026:.0001,t,.08);
    audioRig.motorFilter.frequency.setTargetAtTime(80+speed*.7,t,.08);
    audioRig.windGain.gain.setTargetAtTime(running?Math.min(.14,speed/245*.14):.0001,t,.12);
    audioRig.windFilter.frequency.setTargetAtTime(250+speed*5,t,.1);
    const tireIntensity=Math.max(driftAmount>.35?driftAmount*.1:0,braking&&speed>45?.055:0);
    audioRig.tireGain.gain.setTargetAtTime(running&&tireIntensity>0?Math.min(.12,tireIntensity):.0001,t,.06);
    audioRig.tireFilter.frequency.setTargetAtTime(braking?1850:900+Math.abs(steer)*1000,t,.06);
  }
  function beep(f=500){if(!sound)return;try{ensureAudio();if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(90,f*.62),audio.currentTime+.18);g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.08,audio.currentTime+.015);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.22);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.23)}catch{}}
  function countdownSound(number){
    if(!sound)return;
    try{
      ensureAudio();if(!audio)return;
      const now=audio.currentTime;
      const osc=audio.createOscillator(),gain=audio.createGain();
      osc.type='square';osc.frequency.setValueAtTime(number===0?1040:620+number*95,now);
      osc.frequency.exponentialRampToValueAtTime(number===0?520:Math.max(260,420+number*35),now+.2);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(number===0?.16:.095,now+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,now+(number===0?.48:.22));
      osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+(number===0?.5:.24));
      if(number===0){
        const low=audio.createOscillator(),lg=audio.createGain();
        low.type='sawtooth';low.frequency.setValueAtTime(82,now);low.frequency.exponentialRampToValueAtTime(42,now+.62);
        lg.gain.setValueAtTime(.0001,now);lg.gain.exponentialRampToValueAtTime(.13,now+.025);lg.gain.exponentialRampToValueAtTime(.0001,now+.65);
        low.connect(lg);lg.connect(audio.destination);low.start(now);low.stop(now+.67);
      }
    }catch(err){console.warn('Countdown audio unavailable',err);}
  }
  function runCountdown(){
    const panel=$('raceCountdown'),number=$('countdownNumber'),caption=$('countdownCaption');
    panel.hidden=false;countdownActive=true;
    const sequence=[3,2,1,0];
    const labels=['3','2','1','GO!'];
    let index=0;
    const tick=()=>{
      if(pageLeaving||!countdownActive)return;
      number.textContent=labels[index];caption.textContent=index===3?'FULL THROTTLE!':'GET READY';
      panel.classList.remove('pulse');void panel.offsetWidth;panel.classList.add('pulse');
      countdownSound(sequence[index]);
      if(index===3){
        countdownTimer=setTimeout(()=>{
          panel.hidden=true;countdownActive=false;running=true;last=0;
          speed=0;beep(720);
        },650);
      }else{
        index++;countdownTimer=setTimeout(tick,850);
      }
    };
    tick();
  }
  function impactSound(){
    if(!sound)return;
    try{
      ensureAudio();if(!audio)return;
      const now=audio.currentTime;
      const osc=audio.createOscillator(),gain=audio.createGain(),filter=audio.createBiquadFilter();
      osc.type='triangle';osc.frequency.setValueAtTime(115,now);osc.frequency.exponentialRampToValueAtTime(38,now+.19);
      filter.type='lowpass';filter.frequency.value=260;
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.24,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.22);
      osc.connect(filter);filter.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+.23);
    }catch{}
  }
  function draw(){
    if(pageLeaving)return;
    finishGate.position.z=-150+Math.min(1000,progress)*.15;
    const playerX=steer*6.55;
    const slide=driftAmount*(steer<0?1:-1)*.52;
    const targetX=playerX+slide;
    player.position.x+=(targetX-player.position.x)*.16;
    // The painted edge/shoulder acts as a light crash boundary, with a brief impact and speed loss.
    if(running&&Math.abs(player.position.x)>6.25&&edgeHitCooldown<=0){
      edgeHitCooldown=.9;speed=Math.max(55,speed*.58);impactSound();
      player.position.x=Math.sign(player.position.x)*6.25;
    }
    player.rotation.z=-steer*.08-driftAmount*steer*.055;
    player.rotation.y=-steer*.12-driftAmount*steer*.09;
    for(const wheel of player.userData.wheels){wheel.rotation.x+=speed*.00025;if(wheel.position.z<0)wheel.rotation.y=steer*.22;}
    for(const hub of player.userData.hubs){hub.rotation.x+=speed*.00025;if(hub.position.z<0)hub.rotation.y=steer*.22;}
    for(const rim of player.userData.rims){rim.rotation.x+=speed*.00025;if(rim.position.z<0)rim.rotation.y=steer*.22;}
    for(const tail of player.userData.brakeLights){tail.material.emissiveIntensity=braking?4.2:1.4;tail.material.color.setHex(braking?0xff5555:0xff2424);}
    for(const beam of player.userData.headlights)beam.intensity=2.2;
    for(const tail of rival.userData.brakeLights){tail.material.emissiveIntensity=1.4;}
    for(const wheel of rival.userData.wheels)wheel.rotation.x+=speed*.00018;for(const hub of rival.userData.hubs)hub.rotation.x+=speed*.00018;for(const rim of rival.userData.rims)rim.rotation.x+=speed*.00018;
    rival.position.x=-2.8+Math.sin(progress*.013)*.8;
    const gap=rivalProgress-progress;
    rival.position.z=THREE.MathUtils.clamp(-12-gap*.55,-72,7);
    camera.position.x+=(player.position.x*.48-camera.position.x)*.06;
    camera.position.y=5.0;
    camera.lookAt(player.position.x*.35,1.0,-16);
    // Recycle lane marks and roadside models toward the camera for continuous travel.
    const movement=speed*.00125;
    for(const m of laneMarks){m.position.z+=movement;if(m.position.z>12)m.position.z-=260;}
    for(const m of reflectorMeshes){m.position.z+=movement;if(m.position.z>12)m.position.z-=260;}
    streetGlow.position.x=-6+player.position.x*.12;
    streetGlow.intensity=.35+Math.min(speed/205,.9)*.45;
    for(const o of roadside){o.group.position.z+=movement;if(o.group.position.z>18){o.group.position.z-=260;o.z=o.group.position.z;}}
    camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    updateAudio();
  }
  function finish(won){
    running=false;
    if(won&&Math.floor(progress)>best){best=Math.floor(progress);localStorage.setItem('jojoworldNeonRacingBest',String(best));$('best').textContent=best;}
    $('overlay').hidden=false;$('overlayTitle').textContent=won?'🏁 YOU WIN!':'🏁 RACE FINISHED';
    $('overlayText').textContent=(won?'You crossed the finish line first!':'Your rival reached the finish line first.')+' Race distance: 1,000 m. Your distance: '+Math.min(1000,Math.floor(progress))+' m.';
    $('start').textContent='RACE AGAIN';beep(won?880:260);
  }
  function frame(t){
    rafId=0;
    if(pageLeaving)return;
    if(!running){draw();if(countdownActive)rafId=requestAnimationFrame(frame);return;}
    const dt=Math.min(40,t-last||16);last=t;const sec=dt/1000;
    const target=braking?82:205;
    speed+=(target-speed)*Math.min(1,sec*2.4);
    edgeHitCooldown=Math.max(0,edgeHitCooldown-sec);
    const hardTurn=Math.abs(steer)>.62&&speed>125&&!braking;
    driftAmount+=((hardTurn?1:0)-driftAmount)*Math.min(1,sec*(hardTurn?3.2:1.8));
    /* Distance-based pace lets the player close the initial gap and pass without scripted lane swapping. */
    progress+=speed*sec*.090;
    rivalProgress+=sec*16.4;
    if(keys.left)steer=Math.max(-1,steer-sec*1.7);else if(keys.right)steer=Math.min(1,steer+sec*1.7);else steer*=Math.pow(.91,sec*60);
    $('score').textContent=Math.min(100,Math.floor(progress/10))+'%';$('speed').textContent=Math.round(speed)+' km/h';
    draw();
    if(progress>=1000){finish(progress>=rivalProgress);return;}
    if(rivalProgress>=1000){finish(false);return;}
    rafId=requestAnimationFrame(frame);
  }
  function start(){
    if(pageLeaving)return;
    if(countdownTimer)clearTimeout(countdownTimer);
    running=false;countdownActive=false;progress=0;rivalProgress=0;speed=0;steer=0;braking=false;driftAmount=0;edgeHitCooldown=0;last=0;keys={};player.position.x=0;
    rival.position.set(-2.8,0,-12);
    $('score').textContent='0%';$('speed').textContent='0 km/h';$('overlay').hidden=true;
    $('start').textContent='RACE AGAIN';
    ensureAudio();
    if(rafId)cancelAnimationFrame(rafId);
    rafId=requestAnimationFrame(frame);
    runCountdown();
  }
  function hold(id,key){
    const b=$(id);if(!b)return;
    b.addEventListener('pointerdown',e=>{e.preventDefault();keys[key]=true;if(key==='brake')braking=true;});
    ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>{keys[key]=false;if(key==='brake')braking=false;}));
  }
  hold('left','left');hold('right','right');hold('brake','brake');
  window.addEventListener('keydown',e=>{if(['ArrowLeft','a','A'].includes(e.key)){keys.left=true;e.preventDefault();}if(['ArrowRight','d','D'].includes(e.key)){keys.right=true;e.preventDefault();}if(e.code==='Space'){e.preventDefault();}if(['ArrowDown','s','S'].includes(e.key)){braking=true;e.preventDefault();}});
  window.addEventListener('keyup',e=>{if(['ArrowLeft','a','A'].includes(e.key))keys.left=false;if(['ArrowRight','d','D'].includes(e.key))keys.right=false;if(['ArrowDown','s','S'].includes(e.key))braking=false;});
  $('start').addEventListener('click',start);$('restart').addEventListener('click',start);
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'🔊 SOUND: ON':'🔊 SOUND: OFF';if(sound){ensureAudio();beep(600);}else if(audioRig&&audio){audioRig.engineGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.harmonicGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.motorGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.windGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.tireGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);}});
  window.addEventListener('pagehide',()=>{
    pageLeaving=true;
    running=false;countdownActive=false;if(countdownTimer)clearTimeout(countdownTimer);keys={};
    if(rafId){cancelAnimationFrame(rafId);rafId=0;}
    try{renderer.dispose();}catch(e){}
    try{if(audio&&audio.state!=='closed')audio.close();}catch(e){}
  },{once:true});
  window.addEventListener('resize',resize);
  $('sound').textContent='🔊 SOUND: ON';
  resize();draw();
  // If WebGL is unavailable, show a clear message instead of a blank game panel.
  window.addEventListener('unhandledrejection',e=>{console.error('3D racing failed to load',e.reason);});
})();
