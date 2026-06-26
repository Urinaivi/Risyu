/* ================================================================
   auth.js  ―  認証 / アカウント / テーマ / GAS同期 共通ユーティリティ
   ------------------------------------------------------------
   v3: GASを「唯一の正データ」として扱う行レベルCRUD方式に変更。
   ・全件SET方式は廃止。1件ずつ create/update/delete を送信し、
     成功レスポンスを受け取るまでローカルには反映しない。
   ・楽観ロック：update/delete時に expectedUpdatedAt を送り、
     サーバ側の現在値と食い違えば conflict として呼び出し元に伝える。
   ・ローカルストレージは「表示用キャッシュ」位置づけ。
     画面を開くたびに必ずGASから最新を取得して上書きする。
================================================================ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzFs4LaxAKnNRwmtCEik6m3SdIyDLpnRZVMoQe4RJkdhgMLiUG5FhZBeTWpTcioXv3o/exec';
const GAS_ENABLED = GAS_URL.trim() !== '';

/* ── アカウント定義（初期値・GAS未接続時のフォールバックのみに使用） ── */
const DEFAULT_ACCOUNTS = [
  { id:'A', name:'りな',    email:'Urinaivi@gmail.com',   password:'utigatukutta', icon:'🌸', theme:'#ffafe4', updatedAt:'' },
  { id:'B', name:'しゅうと', email:'shumon2423@iCloud.com', password:'rinalove',    icon:'🌊', theme:'#a4ceff', updatedAt:'' },
];

const KEYS = { accounts:'app_accounts', session:'app_session' };

/* ================================================================
   GAS 通信の基本関数
================================================================ */
async function gasList(sheet) {
  if (!GAS_ENABLED) return null;
  try {
    const url = `${GAS_URL}?action=list&sheet=${encodeURIComponent(sheet)}&t=${Date.now()}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) { console.warn('[GAS] list error:', json.error); return null; }
    return json.rows || [];
  } catch (e) { console.warn('[GAS] list failed:', sheet, e); return null; }
}

async function gasPost(body) {
  if (!GAS_ENABLED) return null;
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS doPost simple request対策
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e) { console.warn('[GAS] post failed:', body && body.action, e); return null; }
}

async function gasCreate(sheet, row) {
  const res = await gasPost({ action:'create', sheet, row });
  if (!res) return { ok:false, networkError:true };
  return res;
}
async function gasUpdate(sheet, id, row, expectedUpdatedAt) {
  const res = await gasPost({ action:'update', sheet, id, row, expectedUpdatedAt });
  if (!res) return { ok:false, networkError:true };
  return res;
}
async function gasDelete(sheet, id, expectedUpdatedAt) {
  const res = await gasPost({ action:'delete', sheet, id, expectedUpdatedAt });
  if (!res) return { ok:false, networkError:true };
  return res;
}

/* ================================================================
   アカウント
================================================================ */
function getAccountsLocal() {
  try { const d = JSON.parse(localStorage.getItem(KEYS.accounts)); if (Array.isArray(d) && d.length) return d; } catch {}
  return DEFAULT_ACCOUNTS;
}
function saveAccountsLocal(a) { localStorage.setItem(KEYS.accounts, JSON.stringify(a)); }

// 互換用エイリアス（既存コードからの呼び出し名を維持）
function getAccounts() { return getAccountsLocal(); }
function saveAccounts(a) { saveAccountsLocal(a); }
function getAccount(id) { return getAccountsLocal().find(a => a.id === id); }

/* 起動時にGASからアカウント情報を取得・初期化する */
async function bootstrapAndSyncAccounts() {
  if (!GAS_ENABLED) return getAccountsLocal();
  let rows = await gasList('accounts');
  if (!rows || rows.length < 2) {
    const res = await gasPost({ action:'bootstrapAccounts', sheet:'accounts' });
    if (res && res.ok) rows = res.rows;
  }
  if (rows && rows.length) {
    saveAccountsLocal(rows);
    return rows;
  }
  return getAccountsLocal();
}

function getSession()   { return localStorage.getItem(KEYS.session); }
function setSession(id) { localStorage.setItem(KEYS.session, id); }
function clearSession() { localStorage.removeItem(KEYS.session); }
function currentUser()  { const id = getSession(); return id ? getAccount(id) : null; }
function requireLogin() { const user = currentUser(); if (!user) { clearSession(); location.href = 'login.html'; return false; } return true; }
function partnerId()    { const id = getSession(); return id === 'A' ? 'B' : 'A'; }

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
  if (!color) { const u = currentUser(); color = u ? u.theme : '#7c7aff'; }
  document.documentElement.style.setProperty('--accent', color);
}

/* アカウント更新（名前・パスワード・テーマ・アイコン変更時に使用）
   戻り値: {ok, conflict, current} ※例外が起きても必ずこの形のオブジェクトを返す */
async function updateAccountField(id, patch) {
  try {
    const accs = getAccountsLocal();
    const acc = accs.find(a => a.id === id);
    if (!acc) return { ok:false };
    const expectedUpdatedAt = acc.updatedAt || '';
    const res = await gasUpdate('accounts', id, patch, expectedUpdatedAt);
    if (res && res.ok) {
      const idx = accs.findIndex(a => a.id === id);
      accs[idx] = res.row;
      saveAccountsLocal(accs);
      return { ok:true, row:res.row };
    }
    return res || { ok:false };
  } catch (e) {
    console.warn('[updateAccountField] error:', e);
    return { ok:false, error:true };
  }
}

/* ─── 通知システム（ローカルのみで完結する補助機能。データ消失リスクなし） ─── */
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

/* ─── ナビゲーション（4画面構成） ─── */
function navHTML(activePage) {
  const unread = getUnreadCount();
  const pages=[
    {key:'home',  icon:'🏠',label:'ホーム',     href:'index.html'},
    {key:'pay',   icon:'💰',label:'支払い',     href:'01_payment.html'},
    {key:'wants', icon:'📋',label:'やりたい',   href:'02_wants.html'},
    {key:'mypage',icon:'👤',label:'マイページ', href:'mypage.html'},
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

/* ================================================================
   データ用 JSON文字列フィールドの変換ヘルパー
================================================================ */
function tryParse(s, def) { try { return JSON.parse(s); } catch { return def; } }

/* ================================================================
   支払い (payments)
   ローカルストレージキー: pay_v1 （表示用キャッシュ。常にGASから取得し直す）
================================================================ */
function parsePaymentRow(r) {
  return {
    id: r.id, updatedAt: r.updatedAt,
    date: r.date, amount: Number(r.amount)||0, memo: r.memo||'',
    who: r.who, status: r.status, paidDate: r.paidDate||null,
    createdAt: r.createdAt||'', history: r.history ? tryParse(r.history, []) : [],
  };
}
function serializePaymentRow(p) {
  return {
    id: p.id, date: p.date, amount: p.amount, memo: p.memo||'',
    who: p.who, status: p.status, paidDate: p.paidDate||'',
    createdAt: p.createdAt||'', history: JSON.stringify(p.history||[]),
  };
}

/* GASから最新の支払い一覧を取得し、ローカルキャッシュも更新して返す */
async function fetchPayments() {
  const rows = await gasList('payments');
  if (rows === null) {
    // 通信失敗時のみ、直前のキャッシュを返す（表示が完全に消えるのを防ぐ目的のみ）
    try { const c = JSON.parse(localStorage.getItem('pay_v1')); return Array.isArray(c) ? c : []; } catch { return []; }
  }
  const list = rows.map(parsePaymentRow);
  localStorage.setItem('pay_v1', JSON.stringify(list));
  return list;
}
/* 1件追加。成功時は作成された行（updatedAt含む）を返す。失敗時はnull */
async function createPayment(p) {
  const res = await gasCreate('payments', serializePaymentRow(p));
  if (res && res.ok) return parsePaymentRow(res.row);
  return null;
}
/* 1件更新。expectedUpdatedAtは更新前にローカルが持っていたupdatedAt。
   戻り値: {ok, conflict, row} */
async function updatePayment(id, patch, expectedUpdatedAt) {
  const res = await gasUpdate('payments', id, serializePaymentRow(Object.assign({id},patch)), expectedUpdatedAt);
  if (res && res.ok) return { ok:true, row: parsePaymentRow(res.row) };
  if (res && res.conflict) return { ok:false, conflict:true, row: parsePaymentRow(res.current) };
  return { ok:false };
}
async function deletePayment(id, expectedUpdatedAt) {
  const res = await gasDelete('payments', id, expectedUpdatedAt);
  if (res && (res.ok)) return { ok:true };
  if (res && res.conflict) return { ok:false, conflict:true, row: parsePaymentRow(res.current) };
  return { ok:false };
}

/* ================================================================
   やりたいこと (wants)
   ローカルストレージキー: wants_v1
   ※画像(image)は強めに圧縮(サムネイル品質)した上でGASに保存し、両端末で共有する
================================================================ */
function parseWantsRow(r) {
  return {
    id: r.id, updatedAt: r.updatedAt,
    title: r.title, regDate: r.regDate||'', period: r.period||'', url: r.url||'',
    memo: r.memo||'', registrar: r.registrar, status: r.status, doneDate: r.doneDate||null,
    createdAt: r.createdAt||'',
    tags: r.tags ? tryParse(r.tags, []) : [],
    map: r.map||'', cost: r.cost||'',
    desire: Number(r.desire)||0, desireB: Number(r.desireB)||0,
    imgSize: Number(r.imgSize)||120,
    image: r.image || '',
  };
}
function serializeWantsRow(w) {
  return {
    id: w.id, title: w.title, regDate: w.regDate||'', period: w.period||'', url: w.url||'',
    memo: w.memo||'', registrar: w.registrar, status: w.status, doneDate: w.doneDate||'',
    createdAt: w.createdAt||'', tags: JSON.stringify(w.tags||[]),
    map: w.map||'', cost: w.cost||'',
    desire: w.desire||0, desireB: w.desireB||0, imgSize: w.imgSize||120,
    image: w.image||'',
  };
}

async function fetchWants() {
  const rows = await gasList('wants');
  if (rows === null) {
    try { const c = JSON.parse(localStorage.getItem('wants_v1')); return Array.isArray(c) ? c : []; } catch { return []; }
  }
  const list = rows.map(parseWantsRow);
  localStorage.setItem('wants_v1', JSON.stringify(list));
  return list;
}
async function createWants(w) {
  const res = await gasCreate('wants', serializeWantsRow(w));
  if (res && res.ok) return parseWantsRow(res.row);
  return null;
}
async function updateWants(id, patch, expectedUpdatedAt, baseRow) {
  const row = Object.assign({id}, baseRow||{}, patch);
  const res = await gasUpdate('wants', id, serializeWantsRow(row), expectedUpdatedAt);
  if (res && res.ok) return { ok:true, row: parseWantsRow(res.row) };
  if (res && res.conflict) return { ok:false, conflict:true, row: parseWantsRow(res.current) };
  return { ok:false };
}
async function deleteWants(id, expectedUpdatedAt) {
  const res = await gasDelete('wants', id, expectedUpdatedAt);
  if (res && res.ok) return { ok:true };
  if (res && res.conflict) return { ok:false, conflict:true, row: parseWantsRow(res.current) };
  return { ok:false };
}

/* ================================================================
   計画書 (plans)  ローカルストレージキー: plans_v1
================================================================ */
function parsePlanRow(r) {
  return {
    id: r.id, updatedAt: r.updatedAt, wantsId: r.wantsId,
    title: r.title||'', date: r.date||'', url: r.url||'',
    schedule: r.schedule ? tryParse(r.schedule, []) : [],
    items: r.items ? tryParse(r.items, []) : [],
    expenses: r.expenses ? tryParse(r.expenses, []) : [],
    shoppingList: r.shoppingList ? tryParse(r.shoppingList, []) : [],
    memo: r.memo||'', reservation: r.reservation||'',
    todoList: r.todoList ? tryParse(r.todoList, []) : [],
    createdAt: r.createdAt||'',
  };
}
function serializePlanRow(p) {
  return {
    id: p.id, wantsId: p.wantsId, title: p.title||'', date: p.date||'', url: p.url||'',
    schedule: JSON.stringify(p.schedule||[]), items: JSON.stringify(p.items||[]),
    expenses: JSON.stringify(p.expenses||[]), shoppingList: JSON.stringify(p.shoppingList||[]),
    memo: p.memo||'', reservation: p.reservation||'', todoList: JSON.stringify(p.todoList||[]),
    createdAt: p.createdAt||'',
  };
}
async function fetchPlans() {
  const rows = await gasList('plans');
  if (rows === null) {
    try { const c = JSON.parse(localStorage.getItem('plans_v1')); return Array.isArray(c) ? c : []; } catch { return []; }
  }
  const list = rows.map(parsePlanRow);
  localStorage.setItem('plans_v1', JSON.stringify(list));
  return list;
}
async function createPlan(p) {
  const res = await gasCreate('plans', serializePlanRow(p));
  if (res && res.ok) return parsePlanRow(res.row);
  return null;
}
async function updatePlan(id, patch, expectedUpdatedAt) {
  const res = await gasUpdate('plans', id, serializePlanRow(Object.assign({id}, patch)), expectedUpdatedAt);
  if (res && res.ok) return { ok:true, row: parsePlanRow(res.row) };
  if (res && res.conflict) return { ok:false, conflict:true, row: parsePlanRow(res.current) };
  return { ok:false };
}
async function deletePlan(id, expectedUpdatedAt) {
  const res = await gasDelete('plans', id, expectedUpdatedAt);
  if (res && res.ok) return { ok:true };
  if (res && res.conflict) return { ok:false, conflict:true, row: parsePlanRow(res.current) };
  return { ok:false };
}

/* ================================================================
   画像圧縮ヘルパー
   ・GASスプレッドシートのセル文字数制限(約5万文字)を踏まえ、
     wants の image はサムネイル品質まで強く圧縮してから保存する。
   ・最大辺 40px 程度・JPEG品質を落として、Base64でも十分小さく収める。
================================================================ */
function compressImageToThumbnail(src, maxSize=40, quality=0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
      else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

/* ================================================================
   共有設定 (settings) ―― 記念日など、二人で共有する単一設定
   ローカルストレージキー: app_settings
================================================================ */
function parseSettingsRow(r) {
  return { id: r.id, updatedAt: r.updatedAt, anniversary: r.anniversary || '' };
}
function getSettingsLocal() {
  try { const d = JSON.parse(localStorage.getItem('app_settings')); if (d) return d; } catch {}
  return { id:'shared', updatedAt:'', anniversary:'' };
}
function saveSettingsLocal(s) { localStorage.setItem('app_settings', JSON.stringify(s)); }

async function fetchSettings() {
  if (!GAS_ENABLED) return getSettingsLocal();
  let rows = await gasList('settings');
  let row = rows && rows.find(r => r.id === 'shared');
  if (!row) {
    const res = await gasPost({ action:'bootstrapSettings', sheet:'settings' });
    if (res && res.ok) row = res.row;
  }
  if (row) {
    const parsed = parseSettingsRow(row);
    saveSettingsLocal(parsed);
    return parsed;
  }
  return getSettingsLocal();
}
/* 戻り値: {ok, conflict, row} */
async function updateSettings(patch) {
  const current = getSettingsLocal();
  const res = await gasUpdate('settings', 'shared', patch, current.updatedAt || '');
  if (res && res.ok) {
    const parsed = parseSettingsRow(res.row);
    saveSettingsLocal(parsed);
    return { ok:true, row: parsed };
  }
  if (res && res.conflict) return { ok:false, conflict:true, row: parseSettingsRow(res.current) };
  return { ok:false };
}

/* ================================================================
   period文字列（例: "2026/4/1" や "2026/4/1〜2026/4/30"）から
   終了日(Date)を取り出す共通パーサー。
   ・前後の空白(半角/全角)を許容
   ・月/日の0埋め有無を許容（正規表現を緩める）
   ・範囲指定の区切り文字は「〜」「~」のいずれにも対応
================================================================ */
function parsePeriodEndDate(period) {
  if (!period) return null;
  const cleaned = String(period).trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/[〜~]/).map(s => s.trim()).filter(Boolean);
  const datePattern = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
  const target = parts.length >= 2 ? parts[1] : parts[0];
  if (!target) return null;
  const m = target.match(datePattern);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

let _busyOverlayEl = null;
function showBusyOverlay(msg) {
  if (!_busyOverlayEl) {
    _busyOverlayEl = document.createElement('div');
    _busyOverlayEl.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.25);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(1px)';
    _busyOverlayEl.innerHTML = `<div style="background:#fff;border-radius:14px;padding:18px 22px;font-size:14px;font-weight:600;color:#1c1c1e;box-shadow:0 8px 30px rgba(0,0,0,.2);display:flex;align-items:center;gap:10px">
      <span style="width:16px;height:16px;border:2.5px solid #d1d1d6;border-top-color:#7c7aff;border-radius:50%;display:inline-block;animation:authjs-spin .7s linear infinite"></span>
      <span id="authjsBusyMsg"></span>
    </div>`;
    const styleTag = document.createElement('style');
    styleTag.textContent = '@keyframes authjs-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
    document.head.appendChild(styleTag);
  }
  document.getElementById('authjsBusyMsg') ? null : _busyOverlayEl.querySelector('#authjsBusyMsg');
  _busyOverlayEl.querySelector('#authjsBusyMsg').textContent = msg || '保存中…';
  const phone = document.querySelector('.phone') || document.body;
  phone.appendChild(_busyOverlayEl);
}
function hideBusyOverlay() {
  if (_busyOverlayEl && _busyOverlayEl.parentNode) _busyOverlayEl.parentNode.removeChild(_busyOverlayEl);
}
function showErrorToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:absolute;left:50%;bottom:90px;transform:translateX(-50%);background:#ff3b30;color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:600;z-index:10000;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:85%;text-align:center';
  t.textContent = msg;
  const phone = document.querySelector('.phone') || document.body;
  phone.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}