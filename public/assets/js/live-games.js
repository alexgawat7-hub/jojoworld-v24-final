const soundButton=document.getElementById('soundToggle');
const soundKey='jojoworldArcadeSound';
let arcadeSoundOn=localStorage.getItem(soundKey)!=='false';
function renderSoundControl(){if(!soundButton)return;soundButton.textContent=arcadeSoundOn?'🔊 ARCADE SOUND ON':'🔇 ARCADE SOUND OFF';soundButton.setAttribute('aria-pressed',String(arcadeSoundOn));}
renderSoundControl();
soundButton?.addEventListener('click',()=>{arcadeSoundOn=!arcadeSoundOn;localStorage.setItem(soundKey,String(arcadeSoundOn));renderSoundControl();});

const token=new URLSearchParams(location.search).get('token')||'';
const notice=document.getElementById('notice');
if(token){const q='?token='+encodeURIComponent(token);document.getElementById('scatter').href='/scatter-spin'+q;document.getElementById('dice').href='/dice-arena'+q;
fetch('/api/scatter-spin/session'+q,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Could not connect');document.getElementById('balance').textContent=Number(d.balance||0).toLocaleString('en-US')+' coins';document.getElementById('session').innerHTML='ACCOUNT CONNECTED<br>READY TO PLAY'}).catch(e=>{document.getElementById('balance').textContent='Unavailable';document.getElementById('session').innerHTML='RECONNECT NEEDED';notice.style.display='block';notice.textContent=e.message+' — Reopen Live Games from Messenger to create a fresh secure link.'})}
else{document.getElementById('balance').textContent='Open from Messenger';document.getElementById('session').innerHTML='NO SESSION';notice.style.display='block';notice.textContent='To use your real JojoWorld balance, open Live Games from the Messenger menu. Direct visitors can preview the arcade, but game links need a secure session.'}
