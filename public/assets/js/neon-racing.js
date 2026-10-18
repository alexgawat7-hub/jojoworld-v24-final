(()=> {
  const $ = id => document.getElementById(id);
  const canvas = $('track'), ctx = canvas.getContext('2d');
  const token = new URLSearchParams(location.search).get('token');
  if (token) {
    $('lobby').href = '/live-games?token=' + encodeURIComponent(token);
    const mp = $('multiplayer'); if (mp) mp.href = '/neon-racing-multiplayer?token=' + encodeURIComponent(token);
  }
  let running=false, sound=false, audio=null, last=0, progress=0, rivalProgress=0, speed=0, steer=0, nitro=0, nitroCooldown=0, rivalBoost=0, braking=false, keys={};
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
    const w=canvas.clientWidth||360,h=canvas.clientHeight||360;
    ctx.clearRect(0,0,w,h);
    const horizon=h*.27;
    // Cinematic dusk sky, distant haze and city glow.
    const sky=ctx.createLinearGradient(0,0,0,horizon+35);
    sky.addColorStop(0,'#111a2d');sky.addColorStop(.55,'#47516a');sky.addColorStop(1,'#d18a70');
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon+40);
    const glow=ctx.createRadialGradient(w*.52,horizon*.82,2,w*.52,horizon*.82,w*.55);
    glow.addColorStop(0,'rgba(255,190,130,.32)');glow.addColorStop(1,'rgba(255,190,130,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,horizon+50);
    // Distant layered city skyline.
    for(let layer=0;layer<2;layer++){
      const shift=(progress*(layer?.045:.018))%(w*.22);
      for(let i=-2;i<12;i++){
        const bw=w/(layer?10:13),x=i*bw-shift+(layer?8:0);
        const bh=(layer?18:12)+((i*29+90)% (layer?48:30));
        ctx.fillStyle=layer?'#263247':'#374056';
        ctx.fillRect(x,horizon-bh,bw*.78,bh);
        if(layer){ctx.fillStyle='rgba(244,193,143,.48)';for(let yy=horizon-bh+7;yy<horizon-5;yy+=10)for(let xx=x+5;xx<x+bw*.68;xx+=9)if(((Math.floor(xx)+Math.floor(yy))%3)!==0)ctx.fillRect(xx,yy,2,3);}
      }
    }
    // Shoulder terrain, grass and roadside concrete.
    ctx.fillStyle='#242f32';ctx.fillRect(0,horizon,w,h-horizon);
    const curve=Math.sin(progress*.0022)*w*.035;
    const center=w*.5+curve;
    const topHalf=w*.105, bottomHalf=w*.62;
    const leftTop=center-topHalf,rightTop=center+topHalf,leftBottom=center-bottomHalf,rightBottom=center+bottomHalf;
    // Road shoulder and asphalt.
    poly([[leftTop-9,horizon],[rightTop+9,horizon],[rightBottom+25,h],[leftBottom-25,h]],'#6b6e6d');
    poly([[leftTop,horizon],[rightTop,horizon],[rightBottom,h],[leftBottom,h]],'#303438');
    // Subtle asphalt variation strips and grain that moves toward the player.
    for(let i=0;i<95;i++){
      const seed=(i*73.17)%1, depth=((i*37.31+progress*.11)%100)/100;
      const y=horizon+Math.pow(depth,1.7)*(h-horizon);
      const half=topHalf+(bottomHalf-topHalf)*((y-horizon)/(h-horizon));
      const x=center-half+seed*half*2;
      ctx.fillStyle=i%3?'rgba(220,225,220,.07)':'rgba(8,12,16,.16)';
      ctx.fillRect(x,y,1+depth*2,1+depth*1.5);
    }
    // Road edge rumble strips and reflective shoulder markers.
    const phase=(progress*2.7)%34;
    for(let y=horizon+phase;y<h+34;y+=34){
      const p=Math.max(0,Math.min(1,(y-horizon)/(h-horizon)));
      const half=topHalf+(bottomHalf-topHalf)*p;
      const stripW=2+p*8;
      ctx.fillStyle=(Math.floor((y-phase)/34)%2===0)?'#d7d4c8':'#a84d46';
      ctx.fillRect(center-half-stripW,y,stripW,Math.max(2,p*16));
      ctx.fillRect(center+half,y,stripW,Math.max(2,p*16));
    }
    // Solid edge lines.
    ctx.strokeStyle='#e6e1d4';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(leftTop+2,horizon);ctx.lineTo(leftBottom+5,h);ctx.moveTo(rightTop-2,horizon);ctx.lineTo(rightBottom-5,h);ctx.stroke();
    // Three properly perspective-scaled dashed lane dividers.
    const dashPhase=(progress*2.9)%68;
    for(let y=horizon+dashPhase;y<h+70;y+=68){
      const p=Math.max(0,Math.min(1,(y-horizon)/(h-horizon)));
      const half=topHalf+(bottomHalf-topHalf)*p;
      const dashH=5+p*24, lineW=.7+p*2.1;
      ctx.strokeStyle='rgba(238,238,226,.82)';ctx.lineWidth=lineW;
      for(const lane of [-1/3,1/3]){
        const x=center+half*lane*2;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+dashH);ctx.stroke();
      }
    }
    // Roadside guardrails with posts, shrinking toward the horizon.
    for(let side of [-1,1]){
      for(let y=horizon+((progress*2.1)%48);y<h+48;y+=48){
        const p=Math.max(0,Math.min(1,(y-horizon)/(h-horizon)));
        const half=topHalf+(bottomHalf-topHalf)*p;
        const x=center+side*(half+7+p*13);
        const postH=3+p*18;
        ctx.fillStyle='#9ba4a8';ctx.fillRect(x-p*2,y-postH*.2,p*4+1,postH);
        ctx.fillStyle='#c0c6c8';ctx.fillRect(x-p*3,y-postH*.55,p*6+2,Math.max(2,p*3));
      }
    }
    // Street lamps and trees/buildings scroll past to create depth and speed.
    for(let side of [-1,1]){
      for(let i=0;i<7;i++){
        const z=((i/7+((progress*.00075)%1))%1);
        const p=z*z;
        const y=horizon+p*(h-horizon);
        const half=topHalf+(bottomHalf-topHalf)*p;
        const x=center+side*(half+18+p*w*.25);
        const scale=.15+p*1.4;
        // Low-rise blocks behind the shoulder.
        if(i%2===0){
          const bw=(13+((i*11)%13))*scale,bh=(24+((i*17)%25))*scale;
          ctx.fillStyle=i%3===0?'#27313c':'#303a45';
          ctx.fillRect(x-bw/2,y-bh,bw,bh);
          ctx.fillStyle='rgba(244,190,128,.55)';
          for(let wy=y-bh+4*scale;wy<y-4*scale;wy+=7*scale)ctx.fillRect(x-bw*.25,wy,Math.max(1,2*scale),Math.max(1,2*scale));
        } else {
          // Tree silhouette on the outer verge.
          ctx.fillStyle='#293d37';ctx.fillRect(x-1.5*scale,y-12*scale,3*scale,12*scale);
          ctx.beginPath();ctx.moveTo(x,y-29*scale);ctx.lineTo(x-10*scale,y-9*scale);ctx.lineTo(x+10*scale,y-9*scale);ctx.closePath();ctx.fill();
          ctx.fillStyle='#334b40';ctx.beginPath();ctx.moveTo(x,y-22*scale);ctx.lineTo(x-8*scale,y-5*scale);ctx.lineTo(x+8*scale,y-5*scale);ctx.closePath();ctx.fill();
        }
        // Warm overhead streetlamp with subtle bloom.
        const poleX=x+side*10*scale;
        ctx.strokeStyle='#252c32';ctx.lineWidth=Math.max(1,2*scale);
        ctx.beginPath();ctx.moveTo(poleX,y);ctx.lineTo(poleX,y-40*scale);ctx.lineTo(poleX-side*9*scale,y-43*scale);ctx.stroke();
        ctx.fillStyle='rgba(255,207,133,'+(0.15+p*.45)+')';ctx.beginPath();ctx.arc(poleX-side*9*scale,y-42*scale,Math.max(1,5*scale),0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ffe4ae';ctx.beginPath();ctx.arc(poleX-side*9*scale,y-42*scale,Math.max(.7,1.5*scale),0,Math.PI*2);ctx.fill();
      }
    }
    // Nitro streaks stay restrained, without covering the road.
    if(nitro>0){
      ctx.strokeStyle='rgba(130,225,255,.38)';ctx.lineWidth=1;
      for(let i=0;i<18;i++){const x=(i*47+progress*3)%w,y=h*.38+(i*31)%(h*.48);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5,y+18);ctx.stroke();}
    }
    // Rival vehicle, scaled by perspective and relative distance.
    const gap=rivalProgress-progress,ry=horizon+Math.max(.04,Math.min(.78,.25-gap/850))*(h-horizon);
    const rivalX=center-w*.16;
    if(gap>-230&&gap<850)car(rivalX,ry,Math.max(24,w*.105*(.5+ry/h)),Math.max(38,h*.13*(.45+ry/h)),'#9e2735','#ffb16a',false);
    // Player vehicle.
    const px=center+steer*w*.22,py=h*.83;
    car(px,py,w*.25,h*.24,nitro>0?'#c7d9e0':'#bfcbd2',nitro>0?'#b5f5ff':'#f1f5f7',true);
    // Small in-world overhead sign adds scale and a believable circuit cue.
    ctx.fillStyle='#18232b';ctx.fillRect(w*.72,horizon-25,Math.max(36,w*.17),13);
    ctx.strokeStyle='#a9b3b7';ctx.lineWidth=1;ctx.strokeRect(w*.72,horizon-25,Math.max(36,w*.17),13);
    ctx.fillStyle='#e7e8dd';ctx.textAlign='center';ctx.font='700 7px system-ui';ctx.fillText('NIGHT CIRCUIT',w*.805,horizon-16);
    // Minimal race HUD.
    ctx.fillStyle='rgba(9,15,22,.58)';ctx.fillRect(8,7,Math.min(150,w*.42),19);
    ctx.fillStyle='#f2f4f1';ctx.textAlign='left';ctx.font='800 9px system-ui';ctx.fillText('JOJOWORLD  /  STREET RUN',14,20);
  }
  function finish(won){running=false;if(won&&progress>best){best=Math.floor(progress);localStorage.setItem('jojoworldNeonRacingBest',String(best));$('best').textContent=best;}$('overlay').hidden=false;$('overlayTitle').textContent=won?'🏁 YOU WIN!':'🏁 RACE FINISHED';$('overlayText').textContent=(won?'You crossed the finish line first!':'Your rival reached the finish line first.')+' Race distance: 1,000 m. Your finish: '+Math.floor(progress)+' m. No obstacles, no coins required.';$('start').textContent='RACE AGAIN';beep(won?880:260);}
  function frame(t){if(!running){draw();return;}const dt=Math.min(40,t-last||16);last=t;
    nitroCooldown=Math.max(0,nitroCooldown-dt/1000);if(nitro>0)nitro=Math.max(0,nitro-dt/1000);
    if(keys.nitro&&nitro<=0&&nitroCooldown<=0){nitro=1.5;nitroCooldown=7;beep(980);}
    const boosting=nitro>0;const target=braking?105:(boosting?275:205);speed+=(target-speed)*Math.min(1,dt*.0024);
    progress+=speed*dt*.000075;
    rivalBoost=Math.max(0,rivalBoost-dt/1000);if(rivalBoost<=0&&Math.random()<.003)rivalBoost=1.2;
    rivalProgress+=dt*(rivalBoost>0?.0182:.0157);
    if(keys.left)steer=Math.max(-1,steer-dt*.0028);else if(keys.right)steer=Math.min(1,steer+dt*.0028);else steer*=Math.pow(.94,dt/16);
    $('score').textContent=Math.min(100,Math.floor(progress/10))+'%';$('speed').textContent=Math.round(speed)+' km/h';
    draw();if(progress>=1000){finish(progress>=rivalProgress);return;}if(rivalProgress>=1000){finish(false);return;}requestAnimationFrame(frame);
  }
  function start(){running=true;progress=0;rivalProgress=0;speed=0;steer=0;nitro=0;nitroCooldown=0;rivalBoost=0;braking=false;last=0;keys={};$('score').textContent='0%';$('speed').textContent='0 km/h';$('overlay').hidden=true;beep(720);requestAnimationFrame(frame);}
  function hold(id,key){const b=$(id);if(!b)return;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[key]=true;if(key==='nitro'&&nitroCooldown<=0&&nitro<=0){nitro=1.5;nitroCooldown=7;beep(980);}if(key==='brake')braking=true;});['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>{keys[key]=false;if(key==='brake')braking=false;}));}
  hold('left','left');hold('right','right');hold('nitro','nitro');hold('brake','brake');
  window.addEventListener('keydown',e=>{if(['ArrowLeft','a','A'].includes(e.key)){keys.left=true;e.preventDefault();}if(['ArrowRight','d','D'].includes(e.key)){keys.right=true;e.preventDefault();}if(e.code==='Space'){keys.nitro=true;e.preventDefault();}if(['ArrowDown','s','S'].includes(e.key)){braking=true;e.preventDefault();}});
  window.addEventListener('keyup',e=>{if(['ArrowLeft','a','A'].includes(e.key))keys.left=false;if(['ArrowRight','d','D'].includes(e.key))keys.right=false;if(e.code==='Space')keys.nitro=false;if(['ArrowDown','s','S'].includes(e.key))braking=false;});
  $('start').addEventListener('click',start);$('restart').addEventListener('click',start);
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'🔊 SOUND: ON':'🔊 SOUND: OFF';beep(600);});
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();draw();
})();