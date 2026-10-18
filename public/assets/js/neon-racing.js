import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';

(() => {
  const $ = id => document.getElementById(id);
  const mount = $('track');
  const token = new URLSearchParams(location.search).get('token');
  if (token) {
    $('lobby').href = '/live-games?token=' + encodeURIComponent(token);
    $('multiplayer').href = '/neon-racing-multiplayer?token=' + encodeURIComponent(token);
  }
  let running=false, sound=false, audio=null, audioRig=null, last=0, progress=0, rivalProgress=0;
  let speed=0, steer=0, nitro=0, rivalBoost=0, braking=false, keys={};
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

  scene.add(new THREE.HemisphereLight(0xc4d8ff,0x39402f,2.0));
  const sun = new THREE.DirectionalLight(0xffd0a0,3.0);
  sun.position.set(-18,28,12);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-25;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8acbff,1.0);fill.position.set(12,10,-30);scene.add(fill);

  const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const asphalt=mat(0x252a31,.96), shoulder=mat(0x626b72,.92), grass=mat(0x263d3a,1), concrete=mat(0x858e96,.8);
  const laneMat=mat(0xe6e0cd,.65), darkGlass=mat(0x182b3a,.28,.25), tireMat=mat(0x111315,1), chrome=mat(0x9da7ad,.32,.75);
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
  const nitroPickups=[];
  function addCar(color,accent){
    const root=new THREE.Group();
    const paint=mat(color,.28,.48), trim=mat(0x111820,.5,.35), glass=mat(0x172d3b,.2,.4), light= new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:2});
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,.48,3.8),paint);body.position.y=.72;body.castShadow=true;root.add(body);
    const hood=new THREE.Mesh(new THREE.BoxGeometry(1.72,.18,1.1),paint);hood.position.set(0,.98,-1.02);hood.castShadow=true;root.add(hood);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.35,.58,1.65),glass);cabin.position.set(0,1.15,-.28);cabin.castShadow=true;root.add(cabin);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(1.15,.09,.92),paint);roof.position.set(0,1.47,-.25);root.add(roof);
    const frontLip=new THREE.Mesh(new THREE.BoxGeometry(1.82,.13,.25),trim);frontLip.position.set(0,.48,-1.88);root.add(frontLip);
    const spoiler=new THREE.Mesh(new THREE.BoxGeometry(1.4,.1,.25),paint);spoiler.position.set(0,1.14,1.78);root.add(spoiler);
    const skirtMat=mat(0x10151c,.48,.25);for(const x of [-.91,.91]){const skirt=new THREE.Mesh(new THREE.BoxGeometry(.12,.18,2.25),skirtMat);skirt.position.set(x,.52,0);root.add(skirt);}
    for(const x of [-.98,.98]){const mirror=new THREE.Mesh(new THREE.BoxGeometry(.24,.12,.22),paint);mirror.position.set(x,1.05,-.63);root.add(mirror);}
    root.userData.wheels=[];root.userData.hubs=[];
    for(const x of [-.99,.99])for(const z of [-1.22,1.22]){
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,18),tireMat);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.43,z);wheel.castShadow=true;root.add(wheel);root.userData.wheels.push(wheel);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.232,12),chrome);hub.rotation.z=Math.PI/2;hub.position.set(x,.43,z);root.add(hub);root.userData.hubs.push(hub);
    }
    for(const x of [-.62,.62]){
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.42,.13,.05),light);lamp.position.set(x,.82,-1.94);root.add(lamp);
    }
    const tailMat=new THREE.MeshStandardMaterial({color:0xff2424,emissive:0xff1010,emissiveIntensity:1.4});
    for(const x of [-.63,.63]){const tail=new THREE.Mesh(new THREE.BoxGeometry(.36,.12,.05),tailMat);tail.position.set(x,.79,1.94);root.add(tail);}
    scene.add(root);return root;
  }
  const player=addCar(0x176d9a,0x8ef7ff);player.position.set(0,0,0);
  const rival=addCar(0xb52f3b,0xffb27d);rival.scale.setScalar(.78);rival.position.set(-2.8,0,-36);
  // Auto-collected nitro canisters: drive through one to trigger a short boost.
  const pickupCoreMat=new THREE.MeshStandardMaterial({color:0x8fffff,emissive:0x27dfff,emissiveIntensity:3,metalness:.25,roughness:.22});
  const pickupRingMat=new THREE.MeshStandardMaterial({color:0xff9f43,emissive:0xff5b20,emissiveIntensity:2.2,metalness:.2,roughness:.3});
  for(let i=0;i<5;i++){
    const g=new THREE.Group();
    const core=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.85,12),pickupCoreMat);core.rotation.z=Math.PI/2;g.add(core);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.07,8,18),pickupRingMat);g.add(ring);
    const glow=new THREE.PointLight(0x36ddff,1.7,5);g.add(glow);
    g.position.set([-3.6,0,3.6,0,-3.6][i],.95,-34-i*43);scene.add(g);nitroPickups.push(g);
  }
  // Lightweight tire-smoke particles used during hard steering/drifts.
  const smokeMaterial=new THREE.MeshStandardMaterial({color:0xc3c8ca,transparent:true,opacity:.22,roughness:1,depthWrite:false});
  const smoke=[];
  for(let i=0;i<26;i++){
    const puff=new THREE.Mesh(new THREE.SphereGeometry(.22,7,6),smokeMaterial.clone());
    puff.visible=false;scene.add(puff);smoke.push({mesh:puff,life:0});
  }
  let smokeCursor=0, driftAmount=0;
  function emitSmoke(){
    for(const x of [-.78,.78]){
      const p=smoke[smokeCursor++%smoke.length];p.life=.55+Math.random()*.35;
      p.mesh.visible=true;p.mesh.position.set(player.position.x+x,.42,player.position.z+1.35);
      const s=.35+Math.random()*.3;p.mesh.scale.setScalar(s);p.mesh.material.opacity=.22;
    }
  }
  function updateSmoke(sec){
    for(const p of smoke){
      if(p.life<=0)continue;
      p.life-=sec;p.mesh.position.y+=sec*1.15;p.mesh.position.x+=(p.mesh.position.x-player.position.x)*sec*.25;
      p.mesh.scale.multiplyScalar(1+sec*1.1);p.mesh.material.opacity=Math.max(0,p.life*.25);
      if(p.life<=0)p.mesh.visible=false;
    }
  }
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
  // A few overhead road signs with real 3D posts.
  for(const z of [-72,-150,-225]){
    const sign=new THREE.Group();
    const postMat=mat(0x6c747a,.55,.5);
    for(const x of [-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.12,4.5,.12),postMat);p.position.set(x*7,2.25,0);sign.add(p);}
    const board=new THREE.Mesh(new THREE.BoxGeometry(13,.9,.22),mat(0x1b3540,.65,.2));board.position.y=4.15;sign.add(board);
    scene.add(sign);sign.position.z=z;roadside.push({group:sign,z,side:0,kind:'sign'});
  }

  function resize(){
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
      audioRig={master,engine,engineFilter,engineGain,harmonic,harmonicGain,windGain,windFilter,tireGain,tireFilter};
      if(audio.state==='suspended')audio.resume();
    }catch(err){console.warn('Audio unavailable',err);}
  }
  function updateAudio(){
    if(!sound)return;ensureAudio();if(!audioRig||!audio)return;
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    const t=audio.currentTime,throttle=running?Math.max(.12,speed/245):0;
    audioRig.engine.frequency.setTargetAtTime(38+speed*.48+(nitro>0?15:0),t,.06);
    audioRig.engineGain.gain.setTargetAtTime(running?.025+throttle*.045:.0001,t,.08);
    audioRig.engineFilter.frequency.setTargetAtTime(180+speed*2.2,t,.08);
    audioRig.harmonic.frequency.setTargetAtTime(76+speed*.92,t,.07);
    audioRig.harmonicGain.gain.setTargetAtTime(running?.006+throttle*.018:.0001,t,.08);
    audioRig.windGain.gain.setTargetAtTime(running?Math.min(.14,speed/245*.14):.0001,t,.12);
    audioRig.windFilter.frequency.setTargetAtTime(250+speed*5,t,.1);
    audioRig.tireGain.gain.setTargetAtTime(running&&driftAmount>.35?Math.min(.12,driftAmount*.1):.0001,t,.06);
    audioRig.tireFilter.frequency.setTargetAtTime(900+Math.abs(steer)*1000,t,.06);
  }
  function beep(f=500){if(!sound)return;try{ensureAudio();if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(90,f*.62),audio.currentTime+.18);g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.08,audio.currentTime+.015);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.22);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.23)}catch{}}
  function collectNitro(pickup){
    nitro=2.15;pickup.position.z=-245-Math.random()*18;pickup.position.x=[-3.6,0,3.6][Math.floor(Math.random()*3)];
    pickup.rotation.y=0;beep(760);
    if(sound&&audio){try{const o=audio.createOscillator(),g=audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(180,audio.currentTime);o.frequency.exponentialRampToValueAtTime(850,audio.currentTime+.28);g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.11,audio.currentTime+.025);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.34);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.35);}catch{}}
  }
  function draw(){
    const playerX=steer*4.35;
    const slide=driftAmount*(steer<0?1:-1)*.52;
    player.position.x+=(playerX+slide-player.position.x)*.16;
    player.rotation.z=-steer*.08-driftAmount*steer*.055;
    player.rotation.y=-steer*.12-driftAmount*steer*.09;
    for(const wheel of player.userData.wheels){wheel.rotation.x+=speed*.00025;if(wheel.position.z<0)wheel.rotation.y=steer*.22;}
    for(const hub of player.userData.hubs){hub.rotation.x+=speed*.00025;if(hub.position.z<0)hub.rotation.y=steer*.22;}
    for(const wheel of rival.userData.wheels)wheel.rotation.x+=speed*.00018;for(const hub of rival.userData.hubs)hub.rotation.x+=speed*.00018;
    rival.position.x=-2.8+Math.sin(progress*.013)*.8;
    const gap=rivalProgress-progress;
    rival.position.z=-Math.max(9,Math.min(75,18+gap*.12));
    camera.position.x+=(player.position.x*.48-camera.position.x)*.06;
    camera.position.y=5.0+(nitro>0?.12:0);
    camera.lookAt(player.position.x*.35,1.0,-16);
    // Recycle lane marks and roadside models toward the camera for continuous travel.
    const movement=speed*.00125;
    for(const m of laneMarks){m.position.z+=movement;if(m.position.z>12)m.position.z-=260;}
    for(const o of roadside){o.group.position.z+=movement;if(o.group.position.z>18){o.group.position.z-=260;o.z=o.group.position.z;}}
    for(const p of nitroPickups){p.position.z+=movement;p.rotation.y+=.035;p.position.y=.95+Math.sin(performance.now()*.004+p.position.x)*.12;if(p.position.z>2){p.position.z=-245-Math.random()*18;p.position.x=[-3.6,0,3.6][Math.floor(Math.random()*3)];}else if(p.position.z>-.9&&p.position.z<1.5&&Math.abs(p.position.x-player.position.x)<1.65){collectNitro(p);}}
    if(nitro>0){
      // Quick FOV kick conveys speed without making the phone camera unstable.
      camera.fov=THREE.MathUtils.lerp(camera.fov,68,.12);
    }else camera.fov=THREE.MathUtils.lerp(camera.fov,62,.08);
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
    if(!running){draw();return;}
    const dt=Math.min(40,t-last||16);last=t;const sec=dt/1000;
    if(nitro>0)nitro=Math.max(0,nitro-sec);
    const boosting=nitro>0,target=braking?88:(boosting?245:198);
    speed+=(target-speed)*Math.min(1,sec*2.4);
    const hardTurn=Math.abs(steer)>.56&&speed>125&&!braking;
    driftAmount+=((hardTurn?1:0)-driftAmount)*Math.min(1,sec*(hardTurn?4.5:2.2));
    if(hardTurn&&Math.random()<.72)emitSmoke();
    updateSmoke(sec);
    progress+=speed*sec*.080;
    rivalBoost=Math.max(0,rivalBoost-sec);if(rivalBoost<=0&&Math.random()<.045)rivalBoost=1.1;
    rivalProgress+=sec*(rivalBoost>0?18.8:16.2);
    if(keys.left)steer=Math.max(-1,steer-sec*1.7);else if(keys.right)steer=Math.min(1,steer+sec*1.7);else steer*=Math.pow(.91,sec*60);
    $('score').textContent=Math.min(100,Math.floor(progress/10))+'%';$('speed').textContent=Math.round(speed)+' km/h';
    draw();
    if(progress>=1000){finish(progress>=rivalProgress);return;}
    if(rivalProgress>=1000){finish(false);return;}
    requestAnimationFrame(frame);
  }
  function start(){
    running=true;progress=0;rivalProgress=0;speed=0;steer=0;nitro=0;rivalBoost=0;braking=false;driftAmount=0;last=0;keys={};
    nitroPickups.forEach((p,i)=>{p.position.set([-3.6,0,3.6,0,-3.6][i],.95,-34-i*43);});
    for(const p of smoke){p.life=0;p.mesh.visible=false;}
    $('score').textContent='0%';$('speed').textContent='0 km/h';$('overlay').hidden=true;beep(720);requestAnimationFrame(frame);
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
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'🔊 SOUND: ON':'🔊 SOUND: OFF';if(sound){ensureAudio();beep(600);}else if(audioRig&&audio){audioRig.engineGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.harmonicGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.windGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);audioRig.tireGain.gain.setTargetAtTime(.0001,audio.currentTime,.04);}});
  window.addEventListener('resize',resize);
  resize();draw();
  // If WebGL is unavailable, show a clear message instead of a blank game panel.
  window.addEventListener('unhandledrejection',e=>{console.error('3D racing failed to load',e.reason);});
})();
