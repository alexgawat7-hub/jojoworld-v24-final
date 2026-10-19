const $=id=>document.getElementById(id);
const token=new URLSearchParams(location.search).get('token')||'';
const money=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');
const compactMoney=n=>{const v=Math.max(0,Number(n)||0);return v>=1000000?(v/1000000).toFixed(v%1000000===0?0:1)+'M':v>=1000?(v/1000).toFixed(v%1000===0?0:1)+'K':String(Math.floor(v));};
const colors=['RED','BLUE','GREEN','YELLOW','PINK','WHITE'];
let previousBetAmount=100,lastBetAnnouncementRound='',lastCountdownSecond='',lastCountdownBeepRound='';
let lastKnownDiceColors=['WHITE','WHITE','WHITE'];
let masterGain=null,masterCompressor=null;
let selectedColor='',balance=0,roundState=null,working=false,loading=false,lastResultKey='',soundEnabled=false,audioContext=null,lastRollRound='',pendingResultState=null,revealedRoundNumber=0,pullInProgress=false,pullStartY=0,pullStartTime=0,pullTimer=null,autoPullTimer=null;
const lobby=$('lobby'),shop=$('shop');
if(token){const q='?token='+encodeURIComponent(token);lobby.href='/live-games'+q;shop.href='/coin-shop'+q;}
function setMessage(main,sub=''){const el=$('result');el.textContent=main;const small=document.createElement('small');small.textContent=sub;if(sub)el.appendChild(small);}
function setNotice(message){$('connection').textContent=message;}
function chooseColor(color){
 const amountInput=$('betAmount');
 const current=Math.max(10,Number(amountInput.value)||10);
 const sameColor=selectedColor===color;
 selectedColor=color;
 // [ADDED] Repeated taps on the same color double the pending stake, capped by balance and UI maximum.
 if(sameColor){
  amountInput.value=String(Math.min(100000,balance,current*2));
 }
 document.querySelectorAll('.color-choice').forEach(b=>b.classList.toggle('active',b.dataset.color===color));
 renderControls();
}
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
 const myBets=Array.isArray(roundState?.myBets)?roundState.myBets:(roundState?.myBet?[roundState.myBet]:[]);
 const alreadyBet=!!selectedColor&&myBets.some(b=>String(b.color).toUpperCase()===selectedColor);
 const open=roundState&&roundState.status==='betting'&&roundState.timeLeftMs>0;
 document.querySelectorAll('.color-choice').forEach(b=>b.disabled=!open||working);
 $('placeBet').disabled=!open||working||!selectedColor||alreadyBet||!valid||amount>balance;
 $('placeBet').textContent=working?'CONFIRMING BET…':!selectedColor?'SELECT A COLOR':alreadyBet?('ALREADY BET ON '+selectedColor):!valid?'ENTER 10–100,000 COINS':amount>balance?'NOT ENOUGH COINS':'BET '+money(amount)+' ON '+selectedColor;
 $('betAmount').disabled=!open||working;
 $('maxBet').disabled=!open||working;
 document.querySelectorAll('.quick-bets button').forEach(b=>b.disabled=!open||working);
}
function renderBets(state){
 $('playerCount').textContent=money(state.playerCount)+' PLAYER'+(state.playerCount===1?'':'S');if($('livePlayerCount'))$('livePlayerCount').textContent=money(state.playerCount)+' PLAYER'+(state.playerCount===1?'':'S');
 $('redTotal').textContent=money(state.totals.RED);
 $('blueTotal').textContent=money(state.totals.BLUE);
 $('greenTotal').textContent=money(state.totals.GREEN);$('yellowTotal').textContent=money(state.totals.YELLOW);$('pinkTotal').textContent=money(state.totals.PINK);if($('whiteTotal'))$('whiteTotal').textContent=money(state.totals.WHITE||0);
 // Each on-color chip comes only from a bet returned by the live server.
 for(const color of colors){
  const choice=document.querySelector('.color-choice[data-color="'+color+'"]');
  if(!choice)continue;
  choice.dataset.total=compactMoney(state.totals?.[color]||0);
  const chip=choice.querySelector('.chip-stack');
  if(!chip)continue;
  const actual=(Array.isArray(state.bets)?state.bets:[]).filter(b=>String(b.color||'').toUpperCase()===color);
  // [FIXED] Render each live player's bet as a separate visible chip on this color.
  chip.replaceChildren();
  actual.slice(0,3).forEach(bet=>{
   const coin=document.createElement('span');
   coin.className='player-chip';
   coin.textContent=compactMoney(bet.amount);
   coin.title=(bet.name||'Player')+' bet '+money(bet.amount)+' on '+color;
   chip.appendChild(coin);
  });
  chip.style.display=actual.length?'flex':'none';
  chip.title=actual.length?actual.length+' live bet(s) on '+color:'No bets on '+color;
  chip.classList.toggle('chip-triple',actual.length>1);
 }
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
 if(!audioContext){
  const C=window.AudioContext||window.webkitAudioContext;
  if(C){
   audioContext=new C();
   masterGain=audioContext.createGain();masterGain.gain.value=1.4;
   masterCompressor=audioContext.createDynamicsCompressor();
   masterCompressor.threshold.value=-16;masterCompressor.knee.value=18;masterCompressor.ratio.value=5;
   masterCompressor.attack.value=.004;masterCompressor.release.value=.22;
   masterGain.connect(masterCompressor);masterCompressor.connect(audioContext.destination);
  }
 }
 if(audioContext?.state==='suspended')audioContext.resume().catch(()=>{});
 return audioContext;
}
function tone(freq,duration,volume=0.035,type='sine',delay=0){
 if(!soundEnabled)return;
 const a=audio();if(!a)return;
 const osc=a.createOscillator(),gain=a.createGain(),start=a.currentTime+delay;
 osc.type=type;osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 osc.connect(gain);gain.connect(masterGain||a.destination);osc.start(start);osc.stop(start+duration);
}
function noiseBurst(duration=.12,volume=.025,delay=0,filterFrequency=1500){
 if(!soundEnabled)return;
 const a=audio();if(!a)return;
 const length=Math.max(1,Math.floor(a.sampleRate*duration)),buffer=a.createBuffer(1,length,a.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++){const fade=1-i/length;data[i]=(Math.random()*2-1)*fade*fade;}
 const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain(),start=a.currentTime+delay;
 source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(filterFrequency,start);
 gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(volume,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 source.connect(filter);filter.connect(gain);gain.connect(masterGain||a.destination);source.start(start);source.stop(start+duration);
}
function playRoll(){
 if(!soundEnabled)return;
 // Layered wooden/plastic clacks, a short rolling rattle, then three tray impacts.
 noiseBurst(.48,.085,0,1900);
 for(let i=0;i<10;i++){
  const delay=i*.067+Math.random()*.025;
  tone(115+Math.random()*180,.045,.065,'triangle',delay);
  tone(420+Math.random()*680,.026,.025,'square',delay+.018);
  if(i%2===0)noiseBurst(.035,.035,delay,2400);
 }
 noiseBurst(.11,.11,.61,850);
 tone(92,.2,.14,'sine',.62);tone(138,.13,.085,'triangle',.67);
 tone(740,.1,.02,'triangle',.86);tone(990,.16,.018,'sine',.96);
}
function playWin(){
 if(!soundEnabled)return;
 // [ADDED] Bright, layered coin/chime reward sound when the player's selected color hits.
 noiseBurst(.055,.045,0,2800);
 tone(660,.16,.085,'triangle',.015);
 tone(880,.19,.095,'sine',.13);
 tone(1175,.22,.10,'sine',.27);
 tone(1568,.28,.075,'triangle',.42);
 tone(988,.18,.055,'sine',.58);
}
const placeBetVoice=new Audio('/assets/audio/place-your-bet.mp3?v=20261018a');
placeBetVoice.preload='auto';placeBetVoice.volume=1;
let voicePrimed=false;
function primePlaceBetVoice(){
 if(voicePrimed)return;
 try{
  placeBetVoice.muted=true;
  const p=placeBetVoice.play();
  if(p&&typeof p.then==='function')p.then(()=>{placeBetVoice.pause();placeBetVoice.currentTime=0;placeBetVoice.muted=false;voicePrimed=true;}).catch(()=>{placeBetVoice.muted=false;});
  else{placeBetVoice.pause();placeBetVoice.currentTime=0;placeBetVoice.muted=false;voicePrimed=true;}
 }catch(_){placeBetVoice.muted=false;}
}
function speakPlaceYourBet(roundNumber){
 if(!soundEnabled)return false;
 const round=String(roundNumber??roundState?.roundNumber??'');
 if(!round||lastBetAnnouncementRound===round)return false;
 if(roundState&&String(roundState.roundNumber)!==round)return false;
 lastBetAnnouncementRound=round;
 try{
  placeBetVoice.pause();placeBetVoice.currentTime=0;placeBetVoice.muted=false;placeBetVoice.volume=1;
  const playback=placeBetVoice.play();
  if(playback&&typeof playback.catch==='function')playback.catch(()=>{if(lastBetAnnouncementRound===round)lastBetAnnouncementRound='';});
  return true;
 }catch(_){if(lastBetAnnouncementRound===round)lastBetAnnouncementRound='';return false;}
}
function playCountdown(second){
 if(!soundEnabled)return;
 if(second===1){tone(1040,.11,.095,'square');tone(760,.13,.085,'triangle',.12);tone(520,.2,.07,'square',.27);}
 else {tone(second<=3?880:660,.075,.035,'sine');tone(second<=3?660:495,.075,.028,'sine',.095);}
}
function playCordPull(){
 if(!soundEnabled)return;
 // A taut cable scrape, ratchet ticks, then the heavy release latch.
 noiseBurst(.32,.095,0,1150);
 tone(205,.18,.065,'sawtooth',.015);
 for(let i=0;i<5;i++){
  const t=.045+i*.052;
  tone(460-i*38,.026,.045,'square',t);
  noiseBurst(.022,.03,t,1900-i*150);
 }
 tone(128,.2,.11,'triangle',.28);
 noiseBurst(.09,.11,.34,780);
 tone(72,.28,.14,'sine',.35);
 tone(310,.055,.025,'triangle',.39);
}
let lastImpactSound=0;
window.addEventListener('color-dice-impact',event=>{
 if(!soundEnabled)return;
 const now=performance.now();
 if(now-lastImpactSound<45)return;
 lastImpactSound=now;
 const strength=Math.max(.15,Math.min(1,Number(event.detail?.strength)||.3));
 noiseBurst(.045,.035+strength*.055,0,1250+strength*900);
 tone(105+strength*95,.065,.035+strength*.055,'triangle');
});
$('soundToggle').addEventListener('click',()=>{
 soundEnabled=!soundEnabled;$('soundToggle').textContent=soundEnabled?'🔊 SOUND ON':'🔇 SOUND OFF';$('soundToggle').setAttribute('aria-pressed',String(soundEnabled));
 if(soundEnabled){const a=audio();if(a?.state==='suspended')a.resume().catch(()=>{});primePlaceBetVoice();tone(660,.12,.09,'sine');tone(990,.14,.065,'sine',.1);if('speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined'){try{const synth=window.speechSynthesis;synth.cancel();const unlock=new SpeechSynthesisUtterance(' ');unlock.volume=0;unlock.rate=1;synth.speak(unlock);}catch(_){}}if(roundState?.status==='betting'){speakPlaceYourBet(roundState.roundNumber);const seconds=Math.ceil(Math.max(0,Number(roundState.timeLeftMs)||0)/1000);if(seconds<=10&&seconds>0){lastCountdownSecond=String(roundState.roundNumber)+':'+seconds;playCountdown(seconds);}}}
});
const pullCord=$('pullCord'),cordRig=$('cordRig'),cordHint=$('cordHint');
function beginCordPull(){
 if(!roundState||roundState.status!=='complete'||!Array.isArray(roundState.result)||revealedRoundNumber===Number(roundState.roundNumber)||pullInProgress)return false;
 if(autoPullTimer){clearTimeout(autoPullTimer);autoPullTimer=null;}
 pullInProgress=true;pullCord.classList.add('pulled');pullCord.classList.remove('ready');cordRig.classList.add('pulled');cordHint.textContent='DICE DROPPING…';
 const stage=$('colorStage');stage.classList.remove('revealed','rolling');stage.classList.add('dice-drop');renderDice(['WHITE','WHITE','WHITE'],true,false);
 playCordPull();playRoll();
 if(pullTimer)clearTimeout(pullTimer);
 pullTimer=setTimeout(()=>{pullInProgress=false;revealedRoundNumber=Number(pendingResultState?.roundNumber||roundState.roundNumber);pullCord.classList.remove('pulled');cordRig.classList.remove('pulled');stage.classList.remove('dice-drop');if(pendingResultState)renderState(pendingResultState);},2400);
 return true;
}

function normalizeResultColors(value){
 if(Array.isArray(value))return value.slice(0,3).map(c=>String(c||'').trim().toUpperCase()).filter(c=>colors.includes(c));
 if(typeof value==='string')return value.split(/[,·|]/).map(c=>c.trim().toUpperCase()).filter(c=>colors.includes(c)).slice(0,3);
 return [];
}
function renderDice(diceColors,rolling=false,remember=true){
 const stage=$('colorStage');stage.classList.toggle('rolling',rolling);stage.classList.toggle('revealed',!rolling);
 const validColors=normalizeResultColors(diceColors);
 if(validColors.length===3&&remember)lastKnownDiceColors=validColors;
 const displayColors=validColors.length===3?validColors:lastKnownDiceColors;
 document.querySelectorAll('.color-die').forEach((die,i)=>{
  die.className='color-die '+String(displayColors[i]||'WHITE').toLowerCase();
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
  $('colorStage').classList.toggle('betting-open',state.status==='betting');
 $('timer').parentElement.classList.toggle('closed',state.status!=='betting');
 if(state.status==='betting'){
  if(String(lastCountdownSecond).split(':')[0]!==String(state.roundNumber))lastCountdownSecond='';
  if(soundEnabled){speakPlaceYourBet(state.roundNumber);const seconds=Math.ceil(time/1000),countdownKey=String(state.roundNumber)+':'+seconds;if(seconds<=10&&seconds>0&&lastCountdownSecond!==countdownKey){lastCountdownSecond=countdownKey;playCountdown(seconds);}if(seconds===1&&time>0&&lastCountdownBeepRound!==String(state.roundNumber)){lastCountdownBeepRound=String(state.roundNumber);tone(1180,.12,.13,'square');tone(820,.16,.11,'triangle',.13);}}
  // [FIXED] Show the previous round's confirmed dice colors during the next betting phase.
  // The upcoming result stays hidden until the banker pull animation finishes.
  renderDice(lastKnownDiceColors,false,false);
  if(time<=3500&&time>0&&lastRollRound!==String(state.roundNumber)){lastRollRound=String(state.roundNumber);playRoll();}
 } else if(state.status==='settling'){
  if(lastRollRound!==String(state.roundNumber)){lastRollRound=String(state.roundNumber);playRoll();}
  renderDice(['WHITE','WHITE','WHITE'],true,false);
 } else if(state.status==='complete'&&Array.isArray(state.result)&&revealedRoundNumber===Number(state.roundNumber))renderDice(state.result,false);
 else if(state.status==='complete'&&Array.isArray(state.result))renderDice(['WHITE','WHITE','WHITE'],true,false);
 else renderDice(lastKnownDiceColors,true);
 if(state.status==='complete'&&state.result){
  pendingResultState=state;
  if(revealedRoundNumber!==Number(state.roundNumber)){
   if(!pullInProgress){renderDice(['WHITE','WHITE','WHITE'],true,false);$('colorStage').classList.remove('dice-drop');pullCord.classList.add('ready');cordHint.textContent='BETTING CLOSED · BANKER PULLING THE CORD';setMessage('🎰 BANKER IS PULLING THE CORD','The banker triggers the mechanism. The three dice will drop before the server-confirmed result is revealed.');if(!autoPullTimer)autoPullTimer=setTimeout(()=>{autoPullTimer=null;beginCordPull();},850);}
  }else{
   const key=state.roundNumber+':'+state.result.join(',');const counts={};state.result.forEach(c=>counts[c]=(counts[c]||0)+1);
   const ownBets=Array.isArray(state.myBets)?state.myBets:(state.myBet?[state.myBet]:[]);
   const winningBets=ownBets.filter(b=>(counts[String(b.color).toUpperCase()]||0)>0);
   const totalPayout=ownBets.reduce((sum,b)=>sum+(Number(b.payout)||0),0);
   if(winningBets.length&&totalPayout>0)playWin();
   setMessage('ROUND #'+state.roundNumber+' · '+state.result.join(' · '),ownBets.length?(winningBets.length?'Winning colors: '+winningBets.map(b=>b.color).join(', ')+'. Total return '+money(totalPayout)+' coins.':'None of your selected colors appeared on the dice.'):'Three-dice result confirmed by the game server.');
   lastResultKey=key;cordHint.textContent='RESULT REVEALED · NEXT ROUND SOON';pullCord.classList.remove('ready');
  }
 }else if(state.status==='settling'){pullCord.classList.remove('ready');cordHint.textContent='DICE ARE PREPARING…';setMessage('🎲 THE THREE DICE ARE ROLLING','The server is confirming the three color results and payouts.');}
 else if(state.status==='betting'){pullCord.classList.remove('ready');cordHint.textContent='BANKER WILL PULL WHEN BETTING CLOSES';if(state.lastResult)setMessage('LAST ROUND: '+(Array.isArray(state.lastResult)?state.lastResult.join(' · '):state.lastResult),'Round #'+state.lastRoundNumber+' · Place your bet for this round.');else setMessage('PLACE YOUR BET','Choose one of six colors. More matching dice means a higher total return.');}
 const ownBets=Array.isArray(state.myBets)?state.myBets:(state.myBet?[state.myBet]:[]);
 if($('totalBet'))$('totalBet').textContent=money(ownBets.reduce((sum,b)=>sum+(Number(b.amount)||0),0));
 if($('winAmount'))$('winAmount').textContent=money(ownBets.reduce((sum,b)=>sum+(Number(b.payout)||0),0));
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
else{loadState(true);setInterval(()=>loadState(false),250);}
