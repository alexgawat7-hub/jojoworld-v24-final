const $=id=>document.getElementById(id);
const token=new URLSearchParams(location.search).get('token')||'';
const money=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');
const colors=['RED','BLUE','GREEN','YELLOW','PINK'];
let previousBetAmount=100;
let selectedColor='',balance=0,roundState=null,working=false,loading=false,lastResultKey='',soundEnabled=false,audioContext=null,lastRollRound='',pendingResultState=null,revealedRoundNumber=0,pullInProgress=false,pullStartY=0,pullStartTime=0,pullTimer=null,autoPullTimer=null;
const lobby=$('lobby'),shop=$('shop');
if(token){const q='?token='+encodeURIComponent(token);lobby.href='/live-games'+q;shop.href='/coin-shop'+q;}
function setMessage(main,sub=''){const el=$('result');el.textContent=main;const small=document.createElement('small');small.textContent=sub;if(sub)el.appendChild(small);}
function setNotice(message){$('connection').textContent=message;}
function chooseColor(color){selectedColor=color;document.querySelectorAll('.color-choice').forEach(b=>b.classList.toggle('active',b.dataset.color===color));renderControls();}
document.querySelectorAll('.color-choice').forEach(b=>b.addEventListener('click',()=>chooseColor(b.dataset.color)));
document.querySelectorAll('.quick-bets button').forEach(b=>b.addEventListener('click',()=>{$('betAmount').value=b.dataset.amount;renderControls()}));
$('betAmount').addEventListener('input',renderControls);
$('againBtn')?.addEventListener('click',()=>{$('betAmount').value=String(previousBetAmount);renderControls();});
$('doubleBtn')?.addEventListener('click',()=>{$('betAmount').value=String(Math.min(100000,Math.max(10,Number($('betAmount').value||10)*2)));renderControls();});
$('undoBtn')?.addEventListener('click',()=>{selectedColor='';document.querySelectorAll('.color-choice').forEach(b=>b.classList.remove('active'));$('betAmount').value=String(previousBetAmount);renderControls();});
$('clearBtn')?.addEventListener('click',()=>{selectedColor='';$('betAmount').value='10';document.querySelectorAll('.color-choice').forEach(b=>b.classList.remove('active'));renderControls();});
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
 $('playerCount').textContent=money(state.playerCount)+' PLAYER'+(state.playerCount===1?'':'S');if($('livePlayerCount'))$('livePlayerCount').textContent=money(state.playerCount)+' PLAYER'+(state.playerCount===1?'':'S');
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
function audio(){
 if(!audioContext){const C=window.AudioContext||window.webkitAudioContext;if(C)audioContext=new C();}
 if(audioContext?.state==='suspended')audioContext.resume();
 return audioContext;
}
function tone(freq,duration,volume=0.035,type='sine',delay=0){
 if(!soundEnabled)return;
 const a=audio();if(!a)return;
 const osc=a.createOscillator(),gain=a.createGain(),start=a.currentTime+delay;
 osc.type=type;osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 osc.connect(gain);gain.connect(a.destination);osc.start(start);osc.stop(start+duration);
}
function noiseBurst(duration=.12,volume=.025,delay=0,filterFrequency=1500){
 if(!soundEnabled)return;
 const a=audio();if(!a)return;
 const length=Math.max(1,Math.floor(a.sampleRate*duration)),buffer=a.createBuffer(1,length,a.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++){const fade=1-i/length;data[i]=(Math.random()*2-1)*fade*fade;}
 const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain(),start=a.currentTime+delay;
 source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(filterFrequency,start);
 gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(volume,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 source.connect(filter);filter.connect(gain);gain.connect(a.destination);source.start(start);source.stop(start+duration);
}
function playRoll(){
 if(!soundEnabled)return;
 // Layered wooden/plastic clacks, a short rolling rattle, then three tray impacts.
 noiseBurst(.48,.035,0,1900);
 for(let i=0;i<10;i++){
  const delay=i*.067+Math.random()*.025;
  tone(115+Math.random()*180,.045,.028,'triangle',delay);
  tone(420+Math.random()*680,.026,.009,'square',delay+.018);
  if(i%2===0)noiseBurst(.035,.014,delay,2400);
 }
 noiseBurst(.11,.055,.61,850);
 tone(92,.2,.075,'sine',.62);tone(138,.13,.045,'triangle',.67);
 tone(740,.1,.02,'triangle',.86);tone(990,.16,.018,'sine',.96);
}
function playCordPull(){
 if(!soundEnabled)return;
 noiseBurst(.24,.045,0,1000);
 tone(180,.13,.035,'sawtooth',.015);tone(125,.18,.05,'triangle',.13);
 tone(72,.24,.065,'sine',.27);
}
let lastImpactSound=0;
window.addEventListener('color-dice-impact',event=>{
 if(!soundEnabled)return;
 const now=performance.now();
 if(now-lastImpactSound<45)return;
 lastImpactSound=now;
 const strength=Math.max(.15,Math.min(1,Number(event.detail?.strength)||.3));
 noiseBurst(.045,.012+strength*.028,0,1250+strength*900);
 tone(105+strength*95,.065,.012+strength*.028,'triangle');
});
$('soundToggle').addEventListener('click',()=>{
 soundEnabled=!soundEnabled;$('soundToggle').textContent=soundEnabled?'🔊 SOUND ON':'🔇 SOUND OFF';$('soundToggle').setAttribute('aria-pressed',String(soundEnabled));
 if(soundEnabled){audio();tone(660,.08,.025,'sine');}
});
const pullCord=$('pullCord'),cordRig=$('cordRig'),cordHint=$('cordHint');
function beginCordPull(){
 if(!roundState||roundState.status!=='complete'||!Array.isArray(roundState.result)||revealedRoundNumber===Number(roundState.roundNumber)||pullInProgress)return false;
 if(autoPullTimer){clearTimeout(autoPullTimer);autoPullTimer=null;}
 pullInProgress=true;pullCord.classList.add('pulled');pullCord.classList.remove('ready');cordRig.classList.add('pulled');cordHint.textContent='DICE DROPPING…';
 const stage=$('colorStage');stage.classList.remove('revealed','rolling');stage.classList.add('dice-drop');renderDice(['RED','BLUE','GREEN'],true);
 playCordPull();playRoll();
 if(pullTimer)clearTimeout(pullTimer);
 pullTimer=setTimeout(()=>{pullInProgress=false;revealedRoundNumber=Number(pendingResultState?.roundNumber||roundState.roundNumber);pullCord.classList.remove('pulled');cordRig.classList.remove('pulled');stage.classList.remove('dice-drop');if(pendingResultState)renderState(pendingResultState);},1050);
 return true;
}

function renderDice(diceColors,rolling=false){
 const stage=$('colorStage');stage.classList.toggle('rolling',rolling);stage.classList.toggle('revealed',!rolling);
 document.querySelectorAll('.color-die').forEach((die,i)=>{
  die.className='color-die '+String(diceColors[i]||'RED').toLowerCase();
  if(rolling)die.classList.add('rolling-die');
  const face=die.querySelector('.die-face');face.replaceChildren();
  if(rolling){const glint=document.createElement('span');glint.className='die-glint';glint.textContent='✦';face.appendChild(glint);}
  else {face.classList.add('pips');[0,1,2,3,4].forEach(n=>{const pip=document.createElement('i');pip.className='pip pip-'+n;face.appendChild(pip);});}
 });
}
function renderState(state){
 roundState=state;balance=Number(state.balance)||0;
 $('balance').textContent=money(balance)+' COINS';$('round').textContent='#'+state.roundNumber;
 const time=Math.max(0,Number(state.timeLeftMs)||0);
 $('timer').textContent=state.status==='betting'?(time/1000).toFixed(1)+'s':state.status==='settling'?'ROLLING…':'RESULT';
 $('roundStatus').textContent=state.status==='betting'?'BETTING OPEN':state.status==='settling'?'DICE ROLLING':'ROUND RESULT';
 $('timer').parentElement.classList.toggle('closed',state.status!=='betting');
 if(state.status==='betting'){
  renderDice(['RED','BLUE','GREEN'],time<=3500);
  if(time<=3500&&time>0&&lastRollRound!==String(state.roundNumber)){lastRollRound=String(state.roundNumber);playRoll();}
 } else if(state.status==='settling'){
  if(lastRollRound!==String(state.roundNumber)){lastRollRound=String(state.roundNumber);playRoll();}
  renderDice(['RED','BLUE','GREEN'],true);
 } else if(state.status==='complete'&&Array.isArray(state.result)&&revealedRoundNumber===Number(state.roundNumber))renderDice(state.result,false);
 else if(state.status==='complete'&&Array.isArray(state.result))renderDice(['RED','BLUE','GREEN'],true);
 else renderDice(['RED','BLUE','GREEN'],true);
 if(state.status==='complete'&&state.result){
  pendingResultState=state;
  if(revealedRoundNumber!==Number(state.roundNumber)){
   if(!pullInProgress){renderDice(['RED','BLUE','GREEN'],true);$('colorStage').classList.remove('dice-drop');pullCord.classList.add('ready');cordHint.textContent='BETTING CLOSED · BANKER PULLING THE CORD';setMessage('🎰 BANKER IS PULLING THE CORD','The banker triggers the mechanism. The three dice will drop before the server-confirmed result is revealed.');if(!autoPullTimer)autoPullTimer=setTimeout(()=>{autoPullTimer=null;beginCordPull();},850);}
  }else{
   const key=state.roundNumber+':'+state.result.join(',');const counts={};state.result.forEach(c=>counts[c]=(counts[c]||0)+1);const matches=state.myBet?(counts[state.myBet.color]||0):0;
   setMessage('ROUND #'+state.roundNumber+' · '+state.result.join(' · '),state.myBet?(matches?'Your color appeared '+matches+' time(s): total return '+money(state.myBet.payout)+' coins.':'Your color did not appear on the dice.'):'Three-dice result confirmed by the game server.');
   lastResultKey=key;cordHint.textContent='RESULT REVEALED · NEXT ROUND SOON';pullCord.classList.remove('ready');
  }
 }else if(state.status==='settling'){pullCord.classList.remove('ready');cordHint.textContent='DICE ARE PREPARING…';setMessage('🎲 THE THREE DICE ARE ROLLING','The server is confirming the three color results and payouts.');}
 else if(state.status==='betting'){pullCord.classList.remove('ready');cordHint.textContent='BANKER WILL PULL WHEN BETTING CLOSES';if(state.lastResult)setMessage('LAST ROUND: '+(Array.isArray(state.lastResult)?state.lastResult.join(' · '):state.lastResult),'Round #'+state.lastRoundNumber+' · Place your bet for this round.');else setMessage('PLACE YOUR BET','Choose one of five colors. More matching dice means a higher total return.');}
 if($('totalBet'))$('totalBet').textContent=money(state.myBet?.amount||0);if($('winAmount'))$('winAmount').textContent=money(state.myBet?.payout||0);renderBets(state);renderControls();
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
 if(selectedColor==='WHITE'){setMessage('WHITE IS NOT AVAILABLE YET','This live server currently supports red, blue, green, yellow, and pink only.');return;}
 const amount=Number($('betAmount').value);
 if(!Number.isSafeInteger(amount)||amount<10||amount>100000||amount>balance){setMessage('CHECK YOUR BET','Enter a whole-number bet within your balance.');return;}
 previousBetAmount=amount;working=true;renderControls();
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
