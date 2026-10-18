(()=> {
  const $ = id => document.getElementById(id);
  const canvas = $('track'), ctx = canvas.getContext('2d');
  const token = new URLSearchParams(location.search).get('token');
  if (token) {
    $('lobby').href = '/live-games?token=' + encodeURIComponent(token);
    const mp = $('multiplayer'); if (mp) mp.href = '/neon-racing-multiplayer?token=' + encodeURIComponent(token);
  }
  let running=false, sound=false, audio=null, last=0, progress=0, rivalProgress=0, speed=0, steer=0, nitro=0, braking=false, keys={};
  let best=Number(localStorage.getItem('jojoworldNeonRacingBest')||0);
  $('best').textContent=best;
  function resize(){const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1;canvas.width=Math.max(300,Math.floor(r.width*d));canvas.height=Math.max(300,Math.floor(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw();}
  function beep(f=500){if(!sound)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.value=.035;o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.09)}catch{}}
  function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
  function car(x,y,w,h,body,accent,front=false){
    ctx.save();ctx.translate(x,y);
    ctx.shadowColor=accent;ctx.shadowBlur=13;
    // low, wide sports-car silhouette with wheels and glass
    poly([[-w*.43,-h*.18],[-w*.34,-h*.43],[-w*.18,-h*.53],[w*.18,-h*.53],[w*.34,-h*.43],[w*.43,-h*.18],[w*.47,h*.32],[w*.34,h*.46],[-w*.34,h*.46],[-w*.47,h*.32]],body,accent);
    ctx.shadowBlur=0;
    poly([[-w*.25,-h*.24],[-w*.14,-h*.43],[w*.14,-h*.43],[w*.25,-h*.24]],'#172c4c','#6ffaff');
    ctx.fillStyle=front?'#fff6c2':'#ff466d';ctx.fillRect(-w*.34,front?h*.27:-h*.22,w*.17,h*.07);ctx.fillRect(w*.17,front?h*.27:-h*.22,w*.17,h*.07);
    ctx.fillStyle='#050812';ctx.fillRect(-w*.47,-h*.12,w*.12,h*.28);ctx.fillRect(w*.35,-h*.12,w*.12,h*.28);
    ctx.restore();
  }
  function draw(){
    const w=canvas.clientWidth||360,h=canvas.clientHeight||360;ctx.clearRect(0,0,w,h);
    const horizon=h*.22;
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#090d25');sky.addColorStop(.55,'#24205a');sky.addColorStop(1,'#080b16');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    // skyline and distant glow
    ctx.fillStyle='#101630';
    for(let i=0;i<16;i++){const bw=w/13, bx=(i*w/13)-((progress*.03)%bw), bh=18+((i*37)%48);ctx.fillRect(bx,horizon-bh,bw*.7,bh);ctx.fillStyle=i%2?'#6efaff':'#ff65d8';for(let j=0;j<3;j++)ctx.fillRect(bx+4+j*6,horizon-bh+6,2,3);ctx.fillStyle='#101630';}
    const curve=Math.sin(progress*.004)*w*.045;
    const topL=w*.39+curve,topR=w*.61+curve,botL=-w*.1+curve*.3,botR=w*1.1+curve*.3;
    poly([[topL,horizon],[topR,horizon],[botR,h],[botL,h]],'#202941');
    poly([[topL,horizon],[topL+3,horizon],[botL+8,h],[botL,h]],'#4ff9ff');
    poly([[topR-3,horizon],[topR,horizon],[botR,h],[botR-8,h]],'#ff57d5');
    // road surface sheen
    const road=ctx.createLinearGradient(0,horizon,0,h);road.addColorStop(0,'#303754');road.addColorStop(1,'#11192b');poly([[topL+4,horizon],[topR-4,horizon],[botR-8,h],[botL+8,h]],road);
    // lane markers scroll smoothly with speed
    const phase=(progress*1.8)%70;
    for(let y=horizon+phase;y<h;y+=70){const p=(y-horizon)/(h-horizon),half=(topR-topL)/2+(w*.5)*(p),center=w/2+curve*(1-p);ctx.strokeStyle='#9ba8c8';ctx.globalAlpha=.45;ctx.lineWidth=1+p*2;ctx.beginPath();ctx.moveTo(center-w*.12*p,y);ctx.lineTo(center-w*.12*p,y+18*p+4);ctx.moveTo(center+w*.12*p,y);ctx.lineTo(center+w*.12*p,y+18*p+4);ctx.stroke();ctx.globalAlpha=1;}
    // speed streaks during nitro
    if(nitro>0){ctx.strokeStyle='#72faff';ctx.globalAlpha=.4;for(let i=0;i<12;i++){let x=(i*47+progress*3)%w,y=h*.35+(i*31)% (h*.55);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+28);ctx.stroke()}ctx.globalAlpha=1;}
    // rival car appears ahead and grows as the player catches up
    const gap=rivalProgress-progress,ry=horizon+Math.max(.04,Math.min(.78,.25-gap/850))*(h-horizon);
    const rivalX=w*.5+curve*.45-w*.16;
    if(gap>-230&&gap<850)car(rivalX,ry,Math.max(24,w*.105*(.5+ry/h)),Math.max(38,h*.13*(.45+ry/h)),'#b83cff','#ff65dc',false);
    // player's sports car
    const px=w*.5+steer*w*.24+curve*.35, py=h*.83;
    car(px,py,w*.25,h*.24,nitro>0?'#35dfff':'#20c9d9','#79ffff',true);
    // HUD on canvas
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 10px system-ui';ctx.fillText('JOJOWORLD NIGHT CIRCUIT',w/2,16);
    ctx.textAlign='left';ctx.fillStyle='#8cfff7';ctx.font='800 10px system-ui';ctx.fillText('YOU',12,h-12);ctx.textAlign='right';ctx.fillStyle='#ff85e6';ctx.fillText('RIVAL',w-12,h-12);
  }
  function finish(won){running=false;if(won&&progress>best){best=Math.floor(progress);localStorage.setItem('jojoworldNeonRacingBest',String(best));$('best').textContent=best;}$('overlay').hidden=false;$('overlayTitle').textContent=won?'🏁 YOU WIN!':'🏁 RACE FINISHED';$('overlayText').textContent=(won?'You crossed the finish line first!':'Your rival reached the finish line first.')+' Final progress: '+Math.floor(progress)+' m. No obstacles, no coins required.';$('start').textContent='RACE AGAIN';beep(won?880:260);}
  function frame(t){if(!running){draw();return;}const dt=Math.min(40,t-last||16);last=t;
    const boosting=(keys.nitro||nitro>0);if(nitro>0)nitro=Math.max(0,nitro-dt*.00065);
    const target=braking?95:(boosting?275:205);speed+=(target-speed)*Math.min(1,dt*.0024);
    progress+=speed*dt*.00105;rivalProgress+=speed*dt*(progress>rivalProgress+100?.00091:.00099);
    if(keys.left)steer=Math.max(-1,steer-dt*.0028);else if(keys.right)steer=Math.min(1,steer+dt*.0028);else steer*=Math.pow(.94,dt/16);
    $('score').textContent=Math.min(100,Math.floor(progress/12))+'%';$('speed').textContent=Math.round(speed)+' km/h';
    draw();if(progress>=1200){finish(progress>=rivalProgress);return;}if(rivalProgress>=1200){finish(false);return;}requestAnimationFrame(frame);
  }
  function start(){running=true;progress=0;rivalProgress=0;speed=0;steer=0;nitro=0;braking=false;last=0;keys={};$('score').textContent='0%';$('speed').textContent='0 km/h';$('overlay').hidden=true;beep(720);requestAnimationFrame(frame);}
  function hold(id,key){const b=$(id);if(!b)return;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[key]=true;if(key==='nitro')nitro=1.8;if(key==='brake')braking=true;});['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>{keys[key]=false;if(key==='brake')braking=false;}));}
  hold('left','left');hold('right','right');hold('nitro','nitro');hold('brake','brake');
  window.addEventListener('keydown',e=>{if(['ArrowLeft','a','A'].includes(e.key)){keys.left=true;e.preventDefault();}if(['ArrowRight','d','D'].includes(e.key)){keys.right=true;e.preventDefault();}if(e.code==='Space'){keys.nitro=true;nitro=1.8;e.preventDefault();}if(['ArrowDown','s','S'].includes(e.key)){braking=true;e.preventDefault();}});
  window.addEventListener('keyup',e=>{if(['ArrowLeft','a','A'].includes(e.key))keys.left=false;if(['ArrowRight','d','D'].includes(e.key))keys.right=false;if(e.code==='Space')keys.nitro=false;if(['ArrowDown','s','S'].includes(e.key))braking=false;});
  $('start').addEventListener('click',start);$('restart').addEventListener('click',start);
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'🔊 SOUND: ON':'🔊 SOUND: OFF';beep(600);});
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();draw();
})();