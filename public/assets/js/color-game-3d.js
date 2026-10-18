import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';

(() => {
  const mount = document.getElementById('machine3d');
  const stage = document.getElementById('colorStage');
  if (!mount || !stage) return;

  const colors = {
    red: 0xd7193f, blue: 0x1679ee, green: 0x08a66c,
    yellow: 0xf5b900, pink: 0xe936a9
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 2.8, 0.1, 100);
  camera.position.set(0, 2.15, 6.3);
  camera.lookAt(0, 0.15, 0);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
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
  const felt = mat(0x07563d, .1, .92);
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
  // Raised rim around the actual dice tray.
  const rim = new THREE.Mesh(new THREE.BoxGeometry(5.75,.22,1.88), gold);
  rim.position.set(0,-.21,0); base.add(rim);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(5.5,.2,1.63), felt);
  inner.position.set(0,-.095,0); base.add(inner);
  // Transparent acrylic hood and polished circular rim. Alpha is intentionally subtle so dice remain visible.
  const domeMat = new THREE.MeshPhysicalMaterial({color:0xa6e8e5, roughness:.08, metalness:.12, transmission:.25, transparent:true, opacity:.17, thickness:.5, side:THREE.DoubleSide, clearcoat:1, depthWrite:false});
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2), domeMat);
  dome.scale.set(3.0,1.2,1.05); dome.position.set(0,-.02,0); dome.castShadow=false; base.add(dome);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(2.85,.055,10,64), brightGold);
  hoop.scale.set(1,1,.37); hoop.position.set(0,-.18,0); base.add(hoop);
  // Side hinges, latch, and a front control panel make the machine feel manufactured.
  for (const x of [-2.9,2.9]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.45,20), brightGold);
    hinge.rotation.z=Math.PI/2; hinge.position.set(x,-.08,.92); base.add(hinge);
  }
  box(1.3,.15,.22,darkMetal,0,-.27,1.52);
  box(.9,.055,.06,brightGold,0,-.18,1.65);
  for (let i=0;i<5;i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.055,12,8), mat([0xff314e,0x36a5ff,0x26f5a0,0xffd54b,0xff62ce][i],.1,.18,{emissive:[0xff183d,0x086dff,0x00b96b,0xe9a900,0xec239b][i],emissiveIntensity:1.3}));
    lamp.position.set(-.36+i*.18,-.13,1.69);base.add(lamp);
  }

  const dice = [];
  const pipMat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:.24, metalness:.04, emissive:0x202020});
  const diceGeo = new THREE.BoxGeometry(.78,.78,.78);
  function makeDie(index) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(diceGeo, mat(colors[['red','blue','green'][index]],.28,.24,{clearcoat:1,clearcoatRoughness:.15}));
    body.castShadow=true; body.receiveShadow=true; root.add(body);
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
    root.position.set([-1.65,0,1.65][index],.42,0);
    root.rotation.set(.12+index*.13,.25+index*.4,.1-index*.1);
    scene.add(root);dice.push({root,body,index,phase:index*2.1,rolling:false,target:colors[['red','blue','green'][index]]});
  }
  for(let i=0;i<3;i++)makeDie(i);
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
      });
      lastColors=signature;
    }
    const dropping=stage.classList.contains('dice-drop');
    const rolling=stage.classList.contains('rolling') || stage.classList.contains('dice-drop');
    dice.forEach(d=>d.rolling=rolling);
    if(dropping&&!wasDropping){dropStart=now;rollingUntil=now+1.05;}
    if(!rolling&&wasDropping){rollingUntil=0;}
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

  function animate() {
    requestAnimationFrame(animate);
    const now=performance.now(),dt=Math.min(.04,(now-lastTime)/1000||.016);lastTime=now;
    syncState(now);
    dice.forEach((d,i)=>{
      if(d.rolling) {
        d.root.rotation.x+=dt*(6.8+i*1.1);d.root.rotation.y+=dt*(8.1-i*.7);d.root.rotation.z+=dt*(5.2+i);
        d.root.position.y=.42+Math.abs(Math.sin(now*.012+d.phase))*.24;
        if(stage.classList.contains('dice-drop')) {
          const p=Math.min(1,(now-dropStart)/920);
          d.root.position.y=.42+Math.abs(1-p)*1.7;
          d.root.position.x=[-1.65,0,1.65][i]+Math.sin(p*13+i)*(.22*(1-p));
          if(p>=1){d.root.position.y=.42;d.rolling=false;d.root.rotation.x=Math.round(d.root.rotation.x/(Math.PI/2))*(Math.PI/2);}
        }
      } else {
        d.root.position.set([-1.65,0,1.65][i],.42,0);
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
  }
  animate();
  // Graceful fallback if WebGL cannot initialize: the original CSS dice remain visible.
})();

