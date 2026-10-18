const token=new URLSearchParams(location.search).get('token')||'';
const faces={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function drawDie(id,n){const el=document.getElementById(id);el.innerHTML='';for(let i=0;i<9;i++){const p=document.createElement('i');p.className='pip'+(faces[n].includes(i)?' on':'');el.appendChild(p)}}
drawDie('die1',3);drawDie('die2',5);
let bet=100,pred='ODD',rolling=false,accountConnected=false,accountLoading=false,resultUnconfirmed=false;
const soundKey='jojoworldArcadeSound';
let soundOn=false,audioCtx=null,rollTick=0;
function playSound(kind='tap'){
 if(!soundOn)return;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  if(!audioCtx)audioCtx=new AC();if(audioCtx.state==='suspended')audioCtx.resume();
  const now=audioCtx.currentTime;
  const noise=(duration,volume,filterHz=1500)=>{const size=Math.max(1,Math.floor(audioCtx.sampleRate*duration)),buffer=audioCtx.createBuffer(1,size,audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<size;i++)data[i]=(Math.random()*2-1)*(1-i/size);const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();src.buffer=buffer;filter.type='bandpass';filter.frequency.value=filterHz;filter.Q.value=.8;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.003);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);src.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);src.start(now);src.stop(now+duration)};
  if(kind==='tick'||kind==='tap'){noise(kind==='tick'?.05:.04,kind==='tick'?.045:.02,kind==='tick'?1900:1000);return}
  if(kind==='start'){noise(.48,.075,700);for(let i=0;i<5;i++){const t=now+i*.07,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.setValueAtTime(150+Math.random()*160,t);o.frequency.exponentialRampToValueAtTime(90,t+.07);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.055,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+.08);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+.085)}return}
  if(kind==='lose'){noise(.17,.07,380);return}
  const notes=kind==='win'?[660,880,1100]:[300,460];notes.forEach((freq,i)=>{const t=now+i*.08,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.065,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.19);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+.2)});noise(.07,.03,2400);
 }catch(_){}
}
try{soundOn=localStorage.getItem(soundKey)==='true'}catch(_){}
window.addEventListener('storage',e=>{if(e.key===soundKey)soundOn=e.newValue==='true'});
const lobbyLink=document.getElementById('lobbyLink'),coinShopLink=document.getElementById('coinShopLink');
if(token){lobbyLink.href='/live-games?token='+encodeURIComponent(token);if(coinShopLink)coinShopLink.href='/coin-shop?token='+encodeURIComponent(token)}
const recentRolls=[];
const money=n=>Number(n).toLocaleString('en-US');
function addRecent(total,won){
 recentRolls.unshift({total,won});
 if(recentRolls.length>8)recentRolls.pop();
 const holder=document.getElementById('recent');
 holder.innerHTML='';
 recentRolls.forEach(item=>{
  const chip=document.createElement('div');
  chip.className='recent-die'+(item.won?' win':'');
  chip.textContent=String(item.total);
  const small=document.createElement('small');small.textContent=item.won?'WIN':'NO WIN';
  chip.appendChild(small);holder.appendChild(chip);
 });
}
function updateBet(){document.getElementById('wager').textContent=(bet==='max'?'MAX':money(bet))+' coins'}
document.querySelectorAll('[data-bet]').forEach(b=>b.addEventListener('click',()=>{if(rolling)return;document.querySelectorAll('[data-bet]').forEach(x=>x.classList.toggle('active',x===b));bet=b.dataset.bet==='max'?'max':Number(b.dataset.bet);updateBet()}));
document.querySelectorAll('[data-pred]').forEach(b=>b.addEventListener('click',()=>{if(rolling)return;pred=b.dataset.pred;document.querySelectorAll('[data-pred]').forEach(x=>x.classList.toggle('active',x===b))}));
async function loadAccount({quiet=false}={}) {
  if(accountLoading)return;
  accountLoading=true;
  const rollButton=document.getElementById('roll');
  try {
    if(!token) {
      accountConnected=false;
      rollButton.disabled=true;
      if(!quiet)document.getElementById('result').innerHTML='OPEN FROM MESSENGER<small>Type DICE ARENA in JojoWorld Messenger to securely connect your account.</small>';
      return;
    }
    let data=null,lastError=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const r=await fetch('/api/dice-arena/session?token='+encodeURIComponent(token),{cache:'no-store'});
        const body=await r.json();
        if(!r.ok||!body.ok){const error=Error(body.error||'Session expired');error.status=r.status;throw error}
        data=body;break;
      }catch(error){
        lastError=error;
        if(error.status===400||error.status===401||error.status===403||error.status===404)break;
        if(attempt<2)await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));
      }
    }
    if(!data)throw lastError||new Error('Account session unavailable');
    document.getElementById('balance').textContent=money(data.balance)+' coins';
    applyStats(data.stats);
    if(resultUnconfirmed){accountConnected=false;document.querySelector('.demo').textContent='CHECK RESULT';return;}
    accountConnected=true;
    document.querySelector('.demo').innerHTML='<span class="live-dot"></span>LIVE ACCOUNT';
    if(!quiet&&!rolling)document.getElementById('result').innerHTML='READY TO ROLL<small>Account connected. Choose your bet and prediction.</small>';
  }catch(e){
    accountConnected=false;
    if(!quiet)document.getElementById('result').innerHTML='ACCOUNT NOT CONNECTED<small>'+String(e.message||'Session unavailable')+'. Reopen Dice Arena from JojoWorld Messenger to reconnect.</small>';
    document.querySelector('.demo').textContent='RECONNECT NEEDED';
  }finally{
    accountLoading=false;
    rollButton.disabled=rolling||!accountConnected;
  }
}
function applyStats(s){
  if(!s)return;
  document.getElementById('players').textContent=money(s.playerCount);
  document.getElementById('rolls').textContent=money(s.totalRolls);
  document.getElementById('totalbets').textContent=money(s.totalBet)+' coins';
  document.getElementById('payouts').textContent=money(s.totalPayout)+' coins';
  document.querySelector('.sub').textContent='ROUND #'+s.roundNumber+' • LIVE SHARED STATS';
}
document.getElementById('roll').addEventListener('click',async()=>{
  if(rolling||!token||!accountConnected)return;
  playSound('start');
  rolling=true;
  const btn=document.getElementById('roll'),area=document.getElementById('dicearea'),res=document.getElementById('result');
  let flicker=null;
  btn.disabled=true;area.classList.add('rolling');res.innerHTML='ROLLING...<small>Server is rolling your dice</small>';
  try{
    flicker=setInterval(()=>{drawDie('die1',1+Math.floor(Math.random()*6));drawDie('die2',1+Math.floor(Math.random()*6));if(++rollTick%2===0)playSound('tick')},120);
    const request=fetch('/api/dice-arena/roll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,bet,prediction:pred})});
    const response=await request;
    const data=await response.json();
    clearInterval(flicker);
    area.classList.remove('rolling');
    if(!response.ok||!data.ok){
      playSound('lose');
      if(data.balance!==undefined)document.getElementById('balance').textContent=money(data.balance)+' coins';
      res.classList.remove('win-result');res.classList.add('loss-result');res.innerHTML='ROLL NOT COMPLETED<small>'+String(data.error||'Please try again.')+'</small>';
      return;
    }
    resultUnconfirmed=false;
    playSound(data.won?'win':'lose');
    drawDie('die1',data.die1);drawDie('die2',data.die2);
    document.getElementById('balance').textContent=money(data.balance)+' coins';
    res.classList.remove('win-result','loss-result');res.classList.add(data.won?'win-result':'loss-result');res.innerHTML=(data.won?'🏆 WIN CONFIRMED':'🎲 TOTAL '+data.total+' • '+data.actual)+'<small>'+(data.won?'You won '+money(data.payout)+' coins · Stake '+money(data.bet):'No win this time · Stake '+money(data.bet)+' coins')+'</small>';res.classList.remove('reveal');void res.offsetWidth;res.classList.add('reveal');addRecent(data.total,data.won);
    if(data.stats)applyStats(data.stats);else refreshStats();
    btn.textContent='🎲 ROLL AGAIN';
  }catch(e){
    playSound('lose');
    if(flicker)clearInterval(flicker);
    area.classList.remove('rolling');
    resultUnconfirmed=true;accountConnected=false;res.classList.remove('win-result');res.classList.add('loss-result');res.innerHTML='ROLL RESULT UNCONFIRMED<small>Do not roll again yet. Reopen Dice Arena from JojoWorld Messenger to start a fresh session and check your balance.</small>';document.querySelector('.demo').textContent='CHECK RESULT';
  }finally{
    rolling=false;
    btn.disabled=!token||!accountConnected;
  }
});
async function refreshStats(){
  try{
    const response=await fetch('/api/dice-arena/stats',{cache:'no-store'});
    if(!response.ok)throw new Error('Stats unavailable');
    const s=await response.json();
    if(!s.ok)throw new Error('Stats unavailable');
    document.getElementById('players').textContent=money(s.playerCount);
    document.getElementById('rolls').textContent=money(s.totalRolls);
    document.getElementById('totalbets').textContent=money(s.totalBet)+' coins';
    document.getElementById('payouts').textContent=money(s.totalPayout)+' coins';
    document.querySelector('.sub').textContent='ROUND #'+s.roundNumber+' • LIVE SHARED STATS';
  }catch(_){
    document.querySelector('.sub').textContent='ROLL YOUR LUCK • SHARED STATS OFFLINE';
  }
}
loadAccount();
refreshStats();
setInterval(()=>{refreshStats();if(!rolling)loadAccount({quiet:true})},10000);
updateBet();
