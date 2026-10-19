const $=id=>document.getElementById(id);
const token=new URLSearchParams(location.search).get('token')||'';
let pollTimer=null,matchId=null,searching=false,lastRound=0;
let battleSoundOn=false,battleAudio=null;
let battlePixi=null,battleFx=null,battleParticles=[];
function initBattlePixi(){
 const host=document.querySelector('.arena');
 if(!host||!window.PIXI)return;
 try{
  battlePixi=new PIXI.Application({resizeTo:host,backgroundAlpha:0,antialias:true,autoDensity:true,resolution:Math.min(window.devicePixelRatio||1,2),powerPreference:'high-performance'});
  battlePixi.view.className='neon-battle-pixi';battlePixi.view.setAttribute('aria-hidden','true');host.prepend(battlePixi.view);
  battleFx=new PIXI.Graphics();battlePixi.stage.addChild(battleFx);
  battlePixi.ticker.add((delta)=>drawBattleFx(delta));
 }catch(err){console.warn('[NEON BATTLE PIXI] initialization failed',err);if(battlePixi){battlePixi.destroy(true,{children:true});battlePixi=null}}
}
function battleBurst(kind='impact'){
 if(!battlePixi)return;
 const w=battlePixi.screen.width,h=battlePixi.screen.height;
 const color=kind==='attack'?0x78fff0:kind==='guard'?0x9bb8ff:kind==='dash'?0xff9bdd:0xffe29a;
 const cx=w*(kind==='dash'?.72:kind==='guard'?.5:.28),cy=h*.48;
 for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=1.5+Math.random()*4;battleParticles.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+Math.random()*.35,max:.8,color,size:1.5+Math.random()*3})}
}
function drawBattleFx(delta){
 if(!battleFx||!battlePixi)return;
 const g=battleFx;g.clear();const w=battlePixi.screen.width,h=battlePixi.screen.height,t=battlePixi.ticker.lastTime||0;
 g.lineStyle(1,0x78fff0,.09);g.drawCircle(w*.27,h*.48,22+Math.sin(t*.006)*3);g.lineStyle(1,0xff9bdd,.09);g.drawCircle(w*.73,h*.48,22+Math.cos(t*.006)*3);
 const dt=Math.min(.05,(delta||1)/60);
 battleParticles=battleParticles.filter(p=>p.life>0);
 for(const p of battleParticles){p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.life-=dt;g.beginFill(p.color,Math.max(0,p.life/p.max));g.drawCircle(p.x,p.y,p.size*Math.max(.2,p.life/p.max));g.endFill()}
}
initBattlePixi();
const battleSoundKey='jojoworldBattleSound';
try{battleSoundOn=localStorage.getItem(battleSoundKey)==='true'}catch(_){}
function renderBattleSound(){$('battleSound').textContent=battleSoundOn?'🔊 SOUND ON':'🔇 SOUND OFF';$('battleSound').setAttribute('aria-pressed',String(battleSoundOn))}
function battleSfx(kind='tap'){
 if(!battleSoundOn)return;
 try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!battleAudio)battleAudio=new AC();if(battleAudio.state==='suspended')battleAudio.resume();const now=battleAudio.currentTime;
 const noise=(len,vol,hz)=>{const n=Math.floor(battleAudio.sampleRate*len),b=battleAudio.createBuffer(1,n,battleAudio.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=battleAudio.createBufferSource(),f=battleAudio.createBiquadFilter(),g=battleAudio.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=hz;g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(vol,now+.004);g.gain.exponentialRampToValueAtTime(.0001,now+len);s.connect(f);f.connect(g);g.connect(battleAudio.destination);s.start();s.stop(now+len)};
 if(kind==='attack'){noise(.14,.09,650);const o=battleAudio.createOscillator(),g=battleAudio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(190,now);o.frequency.exponentialRampToValueAtTime(65,now+.13);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.055,now+.008);g.gain.exponentialRampToValueAtTime(.0001,now+.15);o.connect(g);g.connect(battleAudio.destination);o.start();o.stop(now+.16)}
 else if(kind==='guard'){noise(.11,.065,1900);const o=battleAudio.createOscillator(),g=battleAudio.createGain();o.type='triangle';o.frequency.setValueAtTime(880,now);o.frequency.exponentialRampToValueAtTime(240,now+.12);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.045,now+.004);g.gain.exponentialRampToValueAtTime(.0001,now+.14);o.connect(g);g.connect(battleAudio.destination);o.start();o.stop(now+.15)}
 else if(kind==='dash'){noise(.2,.05,1100);const o=battleAudio.createOscillator(),g=battleAudio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(700,now);o.frequency.exponentialRampToValueAtTime(170,now+.18);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.035,now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+.2);o.connect(g);g.connect(battleAudio.destination);o.start();o.stop(now+.21)}
 else{const ns=kind==='win'?[660,880,1100]:kind==='draw'?[440,554]:kind==='lose'?[300,210]:[520];ns.forEach((hz,i)=>{const o=battleAudio.createOscillator(),g=battleAudio.createGain(),t=now+i*.075;o.type='triangle';o.frequency.value=hz;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.05,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.connect(g);g.connect(battleAudio.destination);o.start(t);o.stop(t+.19)})}
 }catch(_){}
}
renderBattleSound();
$('battleSound').addEventListener('click',()=>{battleSoundOn=!battleSoundOn;try{localStorage.setItem(battleSoundKey,String(battleSoundOn))}catch(_){}renderBattleSound();if(battleSoundOn)battleSfx('tap')});
if(token)$('lobby').href='/live-games?token='+encodeURIComponent(token);
const api=async(path,body)=>{const options={method:body?'POST':'GET',headers:{'Content-Type':'application/json'},cache:'no-store'};if(body)options.body=JSON.stringify({...body,token});const response=await fetch(path+(body?'':'?token='+encodeURIComponent(token)),options);const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Neon Battle connection failed.');return data};
function message(text){$('notice').textContent=text;$('notice').hidden=false}
function setMoves(show,disabled=false){$('moves').hidden=!show;document.querySelectorAll('[data-move]').forEach(b=>b.disabled=disabled)}
function stopPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=null}
function resetArena(){matchId=null;lastRound=0;$('youHp').style.width='100%';$('opponentHp').style.width='100%';$('youHpText').textContent='100';$('opponentHpText').textContent='100';$('roundLabel').textContent='ROUND — / 5';$('roundResult').textContent='';$('youName').textContent='YOU';$('opponentName').textContent='RIVAL';setMoves(false)}
function beginPolling(){stopPolling();pollTimer=setInterval(refreshState,1100);refreshState()}
async function findRival(){if(!token){message('Open Game Lobby from Messenger to connect your JojoWorld account.');return}if(searching)return;searching=true;$('join').disabled=true;$('join').textContent='SEARCHING…';$('cancel').hidden=false;$('again').hidden=true;message('Looking for another player. Keep this page open…');try{const d=await api('/api/neon-battle/join',{});if(d.status==='matched'){matchId=d.matchId;searching=false;$('join').hidden=true;$('cancel').hidden=true;message('Rival found! Choose your move each round.');beginPolling()}else{message('You are in the queue. Waiting for another player to join…');beginPolling()}}catch(e){searching=false;$('join').disabled=false;$('join').textContent='⚡ FIND A RIVAL';$('cancel').hidden=true;message(e.message)}}
async function refreshState(){try{const d=await api('/api/neon-battle/state');if(d.status==='waiting'){searching=true;$('status').textContent='SEARCHING FOR RIVAL';$('join').hidden=true;$('cancel').hidden=false;return}if(d.status==='idle'){stopPolling();searching=false;$('join').hidden=false;$('join').disabled=false;$('join').textContent='⚡ FIND A RIVAL';$('cancel').hidden=true;return}matchId=d.matchId;searching=false;$('status').textContent=d.status==='finished'?'MATCH COMPLETE':d.status==='settling'?'CONFIRMING REWARD':'BATTLE IN PROGRESS';$('join').hidden=true;$('cancel').hidden=true;$('youName').textContent=d.you.name||'YOU';$('opponentName').textContent=d.opponent.name||'RIVAL';$('balance').textContent=Number(d.balance).toLocaleString('en-US');$('youHp').style.width=d.you.hp+'%';$('opponentHp').style.width=d.opponent.hp+'%';$('youHpText').textContent=d.you.hp;$('opponentHpText').textContent=d.opponent.hp;$('roundLabel').textContent='ROUND '+Math.min(d.roundNumber,5)+' / 5';if(d.lastRound&&d.lastRound.round>lastRound){lastRound=d.lastRound.round;$('roundResult').textContent=d.lastRound.message;battleSfx('impact');battleBurst('impact');const arena=document.querySelector('.arena');if(arena){arena.classList.remove('impact');void arena.offsetWidth;arena.classList.add('impact')}}if(d.status==='active'){setMoves(true,Boolean(d.youMoved));message(d.youMoved?'Move locked in! Waiting for your rival…':'Choose your move. Both moves are hidden until the round resolves.')}else if(d.status==='settling'){setMoves(false);message('Battle complete. Confirming coin rewards…')}else if(d.status==='finished'){setMoves(false);stopPolling();$('again').hidden=false;$('join').hidden=true;const result=d.winner==='draw'?'DRAW — +10 coins each':d.winner==='you'?'VICTORY! +20 coins':'DEFEAT — +5 participation coins';$('roundResult').textContent=result;battleSfx(d.winner==='draw'?'draw':d.winner==='you'?'win':'lose');message('Match finished. Rewards are added to your JojoWorld wallet.')} }catch(e){if(e.message.includes('expired')||e.message.includes('secure game session')){stopPolling();message(e.message)}else console.warn('[NEON BATTLE]',e.message)}}
async function submitMove(move){if(!matchId)return;setMoves(true,true);try{const d=await api('/api/neon-battle/move',{matchId,move});if(d.status==='waiting')message('Move locked in. Waiting for your rival…');await refreshState()}catch(e){message(e.message);setMoves(true,false)}}
document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>{battleSfx(b.dataset.move);battleBurst(b.dataset.move);submitMove(b.dataset.move)}));
$('join').addEventListener('click',findRival);
$('cancel').addEventListener('click',async()=>{try{await api('/api/neon-battle/leave',{});stopPolling();searching=false;$('join').hidden=false;$('join').disabled=false;$('join').textContent='⚡ FIND A RIVAL';$('cancel').hidden=true;message('Search cancelled.')}catch(e){message(e.message)}});
$('again').addEventListener('click',()=>{stopPolling();resetArena();$('join').hidden=false;$('join').disabled=false;$('join').textContent='⚡ FIND A RIVAL';$('again').hidden=true;$('status').textContent='READY TO FIGHT';findRival()});
window.addEventListener('pagehide',()=>{stopPolling();if(battlePixi){battlePixi.destroy(true,{children:true});battlePixi=null}});
if(!token){$('join').disabled=true;message('Open Game Lobby from Messenger to connect your secure account.')}
