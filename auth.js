/* ================================================================
   auth.js  ―  認証 / アカウント / テーマ / GAS同期 共通ユーティリティ
================================================================ */

// ★ STEP2でコピーしたGASのURLをここに貼り付ける
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzcrClFMEY1FeQu1IHALsIxokegXL8JcJjZOo9r9peaEOfMtnQ4g_LTVeEFUQwRIafW/exec';  // 例: 'https://script.google.com/macros/s/XXXX/exec'

/* ── アカウント定義（初期値） ── */
const DEFAULT_ACCOUNTS = [
  { id:'A', name:'りな',    email:'Urinaivi@gmail.com',   password:'utigatukutta', icon:'🌸', theme:'#ffafe4' },
  { id:'B', name:'しゅうと', email:'shumon2423@iCloud.com', password:'rinalove',    icon:'🌊', theme:'#a4ceff' },
];

/* ── ストレージキー ── */
const KEYS = { accounts:'app_accounts', session:'app_session' };
const SYNC_PENDING_KEY = 'app_sync_pending_v1';

/* ────────────────────────────────────────────────────────────
   アカウント管理
──────────────────────────────────────────────────────────── */
function getAccounts() {
  try { const d=JSON.parse(localStorage.getItem(KEYS.accounts)); if(Array.isArray(d)&&d.length===2)return d; } catch {}
  localStorage.setItem(KEYS.accounts,JSON.stringify(DEFAULT_ACCOUNTS));
  return DEFAULT_ACCOUNTS;
}
function saveAccounts(a)  { localStorage.setItem(KEYS.accounts,JSON.stringify(a)); }
function getAccount(id)   { return getAccounts().find(a=>a.id===id); }

/* ────────────────────────────────────────────────────────────
   セッション
──────────────────────────────────────────────────────────── */
function getSession()   { return localStorage.getItem(KEYS.session); }
function setSession(id) { localStorage.setItem(KEYS.session,id); }
function clearSession() { localStorage.removeItem(KEYS.session); }
function requireLogin() { if(!getSession()){location.href='login.html';return false;}return true; }
function currentUser()  { const id=getSession();return id?getAccount(id):null; }
function partnerId()    { const id=getSession();return id==='A'?'B':'A'; }

/* ────────────────────────────────────────────────────────────
   テーマ
──────────────────────────────────────────────────────────── */
function applyTheme(color) {
  if(!color){const u=currentUser();color=u?u.theme:'#fdc4ff';}
  document.documentElement.style.setProperty('--accent',color);
}

/* ────────────────────────────────────────────────────────────
   アイコン表示（絵文字 / 画像URL）
──────────────────────────────────────────────────────────── */
function escHtml(s){
  return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function isImageIcon(icon){
  const v=String(icon||'').trim();
  if(!v)return false;
  return /^https?:\/\//i.test(v)||/^data:image\//i.test(v)||/\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(v);
}
function iconHTML(icon,size=20){
  const s=Math.max(12,Number(size)||20);
  if(isImageIcon(icon)){
    const src=escHtml(icon);
    const fallback='🙂';
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${s}px;height:${s}px;vertical-align:middle"><img src="${src}" alt="icon" style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;display:block" onerror="this.style.display='none';this.parentElement.textContent='${fallback}'"></span>`;
  }
  return `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:${s}px;min-height:${s}px;line-height:1;vertical-align:middle;font-size:${Math.round(s*0.9)}px">${escHtml(icon||'🙂')}</span>`;
}

/* ────────────────────────────────────────────────────────────
   多分ビンゴのやつ
──────────────────────────────────────────────────────────── */
function getSyncPendingMap(){
  try{
    const d=JSON.parse(localStorage.getItem(SYNC_PENDING_KEY));
    if(d&&typeof d==='object')return d;
  }catch{}
  return {};
}
function setSyncPending(type,isPending){
  const map=getSyncPendingMap();
  if(isPending)map[type]=true;
  else delete map[type];
  localStorage.setItem(SYNC_PENDING_KEY,JSON.stringify(map));
}
function isSyncPending(type){
  return !!getSyncPendingMap()[type];
}

/* ────────────────────────────────────────────────────────────
   ナビゲーションHTML
──────────────────────────────────────────────────────────── */
function navHTML(activePage) {
  const pages=[
    {key:'home',  icon:'🏠',label:'ホーム',   href:'index.html'},
    {key:'pay',   icon:'💰',label:'支払い',   href:'01_payment.html'},
    {key:'wants', icon:'📋',label:'やりたい', href:'02_wants.html'},
    {key:'stamp', icon:'🔖',label:'スタンプ', href:'03_stamp.html'},
    {key:'mypage',icon:'👤',label:'マイページ',href:'mypage.html'},
  ];
  return pages.map(p=>`<button class="nav-item${p.key===activePage?' active':''}" onclick="location.href='${p.href}'"><span class="nav-icon">${p.icon}</span><span class="nav-lbl">${p.label}</span></button>`).join('');
}

/* ════════════════════════════════════════════════════════════
   GAS同期
   GAS_URLが空ならlocalStorageのみ動作（オフラインモード）
════════════════════════════════════════════════════════════ */
const GAS_ENABLED = GAS_URL.trim() !== '';

async function gasGet(sheetName, parser) {
  if(!GAS_ENABLED)return null;
  try {
    const url=`${GAS_URL}?method=get&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
    const rows=await (await fetch(url)).json();
    if(!Array.isArray(rows)||rows.length===0)return [];
    return parser?parser(rows):rows;
  } catch(e){console.warn('[GAS] get failed:',sheetName,e);return null;}
}

async function gasSet(sheetName, rows) {
  if(!GAS_ENABLED)return false;
  try {
    const url=`${GAS_URL}?method=set&sheet=${encodeURIComponent(sheetName)}&data=${encodeURIComponent(JSON.stringify(rows))}`;
    const json=await (await fetch(url)).json();
    return json.status==='saved';
  } catch(e){console.warn('[GAS] set failed:',sheetName,e);return false;}
}

/* ── 支払い ── */
const PAY_HDR=['id','date','amount','memo','who','status','paidDate','createdAt'];
async function loadPaymentsRemote(){return gasGet('payments',rows=>{if(rows.length<=1)return[];return rows.slice(1).map(r=>({id:r[0],date:r[1],amount:Number(r[2]),memo:r[3],who:r[4],status:r[5],paidDate:r[6]||null,createdAt:r[7]})).filter(p=>p.id);})}
async function savePaymentsRemote(payments){return gasSet('payments',[PAY_HDR,...payments.map(p=>[p.id,p.date,p.amount,p.memo||'',p.who,p.status,p.paidDate||'',p.createdAt||''])]);}

/* ── やりたいこと ── */
const WANTS_HDR=['id','title','regDate','period','url','memo','registrar','status','doneDate','createdAt'];
async function loadWantsRemote(){return gasGet('wants',rows=>{if(rows.length<=1)return[];return rows.slice(1).map(r=>({id:r[0],title:r[1],regDate:r[2],period:r[3],url:r[4],memo:r[5],registrar:r[6],status:r[7],doneDate:r[8]||null,createdAt:r[9]})).filter(w=>w.id);})}
async function saveWantsRemote(wants){return gasSet('wants',[WANTS_HDR,...wants.map(w=>[w.id,w.title,w.regDate||'',w.period||'',w.url||'',w.memo||'',w.registrar,w.status,w.doneDate||'',w.createdAt||''])]);}

/* ── スタンプ（ユーザーごと） ── */
async function loadStampRemote(uid){return gasGet('stamp_'+uid,rows=>{if(rows.length<2)return null;try{return JSON.parse(rows[1][0]);}catch{return null;}})}
async function saveStampRemote(uid,data){return gasSet('stamp_'+uid,[['data'],[JSON.stringify(data)]]);}

/* ── ビンゴ ── */
async function loadBingoRemote(){return gasGet('bingo',rows=>{if(rows.length<2)return null;try{return JSON.parse(rows[1][0]);}catch{return null;}})}
async function saveBingoRemote(data){return gasSet('bingo',[['data'],[JSON.stringify(data)]]);}

/* ── アカウント情報 ── */
async function syncAccountsRemote(){
  const remote=await gasGet('accounts',rows=>{if(rows.length<2)return null;try{return JSON.parse(rows[1][0]);}catch{return null;}});
  const local=getAccounts();
  
  if(remote&&Array.isArray(remote)){
    // ローカルのアイコンとテーマをGASから取得したデータに保護
    remote.forEach(r=>{
      const l=local.find(acc=>acc.id===r.id);
      if(l){
        r.icon=l.icon;
        r.theme=l.theme;
      }
    });
    saveAccounts(remote);
    return remote;
  }
  
  await gasSet('accounts',[['data'],[JSON.stringify(local)]]);
  return local;
}
async function saveAccountsRemote(accounts){
  saveAccounts(accounts);
  return gasSet('accounts',[['data'],[JSON.stringify(accounts)]]);
}

/* ────────────────────────────────────────────────────────────
   syncOnLoad  ― 起動時にGASからlocalStorageへ反映
   targets例: ['payments','wants','stamp','bingo','accounts']
──────────────────────────────────────────────────────────── */
async function syncOnLoad(targets=[],userId=''){
  if(!GAS_ENABLED)return;
  await Promise.all(targets.map(async t=>{
    if(t==='payments'){
      if(isSyncPending('payments')){
        const local=JSON.parse(localStorage.getItem('pay_v1')||'[]');
        if(Array.isArray(local)&&local.length){
          const ok=await savePaymentsRemote(local);
          if(ok)setSyncPending('payments',false);
          return;
        }
      }
      const d=await loadPaymentsRemote();
      if(d)localStorage.setItem('pay_v1',JSON.stringify(d));
    }
    else if(t==='wants'){
      if(isSyncPending('wants')){
        const local=JSON.parse(localStorage.getItem('wants_v1')||'[]');
        if(Array.isArray(local)&&local.length){
          const ok=await saveWantsRemote(local);
          if(ok)setSyncPending('wants',false);
          return;
        }
      }
      const d=await loadWantsRemote();
      if(d)localStorage.setItem('wants_v1',JSON.stringify(d));
    }
    else if(t==='stamp'&&userId){
      const type='stamp_'+userId;
      if(isSyncPending(type)){
        const local=JSON.parse(localStorage.getItem('stamp_v1_'+userId)||'null');
        if(local){
          const ok=await saveStampRemote(userId,local);
          if(ok)setSyncPending(type,false);
          return;
        }
      }
      const d=await loadStampRemote(userId);
      if(d)localStorage.setItem('stamp_v1_'+userId,JSON.stringify(d));
    }
    else if(t==='bingo'){
      if(isSyncPending('bingo')){
        const local=JSON.parse(localStorage.getItem('bingo_v1')||'null');
        if(local){
          const ok=await saveBingoRemote(local);
          if(ok)setSyncPending('bingo',false);
          return;
        }
      }
      const d=await loadBingoRemote();
      if(d)localStorage.setItem('bingo_v1',JSON.stringify(d));
    }
    else if(t==='accounts'){await syncAccountsRemote();}
  }));
}

/* ────────────────────────────────────────────────────────────
   syncOnSave  ― データ保存時にGASへ書き込む（非同期・エラー無視）
──────────────────────────────────────────────────────────── */
function syncOnSave(type,data,userId=''){
  if(!GAS_ENABLED)return;
  const pendingType=type==='stamp'&&userId?`stamp_${userId}`:type;
  setSyncPending(pendingType,true);
  (async()=>{
    let ok=false;
    if(type==='payments')      ok=await savePaymentsRemote(data);
    else if(type==='wants')    ok=await saveWantsRemote(data);
    else if(type==='stamp'&&userId) ok=await saveStampRemote(userId,data);
    else if(type==='bingo')    ok=await saveBingoRemote(data);
    else if(type==='accounts') ok=await saveAccountsRemote(data);
    if(ok)setSyncPending(pendingType,false);
  })();
}
