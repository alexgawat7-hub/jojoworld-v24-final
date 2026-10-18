const token=new URLSearchParams(location.search).get('token')||'';
const $=id=>document.getElementById(id), money=n=>Number(n||0).toLocaleString('en-US');
let spinning=false,balance=0,accountConnected=false,accountLoading=false;
let soundOn=true,audioCtx=null,tickCount=0;
function playSound(kind){
 if(!soundOn)return;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  if(!audioCtx)audioCtx=new AC();if(audioCtx.state==='suspended')audioCtx.resume();
  const now=audioCtx.currentTime;
  const notes=kind==='tick'?[520]:kind==='win'?[660,880,1100]:kind==='jackpot'?[523,659,784,1047,1318]:kind==='lose'?[330,247]:[440];
  notes.forEach((freq,i)=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),start=now+i*(kind==='tick'?.0:.11);osc.type=kind==='tick'?'square':'sine';osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(kind==='tick'?.035:.09,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+(kind==='tick'?.055:.19));osc.connect(gain);gain.connect(audioCtx.destination);osc.start(start);osc.stop(start+(kind==='tick'?.06:.21));});
 }catch(_){}
}
const soundButton=$('soundToggle');
soundButton?.addEventListener('click',()=>{soundOn=!soundOn;soundButton.textContent=soundOn?'🔊 SOUND ON':'🔇 SOUND OFF';soundButton.setAttribute('aria-pressed',String(soundOn));if(soundOn)playSound('tap')});
const symbols=['💣','❌','🪙','🎁','💎','👑','🍀','⭐'];
function setBalance(n){balance=Number(n)||0;$('balance').textContent=money(balance)+' coins'}
function setJackpot(n){$('jackpot').textContent=money(n)+' coins'}
async function loadAccount({quiet=false}={}){
 if(accountLoading)return;accountLoading=true;
 if(!token){accountConnected=false;$('result').innerHTML='OPEN FROM MESSENGER<small>Type SPIN in JojoWorld Messenger and open the Scatter Spin button.</small>';$('spin').disabled=true;accountLoading=false;return}
 $('spin').disabled=true;
 let lastError=null;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const r=await fetch('/api/scatter-spin/session?token='+encodeURIComponent(token),{cache:'no-store'});
   const d=await r.json();
   if(!r.ok||!d.ok){const err=Error(d.error||'Account session unavailable');err.status=r.status;throw err}
   setBalance(d.balance);setJackpot(d.jackpot);accountConnected=true;
   document.querySelector('.status').innerHTML='<i class="dot"></i>LIVE ACCOUNT';
   if(!quiet)$('result').innerHTML='READY TO PLAY<small>Account connected. Each spin costs 10 coins.</small>';
   $('spin').disabled=false;accountLoading=false;return true;
  }catch(e){lastError=e;if(e.status===401||e.status===404||e.status===400)break;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,900*(attempt+1)));}
 }
 accountConnected=false;
 const message=lastError?.message||'Connection unavailable';
 $('result').innerHTML='ACCOUNT NOT CONNECTED<small>'+message+(lastError?.status===401?'. Reopen the game from Messenger to create a fresh session.':' . Reconnecting automatically failed; tap Refresh to retry.')+'</small>';
 document.querySelector('.status').innerHTML='<i class="dot"></i>RECONNECT NEEDED';
 $('spin').disabled=true;accountLoading=false;return false;
}
$('spin').addEventListener('click',async()=>{
 if(spinning||!token)return;spinning=true;$('spin').disabled=true;$('reels').classList.add('spinning');$('result').classList.remove('reveal');$('result').innerHTML='SPINNING...<small>Waiting for the server-confirmed result</small>';
 const els=[$('r1'),$('r2'),$('r3')];let ticker=setInterval(()=>{els.forEach(e=>e.textContent=symbols[Math.floor(Math.random()*symbols.length)]);if(++tickCount%2===0)playSound('tick')},100);
 try{
  const req=fetch('/api/scatter-spin/spin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  const response=await req;const d=await response.json();clearInterval(ticker);$('reels').classList.remove('spinning');
  if(!response.ok||!d.ok){playSound('lose');if(d.balance!==undefined)setBalance(d.balance);$('result').classList.remove('win-result','jackpot-result');$('result').classList.add('loss-result');$('result').innerHTML='SPIN NOT COMPLETED<small>'+(d.error||'Please try again.')+'</small>';return}
  playSound(d.jackpotWin?'jackpot':d.win>0?'win':'lose');d.symbols.forEach((v,i)=>els[i].textContent=v);els.forEach(e=>{e.classList.remove('win');if(d.win>0){void e.offsetWidth;e.classList.add('win')}});setBalance(d.balance);setJackpot(d.jackpot);
  $('result').classList.remove('win-result','jackpot-result','loss-result');$('result').classList.add(d.jackpotWin?'jackpot-result':d.win>0?'win-result':'loss-result');$('result').innerHTML=(d.jackpotWin?'🏆 GRAND JACKPOT!':d.win>0?'✨ '+d.message:'💣 NO WIN — SPIN AGAIN!')+'<small>'+(d.jackpotWin?'You won '+money(d.win)+' coins!':d.win>0?'+'+money(d.win)+' coins • '+d.message:'No prize on this spin. Better luck next time! Your result is confirmed.')+'</small>';$('result').classList.add('reveal');
 }catch(e){playSound('lose');clearInterval(ticker);$('reels').classList.remove('spinning');$('result').innerHTML='SPIN RESULT UNCONFIRMED<small>The server did not return a result, so we can’t safely call this a win or loss. Refresh your balance before spinning again.</small>';document.querySelector('.status').innerHTML='<i class="dot"></i>RECONNECT NEEDED';}
 finally{spinning=false;$('spin').disabled=!(token&&accountConnected)}
});
$('refresh').addEventListener('click',e=>{e.preventDefault();loadAccount()});
$('diceLink').addEventListener('click',e=>{e.preventDefault();if(!token){location.href='/dice-arena';return}location.href='/dice-arena?token='+encodeURIComponent(token)});
loadAccount();
