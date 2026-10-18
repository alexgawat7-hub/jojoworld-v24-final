const token=new URLSearchParams(location.search).get('token')||'';
const notice=document.getElementById('notice');
if(token){
 const q='?token='+encodeURIComponent(token);
 const coinShop=document.getElementById('coinShop');if(coinShop)coinShop.href='/coin-shop'+q;
 const scatterLink=document.getElementById('scatter'),diceLink=document.getElementById('dice'),rushLink=document.getElementById('rush'),battleLink=document.getElementById('battle');
 if(scatterLink)scatterLink.href='/scatter-spin'+q;
 if(diceLink)diceLink.href='/dice-arena'+q;
 if(rushLink)rushLink.href='/neon-tap-rush'+q;
 if(battleLink)battleLink.href='/neon-battle'+q;
 fetch('/api/scatter-spin/session'+q,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Could not connect');document.getElementById('balance').textContent=Number(d.balance||0).toLocaleString('en-US')+' coins';document.getElementById('session').innerHTML='ACCOUNT CONNECTED<br>READY TO PLAY'}).catch(e=>{document.getElementById('balance').textContent='Unavailable';document.getElementById('session').innerHTML='RECONNECT NEEDED';notice.style.display='block';notice.textContent=e.message+' — Reopen Game Lobby from Messenger to create a fresh secure link.'});
}else{
 document.getElementById('balance').textContent='Open from Messenger';
 document.getElementById('session').innerHTML='NO SESSION';
 notice.style.display='block';
 notice.textContent='To use your real JojoWorld balance, open Game Lobby from the Messenger menu. Direct visitors can preview the arcade, but game links need a secure session.';
}

// Lobby category filters: coin games are separate from free/casual games.
const categoryButtons=[...document.querySelectorAll('.category-btn')];
const gameCards=[...document.querySelectorAll('[data-game-category]')];
const categoryNote=document.getElementById('categoryNote');
function showCategory(category){
 categoryButtons.forEach(button=>{const active=button.dataset.category===category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 gameCards.forEach(card=>{card.hidden=card.dataset.gameCategory!==category;});
 if(categoryNote)categoryNote.textContent=category==='coin'?'Coin-based arcade games. These games use virtual coins.':'Free-to-play and casual games. No coins are needed for these games; multiplayer games will be added as they become available.';
}
categoryButtons.forEach(button=>button.addEventListener('click',()=>showCategory(button.dataset.category)));
showCategory('coin');
