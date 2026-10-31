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
    // Fine longitudinal aggregate streaks and irregular repair patches break up the flat asphalt.
    const streaks=Array.from({length:46},()=>({
      x:Math.floor(Math.random()*width),
      w:1+Math.floor(Math.random()*3),
      shade:3+Math.floor(Math.random()*9),
      phase:Math.random()*Math.PI*2
    }));
    const patches=Array.from({length:34},()=>({
      x:Math.floor(Math.random()*width),
      y:Math.floor(Math.random()*height),
      rx:3+Math.floor(Math.random()*13),
      ry:8+Math.floor(Math.random()*34),
      shade:3+Math.floor(Math.random()*10)
    }));
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const i=(y*width+x)*4;
        const grain=Math.random()<.12?Math.floor(Math.random()*42)-10:Math.floor(Math.random()*13)-6;
        let v=base+grain;
        for(const band of wear){
          if(x>=band.x&&x<band.x+band.w) v-=band.shade;
        }
        for(const streak of streaks){
          if(x>=streak.x&&x<streak.x+streak.w){
            const fade=.55+.45*Math.sin(y*.035+streak.phase);
            v-=Math.round(streak.shade*fade);
          }
        }
        for(const patch of patches){
          const dx=(x-patch.x)/patch.rx,dy=(y-patch.y)/patch.ry;
          const distance=dx*dx+dy*dy;
          if(distance<1)v-=Math.round(patch.shade*(1-distance));
        }
        v=Math.max(16,Math.min(92,v));
        data[i]=v;
        data[i+1]=Math.max(18,Math.min(96,v+4));
        data[i+2]=Math.max(22,Math.min(102,v+9));
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
  const asphalt= new THREE.MeshStandardMaterial({color:0xffffff,map:makeRoadTexture(),roughness:.76,metalness:.12});
  // Fine shoulder reflectors and restrained warm road-edge markers.
  const reflectorMat=new THREE.MeshStandardMaterial({color:0xffdca5,emissive:0x6b421b,emissiveIntensity:.78,roughness:.34});
  const reflectorMeshes=[];
  for(let z=-246;z<12;z+=8)for(const side of [-1,1]){
    const reflector=new THREE.Mesh(new THREE.BoxGeometry(.16,.09,.28),reflectorMat);
    reflector.position.set(side*8.9,.12,z);scene.add(reflector);reflectorMeshes.push(reflector);
  }
  const shoulder=mat(0x626b72,.92), grass=mat(0x263d3a,1), concrete=mat(0x858e96,.8);
  const laneMat=new THREE.MeshStandardMaterial({color:0xd5d1c5,roughness:.48,metalness:.08,emissive:0x39372e,emissiveIntensity:.24});
  const laneEdgeMat=new THREE.MeshStandardMaterial({color:0x343a3d,roughness:.72,metalness:.12});
  const shoulderLineMat=new THREE.MeshStandardMaterial({color:0xb9c2c3,roughness:.52,metalness:.12,emissive:0x20282b,emissiveIntensity:.16});
  const darkGlass=mat(0x182b3a,.28,.25), tireMat=mat(0x111315,1), chrome=mat(0x9da7ad,.32,.75);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(15,260),asphalt);road.rotation.x=-Math.PI/2;road.position.set(0,-.035,-100);road.receiveShadow=true;scene.add(road);
  const leftGround=new THREE.Mesh(new THREE.PlaneGeometry(120,260),grass);leftGround.rotation.x=-Math.PI/2;leftGround.position.set(-67.5,-.09,-100);leftGround.receiveShadow=true;scene.add(leftGround);
  const rightGround=leftGround.clone();rightGround.position.x=67.5;scene.add(rightGround);
  // Shoulders and continuous road-edge lines with a dark inset and restrained reflective paint.
  for(const side of [-1,1]){
    const sh=new THREE.Mesh(new THREE.BoxGeometry(2,.12,260),shoulder);sh.position.set(side*8.5,.015,-100);sh.receiveShadow=true;scene.add(sh);
    const edgeBed=new THREE.Mesh(new THREE.BoxGeometry(.2,.028,260),laneEdgeMat);edgeBed.position.set(side*7.55,.043,-100);scene.add(edgeBed);
    const edge=new THREE.Mesh(new THREE.BoxGeometry(.105,.018,260),shoulderLineMat);edge.position.set(side*7.55,.064,-100);scene.add(edge);
  }
  // Repeating lane dashes use a dark painted border and a narrower reflective center.
  const laneMarks=[];
  for(let z=-245;z<15;z+=12)for(const x of [-2.5,2.5]){
    const dash=new THREE.Group();
    const border=new THREE.Mesh(new THREE.BoxGeometry(.19,.026,5.12),laneEdgeMat);border.position.y=.018;dash.add(border);
    const mark=new THREE.Mesh(new THREE.BoxGeometry(.112,.018,4.96),laneMat);mark.position.y=.04;dash.add(mark);
    dash.position.set(x,0,z);scene.add(dash);laneMarks.push(dash);
  }
  // [UPGRADED] Fine transverse shoulder rumble strips add believable road-edge texture.
  const rumbleMat=new THREE.MeshStandardMaterial({color:0x42494d,roughness:.9,metalness:.04});
  const rumbleHighlightMat=new THREE.MeshStandardMaterial({color:0x737b7e,roughness:.68,metalness:.08});
  for(const side of [-1,1]){
    for(let z=-250;z<10;z+=6.4){
      const groove=new THREE.Mesh(new THREE.BoxGeometry(.72,.012,.075),rumbleMat);
      groove.position.set(side*8.28,.083,z);scene.add(groove);
      const lip=new THREE.Mesh(new THREE.BoxGeometry(.72,.008,.022),rumbleHighlightMat);
      lip.position.set(side*8.28,.092,z-.055);scene.add(lip);
    }
  }
  const roadside=[];
  // [UPGRADED] Continuous modular city sidewalks with curb stones and subtle paving joints.
  const sidewalkMat=new THREE.MeshStandardMaterial({color:0x626b70,roughness:.94,metalness:.04});
  const curbMat=new THREE.MeshStandardMaterial({color:0x858b8e,roughness:.88,metalness:.06});
  const jointMat=new THREE.MeshStandardMaterial({color:0x343c41,roughness:1});
  for(let z=-5;z>-260;z-=10){
    for(const side of [-1,1]){
      const walk=new THREE.Group();
      const slab=new THREE.Mesh(new THREE.BoxGeometry(2.8,.16,10),sidewalkMat);
      slab.position.set(side*11.1,-.005,0);slab.receiveShadow=true;walk.add(slab);
      const curb=new THREE.Mesh(new THREE.BoxGeometry(.24,.28,10),curbMat);
      curb.position.set(side*9.68,.08,0);curb.castShadow=true;walk.add(curb);
      for(const seamZ of [-3.35,0,3.35]){
        const seam=new THREE.Mesh(new THREE.BoxGeometry(2.68,.012,.035),jointMat);
        seam.position.set(side*11.1,.078,seamZ);walk.add(seam);
      }
      walk.position.z=z;scene.add(walk);roadside.push({group:walk,z,side,kind:'sidewalk'});
    }
  }
  // [UPGRADED] Curbside storm-drain grates add subtle, believable street infrastructure.
  const drainFrameMat=new THREE.MeshStandardMaterial({color:0x424b50,metalness:.82,roughness:.48});
  const drainBarMat=new THREE.MeshStandardMaterial({color:0x20282d,metalness:.9,roughness:.38});
  for(const z of [-28,-98,-178,-248]){
    for(const side of [-1,1]){
      const drain=new THREE.Group();
      const frame=new THREE.Mesh(new THREE.BoxGeometry(.48,.055,1.28),drainFrameMat);
      frame.position.y=.025;drain.add(frame);
      const inset=new THREE.Mesh(new THREE.BoxGeometry(.39,.025,1.18),drainBarMat);
      inset.position.y=.057;drain.add(inset);
      for(let i=0;i<9;i++){
        const bar=new THREE.Mesh(new THREE.BoxGeometry(.34,.028,.045),drainFrameMat);
        bar.position.set(0,.078,-.51+i*.128);drain.add(bar);
      }
      drain.position.set(side*9.42,0,z);scene.add(drain);
      roadside.push({group:drain,z,side,kind:'storm-drain'});
    }
  }
  // [UPGRADED] Compact curbside parking meters bring another grounded downtown detail.
  const meterPoleMat=new THREE.MeshStandardMaterial({color:0x4b555c,metalness:.86,roughness:.34});
  const meterBodyMat=new THREE.MeshStandardMaterial({color:0x26343c,metalness:.58,roughness:.3});
  const meterScreenMat=new THREE.MeshStandardMaterial({color:0x9db8b7,emissive:0x29413d,emissiveIntensity:.32,roughness:.28});
  for(const z of [-52,-132,-212]){
    for(const side of [-1,1]){
      const meter=new THREE.Group();
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.08,12),meterPoleMat);
      foot.position.y=.04;meter.add(foot);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.12,10),meterPoleMat);
      pole.position.y=.62;meter.add(pole);
      const head=new THREE.Mesh(new THREE.BoxGeometry(.27,.38,.2),meterBodyMat);
      head.position.set(0,1.25,0);head.rotation.x=-.08;meter.add(head);
      const display=new THREE.Mesh(new THREE.PlaneGeometry(.16,.095),meterScreenMat);
      display.position.set(0,1.3,.104);meter.add(display);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(.31,.045,.23),meterPoleMat);
      cap.position.y=1.46;meter.add(cap);
      const slot=new THREE.Mesh(new THREE.BoxGeometry(.075,.018,.012),meterScreenMat);
      slot.position.set(0,1.16,.107);meter.add(slot);
      meter.position.set(side*12.12,0,z);scene.add(meter);
      roadside.push({group:meter,z,side,kind:'parking-meter'});
    }
  }
  function addCar(color,accent){
    const root=new THREE.Group();
    const paint=new THREE.MeshPhysicalMaterial({color,roughness:.24,metalness:.62,clearcoat:1,clearcoatRoughness:.16,ior:1.48,specularIntensity:.82,specularColor:0xd9e8f2});
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
    const headlightBezelMat=new THREE.MeshStandardMaterial({color:0x101820,metalness:.72,roughness:.3});
    const ledSignatureMat=new THREE.MeshStandardMaterial({color:0xe9f7ff,emissive:0x9bdcff,emissiveIntensity:1.35,roughness:.24,metalness:.12});
    for(const x of [-.62,.62]){
      const bezel=new THREE.Mesh(new THREE.BoxGeometry(.64,.105,.055),headlightBezelMat);bezel.position.set(x,.67,-1.925);bezel.rotation.z=x<0?-.08:.08;root.add(bezel);
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.56,.055,.045),light);lamp.position.set(x,.68,-1.965);lamp.rotation.z=x<0?-.08:.08;root.add(lamp);
      const signature=new THREE.Mesh(new THREE.BoxGeometry(.39,.018,.018),ledSignatureMat);signature.position.set(x,.605,-1.966);signature.rotation.z=x<0?-.06:.06;root.add(signature);
      const lower=new THREE.Mesh(new THREE.BoxGeometry(.34,.025,.035),chromeTrim);lower.position.set(x,.565,-1.93);root.add(lower);
      const beam=new THREE.SpotLight(accent,2.5,38,Math.PI/7,.7,1.3);beam.position.set(x*.86,.72,-1.86);beam.target.position.set(x*1.2,.08,-23);root.add(beam);root.add(beam.target);root.userData.headlights.push(beam);
    }
    const grille=new THREE.Mesh(new THREE.BoxGeometry(.92,.12,.045),carbon);grille.position.set(0,.48,-1.94);root.add(grille);
    for(const x of [-.68,.68]){const intake=new THREE.Mesh(new THREE.BoxGeometry(.3,.16,.05),carbon);intake.position.set(x,.48,-1.92);root.add(intake);}
    // [UPGRADED] Layered rear lamp housing with a continuous LED blade and hooked corner signatures.
    const rearHousingMat=new THREE.MeshStandardMaterial({color:0x10171d,metalness:.68,roughness:.34});
    const rearLedMat=new THREE.MeshStandardMaterial({color:0xff3030,emissive:0xff1010,emissiveIntensity:1.7,roughness:.24});
    const tailHousing=new THREE.Mesh(new THREE.BoxGeometry(1.58,.16,.065),rearHousingMat);tailHousing.position.set(0,.72,1.91);root.add(tailHousing);
    const tailBar=new THREE.Mesh(new THREE.BoxGeometry(1.43,.045,.025),rearLedMat.clone());tailBar.position.set(0,.75,1.952);root.add(tailBar);root.userData.brakeLights.push(tailBar);
    const tailMat=new THREE.MeshStandardMaterial({color:0xff2424,emissive:0xff1010,emissiveIntensity:1.7});
    for(const x of [-.66,.66]){
      const tail=new THREE.Mesh(new THREE.BoxGeometry(.25,.105,.028),tailMat.clone());tail.position.set(x,.72,1.955);root.add(tail);root.userData.brakeLights.push(tail);
      const hook=new THREE.Mesh(new THREE.BoxGeometry(.045,.105,.026),tailMat.clone());hook.position.set(x*1.34,.69,1.956);root.add(hook);root.userData.brakeLights.push(hook);
    }
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
            const materialName=(material.name||'').toLowerCase();
            const excludedSurface=/glass|window|windshield|tire|rubber|wheel|rim|chrome|metal|light|lamp|trim|carbon/.test(materialName);
            const namedPaint=/body|paint|exterior|car.?shell/.test(materialName);
            const isPaintSurface=!excludedSurface && (namedPaint || (hsl.s>.34 && hsl.l>.12 && (hsl.h<.085 || hsl.h>.92)));
            if(!excludedSurface && (material.color.getHex()===0xffffff || isPaintSurface)){
              material.color.setHex(paintColor);
              if('metalness' in material)material.metalness=.58;
              if('roughness' in material)material.roughness=.27;
              if('clearcoat' in material)material.clearcoat=.82;
              if('clearcoatRoughness' in material)material.clearcoatRoughness=.18;
              if('ior' in material)material.ior=1.48;
              if('specularIntensity' in material)material.specularIntensity=.82;
              if('specularColor' in material)material.specularColor.setHex(0xd9e8f2);
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
    const facadeMat=mat([0x303b48,0x41464d,0x293945,0x4a4b4b][index%4],.88);
    const trimMat=new THREE.MeshStandardMaterial({color:0x87939b,metalness:.58,roughness:.42});
    const darkMat=new THREE.MeshStandardMaterial({color:0x101923,roughness:.72,metalness:.18});
    const block=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),facadeMat);block.position.y=height/2;block.castShadow=true;block.receiveShadow=true;group.add(block);
    // Recessed-looking window bays, broken up by concrete piers for a less toy-like facade.
    const rows=Math.max(2,Math.floor((height-1.1)/1.55));
    const cols=Math.max(2,Math.floor((width-.9)/1.35));
    for(let col=0;col<=cols;col++){
      const px=-width/2+.48+col*((width-.96)/cols);
      const pier=new THREE.Mesh(new THREE.BoxGeometry(.12,height-.45,.12),trimMat);pier.position.set(px,height/2,depth/2+.045);group.add(pier);
    }
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const px=-width/2+.72+col*((width-1.44)/Math.max(1,cols-1));
      const py=1.05+row*1.48;
      const lit=((index*13+row*7+col*3)%9)<5;
      const paneMat=lit
        ? new THREE.MeshStandardMaterial({color:index%2?0xffd29a:0xa9c9df,emissive:index%2?0x68401e:0x263f58,emissiveIntensity:.72,roughness:.34,metalness:.12})
        : darkMat;
      const pane=new THREE.Mesh(new THREE.BoxGeometry(.62,.82,.045),paneMat);pane.position.set(px,py,depth/2+.075);group.add(pane);
      const sill=new THREE.Mesh(new THREE.BoxGeometry(.7,.055,.09),trimMat);sill.position.set(px,py-.45,depth/2+.095);group.add(sill);
    }
    // A restrained roof parapet and corner edges give each block a finished silhouette.
    const parapet=new THREE.Mesh(new THREE.BoxGeometry(width+.18,.22,depth+.18),trimMat);parapet.position.y=height+.08;group.add(parapet);
    for(const sx of [-1,1]){
      const edge=new THREE.Mesh(new THREE.BoxGeometry(.13,height,.13),trimMat);edge.position.set(sx*(width/2-.08),height/2,depth/2+.06);group.add(edge);
    }
    // [UPGRADED] Selective rooftop HVAC equipment adds believable commercial-district detail without extra lights.
    if(index%3===1){
      const unitMat=new THREE.MeshStandardMaterial({color:0x343d45,metalness:.62,roughness:.58});
      const unit=new THREE.Mesh(new THREE.BoxGeometry(1.35,.62,1.05),unitMat);
      unit.position.set(width*.22,height+.48,depth*.12);unit.castShadow=true;group.add(unit);
      const top=new THREE.Mesh(new THREE.BoxGeometry(1.42,.09,1.12),trimMat);
      top.position.set(width*.22,height+.83,depth*.12);group.add(top);
      const fanRing=new THREE.Mesh(new THREE.TorusGeometry(.27,.035,6,18),chrome);
      fanRing.position.set(width*.22,height+.9,depth*.12);fanRing.rotation.x=Math.PI/2;group.add(fanRing);
      for(let blade=0;blade<4;blade++){
        const vane=new THREE.Mesh(new THREE.BoxGeometry(.055,.025,.43),darkMat);
        vane.position.set(width*.22,height+.91,depth*.12);vane.rotation.y=blade*Math.PI/2;group.add(vane);
      }
      const vent=new THREE.Mesh(new THREE.BoxGeometry(.72,.22,.035),trimMat);
      vent.position.set(width*.22,height+.48,depth*.66);group.add(vent);
      const conduit=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.9,8),trimMat);
      conduit.rotation.z=Math.PI/2;conduit.position.set(width*.22,height+.24,depth*.12);group.add(conduit);
    }
    // [UPGRADED] Select buildings receive restrained street-facing shopfronts for a lived-in downtown feel.
    if(index%4===0){
      const roadward=-side;
      const shopGlass=new THREE.MeshStandardMaterial({color:0x294453,emissive:0x172b35,emissiveIntensity:.42,metalness:.22,roughness:.24});
      const signFace=new THREE.MeshStandardMaterial({color:0x39434a,emissive:index%2?0x49301b:0x253e50,emissiveIntensity:.62,metalness:.38,roughness:.38});
      const awningMat=new THREE.MeshStandardMaterial({color:index%2?0x39434a:0x343c43,metalness:.42,roughness:.5});
      const frontageX=roadward*(width/2+.055);
      const shopWindow=new THREE.Mesh(new THREE.BoxGeometry(.075,1.35,2.35),shopGlass);
      shopWindow.position.set(frontageX,1.12,-.15);group.add(shopWindow);
      const door=new THREE.Mesh(new THREE.BoxGeometry(.09,1.72,.72),darkMat);
      door.position.set(frontageX+roadward*.025,1.0,depth*.31);group.add(door);
      const doorHandle=new THREE.Mesh(new THREE.BoxGeometry(.035,.12,.035),trimMat);
      doorHandle.position.set(frontageX+roadward*.085,1.0,depth*.31-.2);group.add(doorHandle);
      const fascia=new THREE.Mesh(new THREE.BoxGeometry(.16,.48,2.65),signFace);
      fascia.position.set(frontageX+roadward*.07,2.08,-.12);group.add(fascia);
      // [UPGRADED] Real storefront lettering on a road-facing illuminated sign panel.
      const shopCanvas=document.createElement('canvas');shopCanvas.width=768;shopCanvas.height=144;
      const shopCtx=shopCanvas.getContext('2d');
      shopCtx.fillStyle='#202b33';shopCtx.fillRect(0,0,768,144);
      shopCtx.strokeStyle='#aebbc1';shopCtx.lineWidth=5;shopCtx.strokeRect(8,8,752,128);
      shopCtx.fillStyle=index%2?'#e7c99d':'#d5e2e8';
      shopCtx.font='900 66px Arial';shopCtx.textAlign='center';shopCtx.textBaseline='middle';
      shopCtx.fillText(['NIGHT CAFE','CITY MARKET','MOTOR WORKS','RIVERSIDE'][Math.floor(index/4)%4],384,73);
      const shopTexture=new THREE.CanvasTexture(shopCanvas);shopTexture.colorSpace=THREE.SRGBColorSpace;
      const shopLabelMat=new THREE.MeshBasicMaterial({map:shopTexture,side:THREE.DoubleSide});
      const shopLabel=new THREE.Mesh(new THREE.PlaneGeometry(2.48,.43),shopLabelMat);
      shopLabel.position.set(frontageX+roadward*.165,2.08,-.12);
      shopLabel.rotation.y=roadward*Math.PI/2;group.add(shopLabel);
      const awning=new THREE.Mesh(new THREE.BoxGeometry(.62,.12,2.85),awningMat);
      awning.position.set(frontageX+roadward*.31,1.76,-.12);group.add(awning);
      const awningEdge=new THREE.Mesh(new THREE.BoxGeometry(.035,.16,2.85),trimMat);
      awningEdge.position.set(frontageX+roadward*.61,1.72,-.12);group.add(awningEdge);
      const lowerTrim=new THREE.Mesh(new THREE.BoxGeometry(.12,.1,2.55),trimMat);
      lowerTrim.position.set(frontageX+roadward*.08,.39,-.12);group.add(lowerTrim);
    }
    // [UPGRADED] Selective wall-mounted CCTV cameras add subtle downtown security detail.
    if(index%3===0){
      const cameraMetal=new THREE.MeshStandardMaterial({color:0x303a42,metalness:.78,roughness:.34});
      const cameraLens=new THREE.MeshStandardMaterial({color:0x91b7c7,emissive:0x284553,emissiveIntensity:.65,metalness:.3,roughness:.2});
      const roadward=-side;
      const mount=new THREE.Mesh(new THREE.BoxGeometry(.22,.12,.18),cameraMetal);
      mount.position.set(roadward*(width*.5+.1),Math.min(height-.9,4.4),0);group.add(mount);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(.48,.07,.07),cameraMetal);
      arm.position.set(roadward*(width*.5+.3),Math.min(height-.85,4.45),0);group.add(arm);
      const housing=new THREE.Mesh(new THREE.BoxGeometry(.3,.18,.2),cameraMetal);
      housing.position.set(roadward*(width*.5+.52),Math.min(height-.8,4.4),0);housing.rotation.z=roadward*.12;group.add(housing);
      const lens=new THREE.Mesh(new THREE.CircleGeometry(.055,12),cameraLens);
      lens.position.set(roadward*(width*.5+.625),Math.min(height-.8,4.4),0);lens.rotation.y=roadward*Math.PI/2;group.add(lens);
    }
    group.position.set(x,0,z);scene.add(group);roadside.push({group,z,side,kind:'building'});
  }
  function tree(x,z,side){
    const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1.5,7),mat(0x554437));trunk.position.y=.75;g.add(trunk);
    const foliage=new THREE.Mesh(new THREE.ConeGeometry(1.05,2.8,8),mat(0x345242));foliage.position.y=2.55;foliage.castShadow=true;g.add(foliage);
    const top=new THREE.Mesh(new THREE.ConeGeometry(.72,2.0,8),mat(0x42634c));top.position.y=3.65;g.add(top);
    g.position.set(x,0,z);scene.add(g);roadside.push({group:g,z,side,kind:'tree'});
  }
  // [UPGRADED] Warm street fixtures with restrained emissive glow and soft road-surface light pools.
  const lampHousingMat=new THREE.MeshStandardMaterial({color:0x252d34,metalness:.72,roughness:.3});
  const lampLensMat=new THREE.MeshStandardMaterial({color:0xffe2b0,emissive:0xffb85e,emissiveIntensity:3.1,roughness:.22});
  const lampPoolMat=new THREE.MeshBasicMaterial({color:0xffc77d,transparent:true,opacity:.09,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const lampPoolCoreMat=new THREE.MeshBasicMaterial({color:0xffd99b,transparent:true,opacity:.13,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const lampPoolGeo=new THREE.CircleGeometry(2.8,40);
  const lampPoolCoreGeo=new THREE.CircleGeometry(1.42,32);
  function lamp(x,z,side){
    const g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,5.5,8),mat(0x343b42,.48,.72));pole.position.y=2.75;g.add(pole);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.9,.08,.08),chrome);arm.position.set(-side*.38,5.4,0);g.add(arm);
    const head=new THREE.Mesh(new THREE.BoxGeometry(.62,.17,.42),lampHousingMat);head.position.set(-side*.72,5.32,0);g.add(head);
    const bulb=new THREE.Mesh(new THREE.BoxGeometry(.46,.045,.29),lampLensMat);bulb.position.set(-side*.72,5.215,0);g.add(bulb);
    // Two soft additive layers create a brighter center and feathered amber falloff on the asphalt.
    const pool=new THREE.Mesh(lampPoolGeo,lampPoolMat);pool.rotation.x=-Math.PI/2;pool.position.set(-side*3.4,.024,0);pool.scale.set(1.18,.92,1);g.add(pool);
    const core=new THREE.Mesh(lampPoolCoreGeo,lampPoolCoreMat);core.rotation.x=-Math.PI/2;core.position.set(-side*3.4,.028,0);core.scale.set(1.08,.86,1);g.add(core);
    g.position.set(x,0,z);scene.add(g);roadside.push({group:g,z,side,kind:'lamp'});
  }
  // [UPGRADED] Layered steel crash barriers with restrained reflectors for a realistic night-road edge.
  const barrierSteel=new THREE.MeshStandardMaterial({color:0x68747d,metalness:.82,roughness:.3});
  const barrierDark=new THREE.MeshStandardMaterial({color:0x242d34,metalness:.58,roughness:.48});
  const barrierReflector=new THREE.MeshStandardMaterial({color:0xffd49a,emissive:0x7a431b,emissiveIntensity:.72,roughness:.3});
  function rail(side){
    const g=new THREE.Group();
    const beam=new THREE.Mesh(new THREE.BoxGeometry(.2,.3,260),barrierSteel);
    beam.position.set(side*9.6,1.02,-100);beam.castShadow=true;beam.receiveShadow=true;g.add(beam);
    const lowerBeam=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,260),barrierDark);
    lowerBeam.position.set(side*9.6,.62,-100);g.add(lowerBeam);
    for(let z=-228;z<12;z+=8){
      const post=new THREE.Mesh(new THREE.BoxGeometry(.16,1.05,.2),barrierDark);
      post.position.set(side*9.6,.48,z);post.castShadow=true;g.add(post);
      const reflector=new THREE.Mesh(new THREE.BoxGeometry(.055,.2,.035),barrierReflector);
      reflector.position.set(side*9.485,1.08,z-1.9);g.add(reflector);
      const foot=new THREE.Mesh(new THREE.BoxGeometry(.42,.09,.34),barrierSteel);
      foot.position.set(side*9.6,.08,z);g.add(foot);
    }
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
  // [UPGRADED] Subtle roadside utility cabinets and safety bollards add street-level city detail.
  const utilityCaseMat=new THREE.MeshStandardMaterial({color:0x3b454b,metalness:.62,roughness:.5});
  const utilityDoorMat=new THREE.MeshStandardMaterial({color:0x56636a,metalness:.48,roughness:.58});
  const utilityMarkMat=new THREE.MeshStandardMaterial({color:0xd7a65d,emissive:0x513619,emissiveIntensity:.42,roughness:.5});
  const bollardMat=new THREE.MeshStandardMaterial({color:0x343c42,metalness:.55,roughness:.42});
  for(const z of [-38,-108,-188]){
    for(const side of [-1,1]){
      const unit=new THREE.Group();
      const base=new THREE.Mesh(new THREE.BoxGeometry(1.05,.12,.78),concrete);base.position.y=.06;unit.add(base);
      const cabinet=new THREE.Mesh(new THREE.BoxGeometry(.86,1.12,.62),utilityCaseMat);cabinet.position.y=.68;cabinet.castShadow=true;unit.add(cabinet);
      const door=new THREE.Mesh(new THREE.BoxGeometry(.68,.82,.035),utilityDoorMat);door.position.set(0,.7,.33);unit.add(door);
      const marker=new THREE.Mesh(new THREE.BoxGeometry(.34,.055,.045),utilityMarkMat);marker.position.set(0,1.12,.355);unit.add(marker);
      const latch=new THREE.Mesh(new THREE.BoxGeometry(.045,.13,.045),roadSignTrim);latch.position.set(.25,.68,.36);unit.add(latch);
      unit.position.set(side*11.8,0,z);scene.add(unit);roadside.push({group:unit,z,side,kind:'utility'});
      for(const offset of [-1.25,1.25]){
        const bollard=new THREE.Group();
        const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.72,10),bollardMat);post.position.y=.36;post.castShadow=true;bollard.add(post);
        const cap=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.09,10),utilityMarkMat);cap.position.y=.72;bollard.add(cap);
        bollard.position.set(side*11.8,0,z+offset);scene.add(bollard);roadside.push({group:bollard,z:z+offset,side,kind:'bollard'});
      }
    }
  }
  // [ADDED] Sparse downtown seating and litter bins make the sidewalks feel occupied, not cluttered.
  const benchMetal=new THREE.MeshStandardMaterial({color:0x343e46,metalness:.72,roughness:.38});
  const benchWood=new THREE.MeshStandardMaterial({color:0x574b3d,roughness:.78});
  const binMat=new THREE.MeshStandardMaterial({color:0x414c53,metalness:.52,roughness:.55});
  const binSlotMat=new THREE.MeshStandardMaterial({color:0x171e23,roughness:.9});
  for(const z of [-68,-148,-228]){
    for(const side of [-1,1]){
      const streetFurniture=new THREE.Group();
      const seat=new THREE.Mesh(new THREE.BoxGeometry(.82,.09,1.75),benchWood);seat.position.set(side*11.05,.58,0);streetFurniture.add(seat);
      const back=new THREE.Mesh(new THREE.BoxGeometry(.09,.62,1.75),benchWood);back.position.set(side*11.48,.91,.0);streetFurniture.add(back);
      for(const dz of [-.67,.67]){
        const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.55,.1),benchMetal);leg.position.set(side*11.05,.29,dz);streetFurniture.add(leg);
        const brace=new THREE.Mesh(new THREE.BoxGeometry(.48,.07,.08),benchMetal);brace.position.set(side*11.25,.2,dz);streetFurniture.add(brace);
      }
      const bin=new THREE.Group();
      const body=new THREE.Mesh(new THREE.CylinderGeometry(.22,.25,.78,12),binMat);body.position.y=.4;body.castShadow=true;bin.add(body);
      const lid=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.08,12),benchMetal);lid.position.y=.82;bin.add(lid);
      const slot=new THREE.Mesh(new THREE.BoxGeometry(.24,.035,.025),binSlotMat);slot.position.set(0,.67,.235);bin.add(slot);
      bin.position.set(side*12.05,0,.95);streetFurniture.add(bin);
      streetFurniture.position.z=z;scene.add(streetFurniture);
      roadside.push({group:streetFurniture,z,side,kind:'street-furniture'});
    }
  }
  // [ADDED] Compact glass bus shelters add believable public-transport detail along the downtown sidewalks.
  const shelterFrame=new THREE.MeshStandardMaterial({color:0x3b464e,metalness:.78,roughness:.32});
  const shelterGlass=new THREE.MeshPhysicalMaterial({color:0x91a9b5,transparent:true,opacity:.22,metalness:.12,roughness:.16,clearcoat:.8,depthWrite:false});
  const shelterRoof=new THREE.MeshStandardMaterial({color:0x252f37,metalness:.62,roughness:.42});
  const shelterSeat=new THREE.MeshStandardMaterial({color:0x4c514f,metalness:.38,roughness:.62});
  const stopSignMat=new THREE.MeshStandardMaterial({color:0x304a59,emissive:0x142630,emissiveIntensity:.35,metalness:.25,roughness:.48});
  for(const z of [-88,-168]){
    for(const side of [-1,1]){
      const shelter=new THREE.Group();
      const roof=new THREE.Mesh(new THREE.BoxGeometry(1.48,.13,3.35),shelterRoof);
      roof.position.set(side*.0,2.35,0);roof.castShadow=true;shelter.add(roof);
      const roofLip=new THREE.Mesh(new THREE.BoxGeometry(1.56,.055,3.43),shelterFrame);roofLip.position.set(0,2.27,0);shelter.add(roofLip);
      for(const x of [-.68,.68])for(const dz of [-1.52,1.52]){
        const post=new THREE.Mesh(new THREE.BoxGeometry(.075,2.25,.075),shelterFrame);
        post.position.set(x,1.14,dz);shelter.add(post);
      }
      const backPanel=new THREE.Mesh(new THREE.BoxGeometry(.045,1.95,2.95),shelterGlass);
      backPanel.position.set(side*.64,1.22,0);shelter.add(backPanel);
      for(const dz of [-1.48,1.48]){
        const endPanel=new THREE.Mesh(new THREE.BoxGeometry(1.28,1.92,.035),shelterGlass);
        endPanel.position.set(0,1.2,dz);shelter.add(endPanel);
      }
      const seat=new THREE.Mesh(new THREE.BoxGeometry(.72,.09,2.1),shelterSeat);
      seat.position.set(-side*.22,.58,0);shelter.add(seat);
      for(const dz of [-.88,.88]){
        const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,.52,.08),shelterFrame);
        leg.position.set(-side*.22,.29,dz);shelter.add(leg);
      }
      const signPost=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,2.65,8),shelterFrame);
      signPost.position.set(-side*.78,1.32,-1.35);shelter.add(signPost);
      const sign=new THREE.Mesh(new THREE.BoxGeometry(.48,.62,.09),stopSignMat);
      sign.position.set(-side*.78,2.18,-1.35);shelter.add(sign);
      const signStripe=new THREE.Mesh(new THREE.BoxGeometry(.28,.045,.018),shelterGlass);
      signStripe.position.set(-side*.78,2.24,-1.30);shelter.add(signStripe);
      shelter.position.set(side*11.1,0,z);scene.add(shelter);
      roadside.push({group:shelter,z,side,kind:'bus-shelter'});
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

  // [UPGRADED] Legible overhead urban direction signs with reflective faces and route details.
  const roadSignFace=new THREE.MeshStandardMaterial({color:0x18313a,metalness:.28,roughness:.48});
  const roadSignTrim=new THREE.MeshStandardMaterial({color:0xb5c0c4,metalness:.78,roughness:.3});
  const signLabels=[
    {top:'CITY CENTER',bottom:'DOWNTOWN  •  EXIT 08',route:'08'},
    {top:'RIVERSIDE',bottom:'NEXT EXIT  •  2 KM',route:'12'},
    {top:'NIGHT DISTRICT',bottom:'CITY ROUTE  •  KEEP LEFT',route:'05'}
  ];
  for(let si=0;si<3;si++){
    const z=[-72,-150,-225][si],sign=new THREE.Group();
    const postMat=mat(0x6c747a,.55,.5);
    for(const x of [-1,1]){
      const p=new THREE.Mesh(new THREE.BoxGeometry(.12,4.5,.12),postMat);p.position.set(x*7,2.25,0);sign.add(p);
      const base=new THREE.Mesh(new THREE.BoxGeometry(.48,.12,.48),roadSignTrim);base.position.set(x*7,.08,0);sign.add(base);
    }
    const board=new THREE.Mesh(new THREE.BoxGeometry(13,.9,.22),roadSignFace);board.position.y=4.15;sign.add(board);
    const topEdge=new THREE.Mesh(new THREE.BoxGeometry(13,.045,.24),roadSignTrim);topEdge.position.set(0,4.61,0);sign.add(topEdge);
    const label=signLabels[si],canvas=document.createElement('canvas');canvas.width=1300;canvas.height=180;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#17313b';ctx.fillRect(0,0,1300,180);
    ctx.fillStyle='#e6edf0';ctx.font='700 58px Arial';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label.top,42,58);
    ctx.fillStyle='#b9c9cf';ctx.font='600 31px Arial';ctx.fillText(label.bottom,44,130);
    ctx.fillStyle='#d6e2e5';ctx.fillRect(1080,24,170,132);
    ctx.fillStyle='#18313a';ctx.font='900 78px Arial';ctx.textAlign='center';ctx.fillText(label.route,1165,94);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const faceMat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
    const face=new THREE.Mesh(new THREE.PlaneGeometry(12.82,.82),faceMat);face.position.set(0,4.15,.116);sign.add(face);
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
    $('overlay').hidden=false;$('overlayTitle').textContent=won?'YOU WIN!':'RACE FINISHED';
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
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'SOUND: ON':'SOUND: OFF';if(sound){ensureAudio();beep(600);}else if(audioRig&&audio){audioRig.engineGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.harmonicGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.motorGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.windGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.tireGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);}});
  window.addEventListener('pagehide',()=>{
    pageLeaving=true;
    running=false;countdownActive=false;if(countdownTimer)clearTimeout(countdownTimer);keys={};
    if(rafId){cancelAnimationFrame(rafId);rafId=0;}
    try{renderer.dispose();}catch(e){}
    try{if(audio&&audio.state!=='closed')audio.close();}catch(e){}
  },{once:true});
  window.addEventListener('resize',resize);
  $('sound').textContent='SOUND: ON';
  resize();draw();
  // If WebGL is unavailable, show a clear message instead of a blank game panel.
  window.addEventListener('unhandledrejection',e=>{console.error('3D racing failed to load',e.reason);});
})();
