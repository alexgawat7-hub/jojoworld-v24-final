import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
import { RoundedBoxGeometry } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/geometries/RoundedBoxGeometry.js';

(() => {
  const mount = document.getElementById('machine3d');
  const stage = document.getElementById('colorStage');
  if (!mount || !stage) return;

  const colors = {
    red: 0xd7193f, blue: 0x1679ee, green: 0x08a66c,
    yellow: 0xf5b900, pink: 0xe936a9, white: 0xf4f5f6
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 2.8, 0.1, 100);
  // [FIXED] Pull the camera back and aim lower so the entire recessed dice tray is visible on mobile.
  camera.position.set(0, 2.45, 7.7);
  camera.lookAt(0, -0.18, 0);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (error) { mount.dataset.fallback = 'webgl-unavailable'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Animated three-dimensional color dice machine');
  mount.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xc9f4e5, 0x161d20, 2.4));
  const key = new THREE.DirectionalLight(0xffe0a0, 3.4);
  key.position.set(-4, 8, 5); key.castShadow = true; scene.add(key);
  const cool = new THREE.PointLight(0x57cfff, 2.0, 15); cool.position.set(4, 3, 1); scene.add(cool);
  const goldLight = new THREE.PointLight(0xffbf4c, 1.8, 12); goldLight.position.set(-4, 2, -1); scene.add(goldLight);

  const mat = (color, metalness=.2, roughness=.4, extra={}) => new THREE.MeshStandardMaterial({color, metalness, roughness, ...extra});
  const gold = mat(0xd4a64e, .88, .24);
  const brightGold = mat(0xffe4a0, .8, .2);
  const darkMetal = mat(0x20272a, .78, .29);
  const black = mat(0x090f12, .45, .35);
  // Procedural felt fibers give the tray a textured casino-table surface without external assets.
  const feltCanvas=document.createElement('canvas');
  feltCanvas.width=256;feltCanvas.height=256;
  const feltCtx=feltCanvas.getContext('2d');
  feltCtx.fillStyle='#07563d';feltCtx.fillRect(0,0,256,256);
  for(let i=0;i<2600;i++){
    const shade=Math.random()>.5?'rgba(132,211,160,.10)':'rgba(0,16,12,.16)';
    feltCtx.strokeStyle=shade;feltCtx.lineWidth=.5+Math.random()*.7;
    const x=Math.random()*256,y=Math.random()*256,len=1+Math.random()*4;
    feltCtx.beginPath();feltCtx.moveTo(x,y);feltCtx.lineTo(x+len,y+(Math.random()-.5)*1.8);feltCtx.stroke();
  }
  const feltTexture=new THREE.CanvasTexture(feltCanvas);
  feltTexture.colorSpace=THREE.SRGBColorSpace;
  feltTexture.wrapS=feltTexture.wrapT=THREE.RepeatWrapping;
  feltTexture.repeat.set(4,2);
  const felt = mat(0x07563d, .08, .98, {map:feltTexture});
  const base = new THREE.Group(); scene.add(base);

  function box(w,h,d,material,x,y,z, bevel=false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; base.add(mesh); return mesh;
  }
  // Heavy machined pedestal, layered gold trim, bolts and inset green felt.
  box(7.6,.42,3.3,darkMetal,0,-1.1,0);
  box(7.42,.12,3.12,gold,0,-.84,0);
  box(7.22,.2,2.94,black,0,-.68,0);
  box(6.92,.12,2.64,brightGold,0,-.53,0);
  box(6.72,.13,2.44,felt,0,-.42,0);
  box(6.65,.07,.12,gold,0,-.32,1.19);
  box(6.65,.07,.12,gold,0,-.32,-1.19);
  for (const x of [-3.45,3.45]) box(.09,.08,2.36,brightGold,x,-.32,0);
  for (const x of [-3.1,-1.55,0,1.55,3.1]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.045,16), brightGold);
    bolt.rotation.x=Math.PI/2; bolt.position.set(x,-.31,1.23); base.add(bolt);
  }
  // Four separate raised rails form a real recessed tray instead of a flat border.
  const trayFloor = new THREE.Mesh(new THREE.BoxGeometry(5.62,.13,1.82), felt);
  trayFloor.position.set(0,-.16,0);trayFloor.receiveShadow=true;base.add(trayFloor);
  // [FIXED] Open the front-center of the tray so dice have a visible exit path toward the player.
  box(1.72,.42,.22,gold,-1.98,.02,.91);
  box(1.72,.42,.22,gold,1.98,.02,.91);
  box(5.82,.42,.22,gold,0,.02,-.91);
  // [ADDED] Lower catch/roll-out deck directly in front of the tray opening.
  box(3.35,.12,1.52,darkMetal,0,-.39,1.67);
  box(3.19,.045,1.38,felt,0,-.31,1.67);
  box(3.35,.055,.08,brightGold,0,-.29,2.39);
  box(.07,.06,1.48,brightGold,-1.66,-.29,1.67);
  box(.07,.06,1.48,brightGold,1.66,-.29,1.67);
  box(.18,.27,1.72,gold,-2.82,-.035,0);
  box(.18,.27,1.72,gold,2.82,-.035,0);
  box(5.54,.035,1.52,felt,0,-.078,0);
  // Dark lacquered side housings and inset gold strips frame the tray like a manufactured cabinet.
  for(const x of [-3.18,3.18]){
    box(.32,.55,2.58,darkMetal,x,-.22,0);
    box(.035,.42,2.38,brightGold,x+(x<0?.17:-.17),-.2,0);
    for(const z of [-.88,0,.88]){
      const screw=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.025,12),brightGold);
      screw.rotation.x=Math.PI/2;screw.position.set(x,-.01,z);base.add(screw);
    }
  }
  // A small backlit machine fascia, rendered locally so no remote artwork is required.
  const fasciaCanvas=document.createElement('canvas');fasciaCanvas.width=512;fasciaCanvas.height=128;
  const fasciaCtx=fasciaCanvas.getContext('2d');
  const fasciaGradient=fasciaCtx.createLinearGradient(0,0,0,128);
  fasciaGradient.addColorStop(0,'#30382d');fasciaGradient.addColorStop(.48,'#111a16');fasciaGradient.addColorStop(1,'#050908');
  fasciaCtx.fillStyle=fasciaGradient;fasciaCtx.fillRect(0,0,512,128);
  fasciaCtx.strokeStyle='#d6b15e';fasciaCtx.lineWidth=5;fasciaCtx.strokeRect(5,5,502,118);
  fasciaCtx.textAlign='center';fasciaCtx.font='bold 48px Georgia,serif';fasciaCtx.fillStyle='#ffe6a0';
  fasciaCtx.shadowColor='#e8b84b';fasciaCtx.shadowBlur=12;fasciaCtx.fillText('COLOR DICE',256,61);
  fasciaCtx.shadowBlur=0;fasciaCtx.font='bold 17px Arial,sans-serif';fasciaCtx.fillStyle='#a6f5ce';fasciaCtx.fillText('THREE DICE  •  LIVE ROUND',256,94);
  const fasciaTexture=new THREE.CanvasTexture(fasciaCanvas);fasciaTexture.colorSpace=THREE.SRGBColorSpace;
  const fascia=new THREE.Mesh(new THREE.PlaneGeometry(3.7,.92),new THREE.MeshBasicMaterial({map:fasciaTexture}));
  fascia.position.set(0,-.03,-1.31);fascia.rotation.x=-.08;base.add(fascia);
  box(4.0,.12,.15,gold,0,-.5,-1.31);
  // Transparent acrylic hood and polished circular rim. Alpha is intentionally subtle so dice remain visible.
  const domeMat = new THREE.MeshPhysicalMaterial({color:0xa6e8e5, roughness:.08, metalness:.12, transmission:.25, transparent:true, opacity:.17, thickness:.5, side:THREE.DoubleSide, clearcoat:1, depthWrite:false});
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2), domeMat);
  dome.scale.set(3.0,1.2,1.05); dome.position.set(0,-.02,0); dome.castShadow=false; base.add(dome);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(2.85,.055,10,64), brightGold);
  hoop.scale.set(1,.37,1); hoop.rotation.x=Math.PI/2; hoop.position.set(0,-.18,0); base.add(hoop);
  // Side hinges, latch, and a front control panel make the machine feel manufactured.
  for (const x of [-2.9,2.9]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.45,20), brightGold);
    hinge.rotation.z=Math.PI/2; hinge.position.set(x,-.08,.92); base.add(hinge);
  }
  box(1.3,.15,.22,darkMetal,0,-.27,1.52);
  box(.9,.055,.06,brightGold,0,-.18,1.65);
  for (let i=0;i<6;i++) {
    const lampColors=[0xff314e,0x36a5ff,0x26f5a0,0xffd54b,0xff62ce,0xf4f5f6];
    const emissiveColors=[0xff183d,0x086dff,0x00b96b,0xe9a900,0xec239b,0x9caab4];
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.055,12,8), mat(lampColors[i],.1,.18,{emissive:emissiveColors[i],emissiveIntensity:1.3}));
    lamp.position.set(-.45+i*.18,-.13,1.69);base.add(lamp);
  }

  const dice = [];
  const pipMat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:.24, metalness:.04, emissive:0x202020});
  const diceGeo = new RoundedBoxGeometry(.78,.78,.78,4,.075);
  function makeDie(index) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(diceGeo, mat(colors[['green','red','green'][index]],.28,.24,{clearcoat:1,clearcoatRoughness:.15}));
    body.castShadow=true; body.receiveShadow=true; root.add(body);
    // Inset enamel face plates reproduce the requested green / red-pink / red-green dice look.
    // The upper plate tracks the server-confirmed die color; the front plate provides the contrasting side.
    const topPlate = new THREE.Mesh(new RoundedBoxGeometry(.57,.025,.57,3,.035), mat(colors[['green','red','red'][index]],.22,.22,{clearcoat:1,clearcoatRoughness:.12}));
    topPlate.position.set(0,.391,0);topPlate.castShadow=true;root.add(topPlate);
    const sideColors=[colors.green,colors.pink,colors.green];
    const sidePlate = new THREE.Mesh(new RoundedBoxGeometry(.57,.57,.025,3,.035), mat(sideColors[index],.24,.22,{clearcoat:1,clearcoatRoughness:.12}));
    sidePlate.position.set(0,0,.391);sidePlate.castShadow=true;root.add(sidePlate);
    // Real raised ivory pips on all six faces, laid out as standard die patterns.
    const patterns = [
      [[0,0]], [[-.19,-.19],[.19,.19]], [[-.2,-.2],[0,0],[.2,.2]],
      [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]],
      [[-.2,-.2],[.2,-.2],[0,0],[-.2,.2],[.2,.2]],
      [[-.2,-.23],[.2,-.23],[-.2,0],[.2,0],[-.2,.23],[.2,.23]]
    ];
    const faces = [
      {n:1,p:[0,0, .397],r:[0,0,0]},
      {n:2,p:[0,0,-.397],r:[0,Math.PI,0]},
      {n:3,p:[.397,0,0],r:[0,Math.PI/2,0]},
      {n:4,p:[-.397,0,0],r:[0,-Math.PI/2,0]},
      {n:5,p:[0,.397,0],r:[-Math.PI/2,0,0]},
      {n:6,p:[0,-.397,0],r:[Math.PI/2,0,0]}
    ];
    faces.forEach(face=>{
      patterns[face.n-1].forEach(([u,v])=>{
        const pip=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.018,16),pipMat);
        pip.rotation.x=Math.PI/2;
        const local=new THREE.Vector3(u,v,0);
        const group=new THREE.Group();group.rotation.set(...face.r);group.position.set(...face.p);
        pip.position.set(u,v,.005); group.add(pip);root.add(group);
      });
    });
    // [FIXED] Keep the dice visibly inside the rear half of the recessed tray during betting, not parked along the front edge.
    root.position.set([-1.45,0,1.45][index],.30,-.34);
    root.rotation.set(.12+index*.13,.25+index*.4,.1-index*.1);
    scene.add(root);dice.push({root,body,topPlate,sidePlate,index,phase:index*2.1,rolling:false,landed:false,dropHeight:0,verticalVelocity:0,spinX:0,spinY:0,spinZ:0,vx:0,vz:0,target:colors[['red','blue','green'][index]]});
  }
  for(let i=0;i<3;i++)makeDie(i);
  // [ADDED] Opaque golden shaker covers all dice throughout betting; it lifts only after the banker pulls.
  const shaker = new THREE.Group();
  const shakerGold = new THREE.MeshStandardMaterial({color:0xc18a32,metalness:.72,roughness:.23});
  const shakerHighlight = new THREE.MeshStandardMaterial({color:0xffe2a0,metalness:.78,roughness:.18});
  const shakerDome = new THREE.Mesh(new THREE.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI/2),shakerGold);
  shakerDome.scale.set(1.92,1.42,1.02); shakerDome.position.y=.03; shakerDome.castShadow=true; shakerDome.receiveShadow=true; shaker.add(shakerDome);
  const shakerRim = new THREE.Mesh(new THREE.TorusGeometry(1.88,.095,12,48),shakerHighlight);
  shakerRim.rotation.x=Math.PI/2; shakerRim.position.y=.025; shakerRim.castShadow=true; shaker.add(shakerRim);
  const shakerTop = new THREE.Mesh(new THREE.CylinderGeometry(.28,.38,.16,32),shakerHighlight);
  shakerTop.position.set(0,1.38,0); shakerTop.castShadow=true; shaker.add(shakerTop);
  const shakerKnob = new THREE.Mesh(new THREE.SphereGeometry(.19,24,16),shakerGold);
  shakerKnob.position.set(0,1.55,0); shakerKnob.castShadow=true; shaker.add(shakerKnob);
  shaker.position.set(0,-.03,0); scene.add(shaker);

  // A banker-operated overhead release arm, cable and weighted brass pull.
  const rig = new THREE.Group();rig.position.set(0,1.1,-.5);scene.add(rig);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(3.7,.13,.15),darkMetal);arm.position.set(0,0,0);rig.add(arm);
  const support = new THREE.Mesh(new THREE.BoxGeometry(.16,.95,.16),gold);support.position.set(0,-.48,-.02);rig.add(support);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1.0,10),brightGold);cord.position.set(0,-.72,.16);rig.add(cord);
  const pull = new THREE.Mesh(new THREE.CylinderGeometry(.15,.18,.28,20),gold);pull.position.set(0,-1.27,.16);rig.add(pull);
  const redButton = new THREE.Mesh(new THREE.SphereGeometry(.09,16,12),mat(0xff424f,.15,.2,{emissive:0x991020,emissiveIntensity:1}));redButton.position.set(.22,-1.27,.18);rig.add(redButton);

  let lastColors='', wasDropping=false, rollingUntil=0, dropStart=0, lastTime=0;
  const clock=new THREE.Clock();
  function syncState(now) {
    const names=dice.map((d,i)=>{
      const el=document.getElementById('die'+i);
      return el ? [...el.classList].find(c=>colors[c]!==undefined) || 'red' : 'red';
    });
    const signature=names.join(',');
    if(signature!==lastColors) {
      names.forEach((name,i)=>{
        dice[i].target=colors[name]??colors.red;
        dice[i].body.material.color.setHex(dice[i].target);
        dice[i].topPlate.material.color.setHex(dice[i].target);
        // [FIXED] Keep every visible face the server-confirmed color; no leftover placeholder side colors.
        dice[i].sidePlate.material.color.setHex(dice[i].target);
      });
      lastColors=signature;
    }
    const dropping=stage.classList.contains('dice-drop');
    const rolling=stage.classList.contains('rolling') || dropping;
    if(dropping&&!wasDropping){
      dropStart=now;rollingUntil=now+1.05;
      dice.forEach((d,i)=>{
        d.landed=false;
        // Begin just above the felt, inside the recessed tray. Avoid teleporting
        // upward on pull: gravity carries each die down into the tray immediately.
        d.dropHeight=.035+i*.012;
        d.verticalVelocity=.22+i*.06;
        d.spinX=9.2+i*1.1;d.spinY=11.2-i*.65;d.spinZ=8.4+i*.8;
        // [FIXED] Give each die enough forward momentum to pass through the open front of the tray.
        d.vx=[.32,-.12,-.28][i];d.vz=[2.15,2.55,2.25][i];
      });
    }
    if(!rolling&&wasDropping){rollingUntil=0;}
    dice.forEach(d=>d.rolling=rolling && (!dropping || now-dropStart<2200));
    wasDropping=dropping;
    rig.userData.pulled=document.getElementById('cordRig')?.classList.contains('pulled')||false;
  }
  function resize() {
    const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(mount);resize();
  mount.classList.add('three-ready');
  stage.classList.add('three-ready');

  let framePending=false;
  function scheduleFrame() {
    if (document.hidden || framePending) return;
    framePending=true;
    requestAnimationFrame(()=>{framePending=false;animate();});
  }
  function animate() {
    if (document.hidden) return;
    const now=performance.now(),dt=Math.min(.04,(now-lastTime)/1000||.016);lastTime=now;
    syncState(now);
    const activeDrop=stage.classList.contains('dice-drop');
    // Lift the golden cup after pull, then keep it out of the rolling dice' path.
    const keepShakerRaised=stage.classList.contains('revealed')&&!stage.classList.contains('betting-open');
    const shakerLift=activeDrop?Math.min(1,Math.max(0,(now-dropStart)/520)):(keepShakerRaised?1:0);
    const shakerEase=shakerLift*shakerLift*(3-2*shakerLift);
    shaker.position.y=-.03+shakerEase*2.85;
    shaker.rotation.z=activeDrop?Math.sin(shakerLift*Math.PI)*.10:0;
    shaker.visible=shakerLift<1;

    if(activeDrop){
      for(let a=0;a<dice.length;a++)for(let b=a+1;b<dice.length;b++){
        const da=dice[a],db=dice[b];
        if(da.landed&&db.landed)continue;
        const dx=db.root.position.x-da.root.position.x,dz=db.root.position.z-da.root.position.z;
        const dist=Math.hypot(dx,dz),minDist=.79;
        if(dist>0&&dist<minDist&&Math.abs(da.root.position.y-db.root.position.y)<.68){
          const nx=dx/dist,nz=dz/dist,overlap=(minDist-dist)*.5;
          da.root.position.x-=nx*overlap;da.root.position.z-=nz*overlap;
          db.root.position.x+=nx*overlap;db.root.position.z+=nz*overlap;
          const av=da.vx*nx+da.vz*nz,bv=db.vx*nx+db.vz*nz;
          da.vx+=(bv-av)*nx*.62;da.vz+=(bv-av)*nz*.62;
          db.vx+=(av-bv)*nx*.62;db.vz+=(av-bv)*nz*.62;
          da.spinY+=nz*1.5;db.spinY-=nz*1.5;
        }
      }
    }
    dice.forEach((d,i)=>{
      if(d.rolling) {
        const dropping=stage.classList.contains('dice-drop');
        if(dropping) {
          // Small fixed-step-style gravity and damped bounces make the drop read as a physical roll.
          d.verticalVelocity-=10.8*dt;
          d.dropHeight+=d.verticalVelocity*dt;
          if(d.dropHeight<=0) {
            d.dropHeight=0;
            if(Math.abs(d.verticalVelocity)>.72) {
              const impactStrength=Math.min(1,Math.abs(d.verticalVelocity)/8);
              window.dispatchEvent(new CustomEvent('color-dice-impact',{detail:{strength:impactStrength,index:d.index}}));
              d.verticalVelocity=Math.abs(d.verticalVelocity)*.34;
            } else {d.verticalVelocity=0;d.landed=true;}
          }
          // [FIXED] Lower the die onto the catch deck after it passes through the tray opening.
          const deckY=d.root.position.z>1.02?.10:.30;
          d.root.position.y=deckY+d.dropHeight;
          // Lateral momentum, felt-tray boundaries, and pairwise impacts keep the dice from floating through each other.
          if(!d.landed){
            d.root.position.x+=d.vx*dt;
            d.root.position.z+=d.vz*dt;
            d.vx*=Math.exp(-.42*dt);d.vz*=Math.exp(-.55*dt);
            const limitX=d.root.position.z>1.02?1.34:2.22;
            // [FIXED] Side walls still contain the dice inside the tray; the front is deliberately open.
            if(d.root.position.x < -limitX){d.root.position.x=-limitX;d.vx=Math.abs(d.vx)*.48;d.spinY+=1.4;}
            if(d.root.position.x > limitX){d.root.position.x=limitX;d.vx=-Math.abs(d.vx)*.48;d.spinY-=1.4;}
            if(d.root.position.z < -.37){d.root.position.z=-.37;d.vz=Math.abs(d.vz)*.42;d.spinX+=1.1;}
            // The front opening leads to a lower felt deck; let the dice visibly roll out onto it.
            if(d.root.position.z > 2.18){
              d.root.position.z=2.18;d.vz=-Math.abs(d.vz)*.24;d.spinX+=.9;
            }
          }
          const friction=d.landed?Math.min(1,dt*11):1;
          d.root.rotation.x+=d.spinX*dt*friction;
          d.root.rotation.y+=d.spinY*dt*friction;
          d.root.rotation.z+=d.spinZ*dt*friction;
          const damp=Math.exp(-2.4*dt);
          d.spinX*=damp;d.spinY*=damp;d.spinZ*=damp;
          if(d.landed) {
            d.root.position.y=d.root.position.z>1.02?.10:.30;
            // Settle toward a clear three-dice presentation after the last bounce.
            const homeX=[-1.65,0,1.65][i];
            d.root.position.x+=(homeX-d.root.position.x)*Math.min(1,dt*1.8);
            // Keep the final result visible on the lower deck if the die rolled out of the tray.
            const homeZ=d.root.position.z>1.02?1.72:0;
            d.root.position.z+=(homeZ-d.root.position.z)*Math.min(1,dt*2.2);
            const snap=Math.min(1,dt*5.5);
            // Finish with a stable, readable upright die pose instead of leaving a random tilted Euler angle.
            d.root.rotation.x+=(0-d.root.rotation.x)*snap;
            d.root.rotation.y+=(0-d.root.rotation.y)*snap;
            d.root.rotation.z+=(0-d.root.rotation.z)*snap;
          }
        } else {
          d.root.rotation.x+=dt*(6.8+i*1.1);d.root.rotation.y+=dt*(8.1-i*.7);d.root.rotation.z+=dt*(5.2+i);
          d.root.position.y=.30+Math.abs(Math.sin(now*.012+d.phase))*.12;
          d.root.position.x=[-1.65,0,1.65][i]+Math.sin(now*.004+i)*.08;
        }
      } else {
        // [FIXED] Keep dice in their actual starting slots at the rear of the tray during betting.
        // The old idle branch reset z to 0 every frame, undoing the tray placement above.
        d.root.position.set([-1.45,0,1.45][i],.30,-.34);
        d.root.rotation.x+=(.06-d.root.rotation.x)*Math.min(1,dt*4);
        d.root.rotation.z+=(0-d.root.rotation.z)*Math.min(1,dt*4);
        d.root.rotation.y+=(.15+i*.28-d.root.rotation.y)*Math.min(1,dt*4);
      }
    });
    rig.position.y=rig.userData.pulled? .83:1.1;
    cord.scale.y=rig.userData.pulled?1.3:1;
    cord.position.y=rig.userData.pulled?-.87:-.72;
    pull.position.y=rig.userData.pulled?-1.45:-1.27;
    renderer.render(scene,camera);
    scheduleFrame();
  }
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){lastTime=performance.now();scheduleFrame();}
  });
  animate();
  // Pause rendering in background tabs to save mobile battery and resume when visible.
  // Graceful fallback if WebGL cannot initialize: the original CSS dice remain visible.
})();

