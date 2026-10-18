const token=new URLSearchParams(location.search).get('token')||'';
const $=id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString('en-US');
const notice=$('notice'),packages=$('packages');
if(token){const q='?token='+encodeURIComponent(token);$('back').href='/live-games'+q;$('returnLink').href='/live-games'+q}
function showNotice(message,type=''){notice.textContent=message;notice.className='notice'+(type?' '+type:'')}
function setBusy(busy){packages.querySelectorAll('button').forEach(b=>b.disabled=busy)}
async function loadWallet(){
 $('refresh').disabled=true;
 try{
  if(!token)throw new Error('Open Game Lobby from your JojoWorld Messenger menu first so your secure account can connect.');
  const response=await fetch('/api/coin-shop/session?token='+encodeURIComponent(token),{cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Could not load wallet.');
  $('balance').textContent=money(data.balance)+' coins';
  renderPackages(data.packages||[]);
  showNotice('Wallet connected. Choose a package to open secure checkout.');
 }catch(error){
  $('balance').textContent='Unavailable';
  showNotice(error.message||'Coin Shop is unavailable. Try again.', 'error');
 }finally{$('refresh').disabled=false}
}
function renderPackages(list){
 packages.innerHTML='';
 if(!list.length){showNotice('Coin packages are temporarily unavailable.','error');return}
 list.forEach(pkg=>{
  const card=document.createElement('article');
  card.className='package'+(pkg.amount===80?' featured':'');
  if(pkg.amount===80){const badge=document.createElement('span');badge.className='popular';badge.textContent='BEST SELLER';card.appendChild(badge)}
  const coins=document.createElement('span');coins.className='coins';coins.textContent='🪙 '+money(pkg.coins)+' COINS';
  const price=document.createElement('strong');price.textContent='₱'+money(pkg.amount);
  const button=document.createElement('button');button.type='button';button.textContent='BUY COINS';
  button.addEventListener('click',()=>startCheckout(pkg.amount,button));
  card.append(coins,price,button);packages.appendChild(card);
 });
}
async function startCheckout(amount,button){
 if(!token){showNotice('Your secure session is missing. Reopen Game Lobby from Messenger.','error');return}
 button.disabled=true;button.textContent='PREPARING…';
 try{
  showNotice('Creating a secure checkout link…');
  const response=await fetch('/api/coin-shop/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,amount})});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Could not start checkout.');
  const opened=window.open(data.checkoutUrl,'_blank');
  if(opened){opened.opener=null;showNotice('Checkout opened in a new tab. Complete payment there, then return here and tap Refresh to update your balance.','good')}
  else {showNotice('Popup blocked. Opening secure checkout in this tab; after payment, use Back to return to your Coin Shop.','good');window.location.assign(data.checkoutUrl)}
 }catch(error){showNotice(error.message||'Checkout could not be created. No coins were charged.','error')}
 finally{if(button.isConnected&&button.textContent!=='OPEN CHECKOUT'){button.disabled=false;button.textContent='BUY COINS'}}
}
$('refresh').addEventListener('click',loadWallet);
loadWallet();
