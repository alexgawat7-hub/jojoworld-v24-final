const faces={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function drawDie(id,n){const el=document.getElementById(id);el.innerHTML='';for(let i=0;i<9;i++){const p=document.createElement('i');p.className='pip'+(faces[n].includes(i)?' on':'');el.appendChild(p)}}
drawDie('die1',3);drawDie('die2',5);
let bet=100,pred='ODD',rolling=false;
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
const token=new URLSearchParams(location.search).get('token')||'';
async function loadAccount(){
  if(!token){
    document.getElementById('result').innerHTML='OPEN FROM MESSENGER<small>Type DICE ARENA in JojoWorld Messenger to securely connect your account.</small>';
    document.getElementById('roll').disabled=true;
    return;
  }
  try{
    const r=await fetch('/api/dice-arena/session?token='+encodeURIComponent(token),{cache:'no-store'});
    const data=await r.json();
    if(!r.ok||!data.ok)throw new Error(data.error||'Session expired');
    document.getElementById('balance').textContent=money(data.balance)+' coins';
    document.querySelector('.demo').innerHTML='<span class="live-dot"></span>LIVE ACCOUNT';
    applyStats(data.stats);
  }catch(e){
    document.getElementById('result').innerHTML='ACCOUNT NOT CONNECTED<small>'+e.message+'</small>';
    document.getElementById('roll').disabled=true;
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
  if(rolling||!token)return;
  rolling=true;
  const btn=document.getElementById('roll'),area=document.getElementById('dicearea'),res=document.getElementById('result');
  let flicker=null;
  btn.disabled=true;area.classList.add('rolling');res.innerHTML='ROLLING...<small>Server is rolling your dice</small>';
  try{
    flicker=setInterval(()=>{drawDie('die1',1+Math.floor(Math.random()*6));drawDie('die2',1+Math.floor(Math.random()*6))},95);
    const request=fetch('/api/dice-arena/roll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,bet,prediction:pred})});
    await new Promise(r=>setTimeout(r,1550));
    const response=await request;
    const data=await response.json();
    clearInterval(flicker);
    area.classList.remove('rolling');
    if(!response.ok||!data.ok){
      if(data.balance!==undefined)document.getElementById('balance').textContent=money(data.balance)+' coins';
      res.innerHTML='ROLL NOT COMPLETED<small>'+String(data.error||'Please try again.')+'</small>';
      return;
    }
    drawDie('die1',data.die1);drawDie('die2',data.die2);
    document.getElementById('balance').textContent=money(data.balance)+' coins';
    res.innerHTML=(data.won?'🏆 WIN CONFIRMED':'🎲 TOTAL '+data.total+' • '+data.actual)+'<small>'+(data.won?'You won '+money(data.payout)+' coins · Stake '+money(data.bet):'No win this time · Stake '+money(data.bet)+' coins')+'</small>';res.classList.remove('reveal');void res.offsetWidth;res.classList.add('reveal');addRecent(data.total,data.won);
    if(data.stats)applyStats(data.stats);else refreshStats();
    btn.textContent='🎲 ROLL AGAIN';
  }catch(e){
    if(flicker)clearInterval(flicker);
    area.classList.remove('rolling');
    res.innerHTML='CONNECTION ERROR<small>Check your connection and try again.</small>';
  }finally{
    rolling=false;
    btn.disabled=!token;
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
setInterval(()=>{refreshStats();loadAccount()},2500);
updateBet();
