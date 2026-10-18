const soundButton=document.getElementById('soundToggle');
const soundKey='jojoworldArcadeSound';
function readSoundSetting(){try{return localStorage.getItem(soundKey)!=='false'}catch(_){return true}}
function saveSoundSetting(value){try{localStorage.setItem(soundKey,String(value))}catch(_){}}
let arcadeSoundOn=readSoundSetting();
function renderSoundControl(){if(!soundButton)return;soundButton.textContent=arcadeSoundOn?'🔊 ARCADE SOUND ON':'🔇 ARCADE SOUND OFF';soundButton.setAttribute('aria-pressed',String(arcadeSoundOn));}
renderSoundControl();
if(soundButton){soundButton.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();arcadeSoundOn=!arcadeSoundOn;saveSoundSetting(arcadeSoundOn);renderSoundControl();});}

const token=new URLSearchParams(location.search).get('token')||'';
const notice=document.getElementById('notice');
if(token){
 const q='?token='+encodeURIComponent(token);
 const scatterLink=document.getElementById('scatter'),diceLink=document.getElementById('dice'),rushLink=document.getElementById('rush');
 if(scatterLink)scatterLink.href='/scatter-spin'+q;
 if(diceLink)diceLink.href='/dice-arena'+q;
 if(rushLink)rushLink.href='/neon-tap-rush'+q;
 fetch('/api/scatter-spin/session'+q,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Could not connect');document.getElementById('balance').textContent=Number(d.balance||0).toLocaleString('en-US')+' coins';document.getElementById('session').innerHTML='ACCOUNT CONNECTED<br>READY TO PLAY'}).catch(e=>{document.getElementById('balance').textContent='Unavailable';document.getElementById('session').innerHTML='RECONNECT NEEDED';notice.style.display='block';notice.textContent=e.message+' — Reopen Game Lobby from Messenger to create a fresh secure link.'});
}else{
 document.getElementById('balance').textContent='Open from Messenger';
 document.getElementById('session').innerHTML='NO SESSION';
 notice.style.display='block';
 notice.textContent='To use your real JojoWorld balance, open Game Lobby from the Messenger menu. Direct visitors can preview the arcade, but game links need a secure session.';
}
