const $=id=>document.getElementById(id);
const field=$('field'),overlay=$('overlay'),timeEl=$('time'),scoreEl=$('score'),bestEl=$('best'),statusEl=$('status');
let running=false,score=0,endsAt=0,timer=null,spawnTimer=null,soundOn=false,audio=null;
let pixiApp=null,targetGraphics=null,targetVisual=null;
const bestKey='jojoworld-neon-tap-rush-best-v1';
let best=0;try{best=Number(localStorage.getItem(bestKey)||0)||0}catch(_){}
bestEl.textContent=best;
const token=new URLSearchParams(location.search).get('token')||'';
if(token){$('back').href='/live-games?token='+encodeURIComponent(token)}
function initPixiTargets(){
  if(!window.PIXI)return;
  try{
    pixiApp=new PIXI.Application({resizeTo:field,backgroundAlpha:0,antialias:true,autoDensity:true,resolution:Math.min(window.devicePixelRatio||1,2),powerPreference:'high-performance'});
    pixiApp.view.className='tap-rush-pixi';
    pixiApp.view.setAttribute('aria-hidden','true');
    field.prepend(pixiApp.view);
    targetGraphics=new PIXI.Graphics();
    pixiApp.stage.addChild(targetGraphics);
    field.classList.add('pixi-ready');
    pixiApp.ticker.add(()=>drawPixiTarget());
  }catch(err){console.error('[NEON TAP RUSH PIXI] initialization failed',err);if(pixiApp){pixiApp.destroy(true,{children:true});pixiApp=null}}
}
function drawPixiTarget(){
  if(!targetGraphics)return;
  const g=targetGraphics;g.clear();
  if(!targetVisual||!running)return;
  const {x,y,size,bonus}=targetVisual;
  const pulse=1+Math.sin((pixiApp.ticker.lastTime||0)*.008)*.055;
  const r=size*.5*pulse;
  const core=bonus?0xffd986:0x75fff1,outer=bonus?0xff78d7:0x27bdf0;
  g.beginFill(outer,.09);g.drawCircle(x,y,r+15);g.endFill();
  g.beginFill(outer,.14);g.drawCircle(x,y,r+8);g.endFill();
  g.lineStyle(2,outer,.75);g.drawCircle(x,y,r+3);
  g.beginFill(core,1);g.drawCircle(x,y,r);g.endFill();
  g.beginFill(0xffffff,.85);g.drawCircle(x-r*.22,y-r*.28,r*.38);g.endFill();
  g.lineStyle(2,0xffffff,.65);g.drawCircle(x,y,r*.68);
  if(bonus){g.lineStyle(2,0xfff4c9,.95);g.moveTo(x-r*.32,y);g.lineTo(x+r*.32,y);g.moveTo(x,y-r*.32);g.lineTo(x,y+r*.32)}
}
initPixiTargets();
function beep(freq=640,duration=.045,kind='tap'){if(!soundOn)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const now=audio.currentTime;const hit=(len,vol,hz)=>{const size=Math.max(1,Math.floor(audio.sampleRate*len)),buf=audio.createBuffer(1,size,audio.sampleRate),d=buf.getChannelData(0);for(let i=0;i<size;i++)d[i]=(Math.random()*2-1)*(1-i/size);const src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();src.buffer=buf;f.type='bandpass';f.frequency.value=hz;g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(vol,now+.003);g.gain.exponentialRampToValueAtTime(.0001,now+len);src.connect(f);f.connect(g);g.connect(audio.destination);src.start();src.stop(now+len)};const o=audio.createOscillator(),g=audio.createGain();o.type=kind==='miss'?'triangle':'sine';o.frequency.setValueAtTime(kind==='miss'?freq:freq*.72,now);o.frequency.exponentialRampToValueAtTime(kind==='bonus'?freq*1.8:freq*.94,now+duration);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(kind==='bonus'?.06:.04,now+.004);g.gain.exponentialRampToValueAtTime(.0001,now+duration+.02);o.connect(g);g.connect(audio.destination);o.start();o.stop(now+duration+.03);hit(kind==='miss'?.09:.035,kind==='bonus'?.045:.022,kind==='miss'?280:kind==='bonus'?2800:1600);if(kind==='bonus'){const bell=audio.createOscillator(),bg=audio.createGain();bell.type='triangle';bell.frequency.setValueAtTime(1350,now+.015);bg.gain.setValueAtTime(.0001,now+.015);bg.gain.exponentialRampToValueAtTime(.035,now+.025);bg.gain.exponentialRampToValueAtTime(.0001,now+.2);bell.connect(bg);bg.connect(audio.destination);bell.start(now+.015);bell.stop(now+.21)}}catch(_){}}
function spawnTarget(){
  if(!running)return;
  field.querySelectorAll('.target').forEach(n=>n.remove());
  const bonus=Math.random()<.17,button=document.createElement('button');
  button.type='button';button.className='target';button.setAttribute('aria-label',bonus?'Bonus target, three points':'Target, one point');button.textContent=bonus?'✦':'●';
  const rect=field.getBoundingClientRect(),size=Math.min(66,Math.max(42,rect.height*.105));
  const left=Math.max(4,Math.random()*(rect.width-size-8)),top=Math.max(4,Math.random()*(rect.height-size-8));
  button.style.left=left+'px';button.style.top=top+'px';button.style.width=size+'px';button.style.height=size+'px';
  targetVisual={x:left+size/2,y:top+size/2,size,bonus};
  button.addEventListener('click',e=>{e.stopPropagation();if(!running)return;score+=bonus?3:1;scoreEl.textContent=score;beep(bonus?900:620,.055,bonus?'bonus':'tap');if(navigator.vibrate)navigator.vibrate(10);spawnTarget()});
  field.appendChild(button);
}
function endGame(){running=false;clearInterval(timer);clearTimeout(spawnTimer);field.querySelectorAll('.target').forEach(n=>n.remove());targetVisual=null;statusEl.textContent='FINISHED';if(score>best){best=score;bestEl.textContent=best;try{localStorage.setItem(bestKey,String(best))}catch(_){}}$('overlayTitle').textContent=score>=45?'Incredible reflexes!':score>=25?'Nice run!':'Challenge complete';$('overlayText').textContent='Final score: '+score+'. Personal best: '+best+'. Try again to beat it.';$('start').textContent='PLAY AGAIN';overlay.classList.remove('hidden');beep(420,.12,'miss')}
function startGame(){clearInterval(timer);clearTimeout(spawnTimer);field.querySelectorAll('.target').forEach(n=>n.remove());score=0;scoreEl.textContent='0';running=true;endsAt=Date.now()+30000;statusEl.textContent='PLAYING';overlay.classList.add('hidden');spawnTarget();timer=setInterval(()=>{const left=Math.max(0,endsAt-Date.now());timeEl.textContent=(left/1000).toFixed(1);if(left<=0){timeEl.textContent='0.0';endGame()}},50)}
$('start').addEventListener('click',startGame);$('restart').addEventListener('click',()=>{if(running)endGame();timeEl.textContent='30.0';$('overlayTitle').textContent='Ready, player?';$('overlayText').textContent='You have 30 seconds. Blue targets score 1 point. Gold targets score 3 points. Missed taps do not cost points.';$('start').textContent='START CHALLENGE';overlay.classList.remove('hidden');statusEl.textContent='READY'});$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').textContent=soundOn?'🔊 Sound: On':'🔊 Sound: Off';beep(720)});field.addEventListener('click',e=>{if(running&&!e.target.closest('.target'))beep(170,.045,'miss')});window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(spawnTimer);if(pixiApp){pixiApp.destroy(true,{children:true});pixiApp=null}});
