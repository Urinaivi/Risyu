/* ================================================================
   auth.js  ―  認証 / アカウント / テーマ 共通ユーティリティ
================================================================ */

/* ── アカウント定義（初期値） ── */
const DEFAULT_ACCOUNTS = [
  {
    id: 'A',
    name: 'りな',
    email: 'Urinaivi@gmail.com',
    password: 'utigatukutta',
    icon: '🌸',
    theme: '#7c7aff'
  },
  {
    id: 'B',
    name: 'しゅうと',
    email: 'shumon2423@iCloud.com',
    password: 'rinalove',
    icon: '🌊',
    theme: '#34c759'
  }
];

/* ── ストレージキー ── */
const KEYS = {
  accounts: 'app_accounts',
  session:  'app_session',   // 現在ログイン中のユーザーID
};

/* ── アカウント取得 ── */
function getAccounts() {
  try {
    const d = JSON.parse(localStorage.getItem(KEYS.accounts));
    if (Array.isArray(d) && d.length === 2) return d;
  } catch {}
  // 初回：デフォルトを保存して返す
  localStorage.setItem(KEYS.accounts, JSON.stringify(DEFAULT_ACCOUNTS));
  return DEFAULT_ACCOUNTS;
}

function saveAccounts(accounts) {
  localStorage.setItem(KEYS.accounts, JSON.stringify(accounts));
}

function getAccount(id) {
  return getAccounts().find(a => a.id === id);
}

/* ── セッション ── */
function getSession() {
  return localStorage.getItem(KEYS.session); // 'A' or 'B' or null
}

function setSession(id) {
  localStorage.setItem(KEYS.session, id);
}

function clearSession() {
  localStorage.removeItem(KEYS.session);
}

/* ── ログイン確認（未ログインなら login.html へ）── */
function requireLogin() {
  if (!getSession()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/* ── 現在のユーザー ── */
function currentUser() {
  const id = getSession();
  return id ? getAccount(id) : null;
}

function partnerId() {
  const id = getSession();
  return id === 'A' ? 'B' : 'A';
}

/* ── テーマカラー適用 ── */
function applyTheme(color) {
  if (!color) {
    const u = currentUser();
    color = u ? u.theme : '#7c7aff';
  }
  document.documentElement.style.setProperty('--accent', color);
  // アクセントに応じた影色も生成
  document.documentElement.style.setProperty('--accent-shadow', color + '55');
}

/* ── ナビゲーションバー共通 HTML ── */
function navHTML(activePage) {
  const pages = [
    { key: 'home',  icon: '🏠', label: 'ホーム',   href: 'index.html' },
    { key: 'pay',   icon: '💰', label: '支払い',   href: '01_payment.html' },
    { key: 'wants', icon: '📋', label: 'やりたい', href: '02_wants.html' },
    { key: 'stamp', icon: '🔖', label: 'スタンプ', href: '03_stamp.html' },
    { key: 'mypage',icon: '👤', label: 'マイページ',href: '05_mypage.html' },
  ];
  return pages.map(p => `
    <button class="nav-item${p.key === activePage ? ' active' : ''}"
            onclick="location.href='${p.href}'">
      <span class="nav-icon">${p.icon}</span>
      <span class="nav-lbl">${p.label}</span>
    </button>`).join('');
}
