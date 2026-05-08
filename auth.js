/* ================================================================
   auth.js  ―  認証 / アカウント / テーマ / GAS同期 共通ユーティリティ
================================================================ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzcrClFMEY1FeQu1IHALsIxokegXL8JcJjZOo9r9peaEOfMtnQ4g_LTVeEFUQwRIafW/exec';

/* ── アカウント定義（初期値） ── */
const DEFAULT_ACCOUNTS = [
  { id:'A', name:'りな',    email:'Urinaivi@gmail.com',   password:'utigatukutta', icon:'🌸', theme:'#ffafe4' },
  { id:'B', name:'しゅうと', email:'shumon2423@iCloud.com', password:'rinalove',    icon:'🌊', theme:'#a4ceff' },
];

const KEYS = { accounts:'app_accounts', session:'app_session' };

function getAccounts() {
  try { const d=JSON.parse(localStorage.getItem(KEYS.accounts)); if(Array.isArray(d)&&d.length===2)return d; } catch {}
  localStorage.setItem(KEYS.accounts,JSON.stringify(DEFAULT_ACCOUNTS));
  return DEFAULT_ACCOUNTS;
}
function saveAccounts(a)  { localStorage.setItem(KEYS.accounts,JSON.stringify(a)); }
function getAccount(id)   { return getAccounts().find(a=>a.id===id); }

function getSession()   { return localStorage.getItem(KEYS.session); }
function setSession(id) { localStorage.setItem(KEYS.session,id); }
function clearSession() { localStorage.removeItem(KEYS.session); }
function currentUser()  { const id=getSession(); return id?getAccount(id):null; }
function requireLogin() { const user=currentUser(); if(!user){ clearSession(); location.href='login.html'; return false; } return true; }
function partnerId()    { const id=getSession(); return id==='A'?'B':'A'; }

function iconHTML(icon, size=18) {
  if (typeof icon === 'string' && icon.startsWith('data:image/')) {
    return `<img src="${icon}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:inline-block;vertical-align:middle" alt="icon"/>`;
  }
  const safeIcon = String(icon || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<span style="font-size:${size}px;display:inline-block;line-height:1;vertical-align:middle">${safeIcon}</span>`;
}
function isImageIcon(icon) {
  return typeof icon === 'string' && icon.startsWith('data:image/');
}

function applyTheme(color) {
  if(!color){const u=currentUser();color=u?u.theme:'#7c7aff';}
  document.documentElement.style.setProperty('--accent',color);
}

/* ─── 通知システム ─── */
const NOTIF_KEY = 'wants_notif_v1';
function getNotifs(){ try{return JSON.parse(localStorage.getItem(NOTIF_KEY))||[]}catch{return[]} }
function addNotif(msg){
  const notifs=getNotifs();
  notifs.unshift({id:Date.now().toString(36),msg,time:new Date().toISOString(),read:false});
  if(notifs.length>50)notifs.pop();
  localStorage.setItem(NOTIF_KEY,JSON.stringify(notifs));
  localStorage.setItem('wants_unread_count', String(notifs.filter(n=>!n.read).length));
}
function markAllNotifsRead(){
  const notifs=getNotifs().map(n=>({...n,read:true}));
  localStorage.setItem(NOTIF_KEY,JSON.stringify(notifs));
  localStorage.setItem('wants_unread_count','0');
}
function getUnreadCount(){ return getNotifs().filter(n=>!n.read).length; }

/* ─── ナビゲーション ─── */
function navHTML(activePage, showBadge=false) {
  const unread = getUnreadCount();
  const pages=[
    {key:'home',  icon:'🏠',label:'ホーム',   href:'index.html'},
    {key:'pay',   icon:'💰',label:'支払い',   href:'01_payment.html'},
    {key:'wants', icon:'📋',label:'やりたい', href:'02_wants.html'},
    {key:'stamp', icon:'🔖',label:'スタンプ', href:'03_stamp.html'},
    {key:'mypage',icon:'👤',label:'マイページ',href:'mypage.html'},
  ];
  return pages.map(p=>{
    const hasBadge = p.key==='wants' && unread>0;
    return `<button class="nav-item${p.key===activePage?' active':''}" onclick="location.href='${p.href}'" style="position:relative">
      <span class="nav-icon">${p.icon}</span>
      <span class="nav-lbl">${p.label}</span>
      ${hasBadge?`<span style="position:absolute;top:6px;right:calc(50% - 18px);width:8px;height:8px;border-radius:50%;background:#ff3b30;border:1.5px solid #fafafa"></span>`:''}
    </button>`;
  }).join('');
}

/* ─── GAS ─── */
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
const PAY_HDR=['id','date','amount','memo','who','status','paidDate','createdAt','history'];
async function loadPaymentsRemote(){return gasGet('payments',rows=>{if(rows.length<=1)return[];return rows.slice(1).map(r=>({id:r[0],date:r[1],amount:Number(r[2]),memo:r[3],who:r[4],status:r[5],paidDate:r[6]||null,createdAt:r[7],history:r[8]?JSON.parse(r[8]):[]})).filter(p=>p.id);})}
async function savePaymentsRemote(payments){return gasSet('payments',[PAY_HDR,...payments.map(p=>[p.id,p.date,p.amount,p.memo||'',p.who,p.status,p.paidDate||'',p.createdAt||'',JSON.stringify(p.history||[])])]);}

/* ── やりたいこと（desireBフィールド追加） ── */
const WANTS_HDR=['id','title','regDate','period','url','memo','registrar','status','doneDate','createdAt','tags','map','cost','image','desire','desireB','imgSize'];
async function loadWantsRemote(){return gasGet('wants',rows=>{if(rows.length<=1)return[];return rows.slice(1).map(r=>({
  id:r[0],title:r[1],regDate:r[2],period:r[3],url:r[4],memo:r[5],registrar:r[6],status:r[7],
  doneDate:r[8]||null,createdAt:r[9],
  tags:r[10]?tryParse(r[10],[]):[],
  map:r[11]||'',cost:r[12]||'',
  image:r[13]||'',
  desire:Number(r[14])||0,
  desireB:Number(r[15])||0,
  imgSize:Number(r[16])||120,
})).filter(w=>w.id);})}
function tryParse(s,def){try{return JSON.parse(s)}catch{return def}}
async function saveWantsRemote(wants){
  // 画像はローカルのみ保存（GASのURL長制限回避）
  return gasSet('wants',[WANTS_HDR,...wants.map(w=>[
    w.id,w.title,w.regDate||'',w.period||'',w.url||'',w.memo||'',
    w.registrar,w.status,w.doneDate||'',w.createdAt||'',
    JSON.stringify(w.tags||[]),w.map||'',w.cost||'',
    '',  // imageはローカルのみ
    w.desire||0,w.desireB||0,w.imgSize||120
  ])]);}

/* ── スタンプ ── */
async function loadStampRemote(uid){return gasGet('stamp_'+uid,rows=>{if(rows.length<2)return null;try{return JSON.parse(rows[1][0]);}catch{return null;}})}
async function saveStampRemote(uid,data){return gasSet('stamp_'+uid,[['data'],[JSON.stringify(data)]]);}

/* ── ビンゴ ── */
async function loadBingoRemote(){return gasGet('bingo',rows=>{if(rows.length<2)return null;try{return JSON.parse(rows[1][0]);}catch{return null;}})}
async function saveBingoRemote(data){return gasSet('bingo',[['data'],[JSON.stringify(data)]]);}

/* ── アカウント ── */
async function syncAccountsRemote(){
  const remote=await gasGet('accounts',rows=>{if(rows.length<2)return null;try{return JSON.parse(rows[1][0]);}catch{return null;}});
  if(remote&&Array.isArray(remote)){saveAccounts(remote);return remote;}
  const local=getAccounts();
  await gasSet('accounts',[['data'],[JSON.stringify(local)]]);
  return local;
}
async function saveAccountsRemote(accounts){
  saveAccounts(accounts);
  return gasSet('accounts',[['data'],[JSON.stringify(accounts)]]);
}

/* ── syncOnLoad / syncOnSave ── */
async function syncOnLoad(targets=[],userId=''){
  if(!GAS_ENABLED)return;
  await Promise.all(targets.map(async t=>{
    if(t==='payments'){const d=await loadPaymentsRemote();if(d&&d.length)localStorage.setItem('pay_v1',JSON.stringify(d));}
    else if(t==='wants'){
      const local=JSON.parse(localStorage.getItem('wants_v1')||'[]');
      const remote=await loadWantsRemote();
      if(remote&&remote.length){
        // ローカルをベースに、リモートからの更新をマージ
        const merged=local.map(loc=>{
          const rem=remote.find(r=>r.id===loc.id);
          return rem?{...rem,image:loc.image||'',imgSize:loc.imgSize||120}:loc;
        });
        // リモートにあってローカルにないものを追加
        const newFromRemote=remote.filter(rem=>!local.some(loc=>loc.id===rem.id));
        merged.push(...newFromRemote);
        localStorage.setItem('wants_v1',JSON.stringify(merged));
      }
    }
    else if(t==='stamp'&&userId){const d=await loadStampRemote(userId);if(d)localStorage.setItem('stamp_v1_'+userId,JSON.stringify(d));}
    else if(t==='bingo'){const d=await loadBingoRemote();if(d)localStorage.setItem('bingo_v1',JSON.stringify(d));}
    else if(t==='accounts'){await syncAccountsRemote();}
  }));
}

function syncOnSave(type,data,userId=''){
  if(!GAS_ENABLED)return;
  (async()=>{
    if(type==='payments')      await savePaymentsRemote(data);
    else if(type==='wants')    await saveWantsRemote(data);
    else if(type==='stamp'&&userId) await saveStampRemote(userId,data);
    else if(type==='bingo')    await saveBingoRemote(data);
    else if(type==='accounts') await saveAccountsRemote(data);
  })();
}
