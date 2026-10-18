const $=id=>document.getElementById(id);
const token=new URLSearchParams(location.search).get('token')||'';
const money=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');
const colors=['RED','BLUE','GREEN','YELLOW','PINK'];
let selectedColor='',balance=0,roundState=null,working=false,loading=false,lastResultKey='';
const lobby=$('lobby'),shop=$('shop');
if(token){const q='?token='+encodeURIComponent(token);lobby.href='/live-games'+q;shop.href='/coin-shop'+q;}
function setMessage(main,sub=''){const el=$('result');el.textContent=main;const small=document.createElement('small');small.textContent=sub;if(sub)el.appendChild(small);}
function setNotice(message){$('connection').textContent=message;}
function chooseColor(color){selectedColor=color;document.querySelectorAll('.color-choice').forEach(b=>b.classList.toggle('active',b.dataset.color===color));renderControls();}
document.querySelectorAll('.color-choice').forEach(b=>b.addEventListener('click',()=>chooseColor(b.dataset.color)));
document.querySelectorAll('.quick-bets button').forEach(b=>b.addEventListener('click',()=>{$('betAmount').value=b.dataset.amount;renderControls()}));
$('betAmount').addEventListener('input',renderControls);
$('maxBet').addEventListener('click',()=>{$('betAmount').value=String(Math.min(100000,balance));renderControls()});
function renderControls(){
 const amount=Number($('betAmount').value),valid=Number.isSafeInteger(amount)&&amount>=10&&amount<=100000;
 const open=roundState&&roundState.status==='betting'&&roundState.timeLeftMs>0&&!roundState.myBet;
 document.querySelectorAll('.color-choice').forEach(b=>b.disabled=!open||working);
 $('placeBet').disabled=!open||working||!selectedColor||!valid||amount>balance;
 $('placeBet').textContent=working?'CONFIRMING BET…':roundState?.myBet?('BET LOCKED · '+roundState.myBet.color):!selectedColor?'SELECT A COLOR':!valid?'ENTER 10–100,000 COINS':amount>balance?'NOT ENOUGH COINS':'BET '+money(amount)+' ON '+selectedColor;
 $('betAmount').disabled=!open||working;
 $('maxBet').disabled=!open||working;
 document.querySelectorAll('.quick-bets button').forEach(b=>b.disabled=!open||working);
}
function renderBets(state){
 $('playerCount').textContent=money(state.playerCount)+' PLAYER'+(state.playerCount===1?'':'S');
 $('redTotal').textContent=money(state.totals.RED);
 $('blueTotal').textContent=money(state.totals.BLUE);
 $('greenTotal').textContent=money(state.totals.GREEN);$('yellowTotal').textContent=money(state.totals.YELLOW);$('pinkTotal').textContent=money(state.totals.PINK);
 const list=$('betsList');list.replaceChildren();
 if(!state.bets?.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Waiting for the first player to bet…';list.appendChild(empty);return;}
 state.bets.forEach(b=>{
  const row=document.createElement('div');row.className='bet-row-item';
  const name=document.createElement('span');name.className='player-name';name.textContent=b.name;
  const color=document.createElement('span');color.className='bet-color '+b.color;color.textContent=b.color;
  const amount=document.createElement('span');amount.className='bet-amount';amount.textContent=money(b.amount);
  const status=document.createElement('span');status.className='bet-status';status.textContent=b.status==='settled'?(b.payout>0?'+'+money(b.payout):'LOST'):'LOCKED';if(b.status==='settled'&&b.payout>0)status.classList.add('win');
  row.append(name,color,amount,status);list.appendChild(row);
 });
}
function renderDice(colors,rolling=false){
 const stage=$('colorStage');stage.classList.toggle('rolling',rolling);stage.classList.toggle('revealed',!rolling);
 document.querySelectorAll('.color-die').forEach((die,i)=>{
  die.className='color-die '+String(colors[i]||'RED').toLowerCase();
  if(rolling)die.classList.add('rolling-die');
  const face=die.querySelector('.die-face');face.textContent=rolling?'✦':'●';
 });
}
function renderState(state){
 roundState=state;balance=Number(state.balance)||0;
 $('balance').textContent=money(balance)+' COINS';$('round').textContent='#'+state.roundNumber;
 const time=Math.max(0,Number(state.timeLeftMs)||0);
 $('timer').textContent=state.status==='betting'?(time/1000).toFixed(1)+'s':state.status==='settling'?'ROLLING…':'RESULT';
 $('roundStatus').textContent=state.status==='betting'?'BETTING OPEN':state.status==='settling'?'DICE ROLLING':'ROUND RESULT';
 $('timer').parentElement.classList.toggle('closed',state.status!=='betting');
 if(state.status==='betting')renderDice(['RED','BLUE','GREEN'],time<=3500);
 else if(Array.isArray(state.result))renderDice(state.result,false);
 else renderDice(['RED','BLUE','GREEN'],true);
 if(state.status==='complete'&&state.result){
  const key=state.roundNumber+':'+state.result.join(',');
  const counts={};state.result.forEach(c=>counts[c]=(counts[c]||0)+1);
  const matches=state.myBet?(counts[state.myBet.color]||0):0;
  setMessage('ROUND #'+state.roundNumber+' · '+state.result.join(' · '),state.myBet?(matches?'Your color appeared '+matches+' time(s): total return '+money(state.myBet.payout)+' coins.':'Your color did not appear on the dice.'):'Three-dice result confirmed by the game server.');
  lastResultKey=key;
 }else if(state.status==='settling')setMessage('🎲 THE THREE DICE ARE ROLLING','The server is confirming the three color results and payouts.');
 else if(state.lastResult)setMessage('LAST ROUND: '+(Array.isArray(state.lastResult)?state.lastResult.join(' · '):state.lastResult),'Round #'+state.lastRoundNumber+' · Place your bet for this round.');
 else setMessage('PLACE YOUR BET','Choose one of five colors. More matching dice means a higher total return.');
 renderBets(state);renderControls();
}
async function loadState(showErrors=false){
 if(loading||!token)return;
 loading=true;
 try{
  const response=await fetch('/api/color-game/state?token='+encodeURIComponent(token),{cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Could not connect');
  renderState(data);setNotice('● LIVE CONNECTED');
 }catch(error){setNotice('RECONNECT NEEDED');if(showErrors)setMessage('LIVE CONNECTION LOST',String(error.message||'Please reopen Game Lobby from Messenger.'));}
 finally{loading=false;}
}
$('placeBet').addEventListener('click',async()=>{
 if(working||!token||!selectedColor)return;
 const amount=Number($('betAmount').value);
 if(!Number.isSafeInteger(amount)||amount<10||amount>100000||amount>balance){setMessage('CHECK YOUR BET','Enter a whole-number bet within your balance.');return;}
 working=true;renderControls();
 try{
  const response=await fetch('/api/color-game/bet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,color:selectedColor,bet:amount})});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Bet not confirmed');
  renderState(data);setMessage('BET CONFIRMED · '+selectedColor,money(amount)+' coins locked for round #'+data.roundNumber+'.');
 }catch(error){setMessage('BET NOT CONFIRMED',String(error.message||'Refresh and check your balance before trying again.'));await loadState();}
 finally{working=false;renderControls();}
});
if(!token){setNotice('OPEN FROM MESSENGER');$('balance').textContent='—';setMessage('SECURE SESSION REQUIRED','Open Game Lobby from JojoWorld Messenger to play with your real coin balance.');$('placeBet').disabled=true;}
else{loadState(true);setInterval(()=>loadState(false),1200);}
