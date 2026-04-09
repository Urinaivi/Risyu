/* ═══════════════════════════════════════════════════════════
   STATE & STORAGE
═══════════════════════════════════════════════════════════ */
const KEYS = { pay:'app_payments', wants:'app_wants', bingo:'app_bingo', stamp:'app_stamp', stampReward:'app_stamp_reward', bingoReward:'app_bingo_reward' };

function load(k){ try{ return JSON.parse(localStorage.getItem(k))||null }catch{return null} }
function save(k,v){ localStorage.setItem(k,JSON.stringify(v)) }

// Payments: [{id,date,amount,memo,target,state,paidDate}]
let payments = load(KEYS.pay) || samplePayments();
// Wants: [{id,title,regDate,period,url,memo,registrar,state,doneDate}]
let wants = load(KEYS.wants) || sampleWants();
// Bingo: {seasons:[{key,label,start,end,cells:[25 items],reward,generated}]}
let bingoData = load(KEYS.bingo) || initBingo();
// Stamp: {cards:[{id,title,goal,startDate,cells:[30 bools],stampDates:[],completed,completedDate}], reward}
let stampData = load(KEYS.stamp) || initStamp();
let stampReward = load(KEYS.stampReward) || '互いに好きな報酬を決める 🎁';
let bingoReward = load(KEYS.bingoReward) || '好きなレストランへのディナー 🍽️';

/* ═══════════════════════════════════════════════════════════
   SAMPLE DATA
═══════════════════════════════════════════════════════════ */
function samplePayments(){
  return [
    {id:uid(),date:'2026-04-06T14:00',amount:800,memo:'ランチ',target:'A',state:'unpaid',paidDate:null},
    {id:uid(),date:'2026-04-05T16:00',amount:1200,memo:'カフェ',target:'A',state:'unpaid',paidDate:null},
    {id:uid(),date:'2026-04-01T01:00',amount:100,memo:'コンビニ',target:'A',state:'paid',paidDate:'2026-04-02T10:00'},
    {id:uid(),date:'2026-04-04T12:00',amount:1000,memo:'夕食',target:'B',state:'unpaid',paidDate:null},
    {id:uid(),date:'2026-03-30T09:00',amount:500,memo:'交通費',target:'B',state:'paid',paidDate:'2026-04-01T09:00'},
  ];
}
function sampleWants(){
  return [
    {id:uid(),title:'花畑へ行く',regDate:'2026-03-02',period:'2026/4/1〜4/30',url:'',memo:'春限定',registrar:'A',state:'pending',doneDate:null},
    {id:uid(),title:'水族館デート',regDate:'2026-03-02',period:'',url:'',memo:'',registrar:'B',state:'pending',doneDate:null},
    {id:uid(),title:'お化け屋敷',regDate:'2026-03-02',period:'2026/4/20〜5/5',url:'',memo:'',registrar:'A',state:'pending',doneDate:null},
    {id:uid(),title:'動物園',regDate:'2026-03-02',period:'',url:'',memo:'',registrar:'B',state:'done',doneDate:'2026-03-15'},
    {id:uid(),title:'映画鑑賞',regDate:'2026-02-10',period:'',url:'',memo:'',registrar:'A',state:'done',doneDate:'2026-02-20'},
  ];
}

/* ═══════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════ */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6) }
function fmtDate(s){ if(!s)return '-'; const d=new Date(s); if(isNaN(d))return s; return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
function fmtDay(s){ if(!s)return '-'; const d=new Date(s); if(isNaN(d))return s; return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` }
function yen(n){ return '¥'+Number(n).toLocaleString() }
function nowISO(){ const n=new Date();n.setSeconds(0,0);return n.toISOString().slice(0,16) }
function todayStr(){ return new Date().toISOString().slice(0,10) }

/* ─── 3ヶ月・3年 自動削除 ─── */
function autoClean(){
  const now=Date.now();
  const m3=3*30*24*60*60*1000;
  const y3=3*365*24*60*60*1000;
  payments=payments.filter(p=>now-new Date(p.date).getTime()<m3);
  wants=wants.filter(w=>{ if(w.state!=='done')return true; return !w.doneDate||(now-new Date(w.doneDate).getTime()<y3) });
  // bingo cards older than 3 years
  if(bingoData.seasons){ bingoData.seasons=bingoData.seasons.filter(s=>now-new Date(s.generated).getTime()<y3) }
  save(KEYS.pay,payments); save(KEYS.wants,wants); save(KEYS.bingo,bingoData);
}

/* ═══════════════════════════════════════════════════════════
   SCREEN NAVIGATION
═══════════════════════════════════════════════════════════ */
const NAV_MAP={'sc-home':'nav-home','sc-pay':'nav-pay','sc-wants':'nav-wants','sc-stamp':'nav-stamp'};
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const navId=NAV_MAP[id];
  if(navId) document.getElementById(navId).classList.add('active');
  // render on show
  if(id==='sc-home') renderHome();
  else if(id==='sc-pay') renderPay();
  else if(id==='sc-wants') renderWants();
  else if(id==='sc-bingo') renderBingo();
  else if(id==='sc-stamp') renderStamp();
}

/* ═══════════════════════════════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════════════════════════════ */
function openModal(id){ document.getElementById(id).classList.add('open') }
function closeModal(id){ document.getElementById(id).classList.remove('open') }
function overlayClose(e,id){ if(e.target===document.getElementById(id)) closeModal(id) }

/* ═══════════════════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════════════════ */
function renderHome(){
  const el=document.getElementById('home-scroll');
  const unA=payments.filter(p=>p.target==='A'&&p.state==='unpaid').reduce((s,p)=>s+p.amount,0);
  const unB=payments.filter(p=>p.target==='B'&&p.state==='unpaid').reduce((s,p)=>s+p.amount,0);
  const diff=unB-unA;
  const diffLabel=diff>0?`相手(B)が ${yen(diff)} 多く払うべき`:diff<0?`自分(A)が ${yen(-diff)} 多く払うべき`:'差額なし ✨';

  // notices
  const today=new Date(); today.setHours(0,0,0,0);
  const notices=[];
  // wants ending soon (within 7 days)
  wants.filter(w=>w.state==='pending'&&w.period).forEach(w=>{
    const m=w.period.match(/(\d{4}\/\d{1,2}\/\d{1,2})/g);
    if(m&&m.length>=2){ const end=new Date(m[1].replace(/\//g,'-')); if(!isNaN(end)){ const days=Math.ceil((end-today)/(86400000)); if(days>=0&&days<=7) notices.push({dot:'blue',text:`「${w.title}」の期間終了まであと${days}日`}) }}
  });
  // stamp not pressed today
  const latestCard=stampData.cards[stampData.cards.length-1];
  if(latestCard&&!latestCard.completed){
    const todayStamped=latestCard.stampDates&&latestCard.stampDates.some(d=>d&&d.startsWith(todayStr()));
    const stamped=latestCard.cells.filter(Boolean).length;
    const remain=30-stamped;
    if(!todayStamped) notices.push({dot:'orange',text:`今日のスタンプがまだ！残り${remain}マス`});
  }

  el.innerHTML=`
    <div class="home-hero">
      <div class="home-hero-label">💰 支払い差額サマリー</div>
      <div class="home-hero-amount">${yen(Math.abs(diff))}</div>
      <div class="home-hero-sub">${diffLabel}</div>
    </div>
    <div class="home-grid">
      <div class="home-card"><div class="home-card-icon">👤</div><div class="home-card-label">自分の未払い</div><div class="home-card-value">${yen(unA)}</div></div>
      <div class="home-card"><div class="home-card-icon">👫</div><div class="home-card-label">相手の未払い</div><div class="home-card-value">${yen(unB)}</div></div>
      <div class="home-card"><div class="home-card-icon">📋</div><div class="home-card-label">やりたいこと</div><div class="home-card-value">${wants.filter(w=>w.state==='pending').length}<span style="font-size:13px;font-weight:400;color:var(--sub)"> 件</span></div><div class="home-card-sub">実行済: ${wants.filter(w=>w.state==='done').length}件</div></div>
      <div class="home-card"><div class="home-card-icon">🔖</div><div class="home-card-label">スタンプ</div><div class="home-card-value">${latestCard?latestCard.cells.filter(Boolean).length:0}<span style="font-size:13px;font-weight:400;color:var(--sub)"> / 30</span></div><div class="home-card-sub">${latestCard&&!latestCard.completed?'進行中':'完了済み'}</div></div>
    </div>
    ${notices.length?`<div class="sec-label">お知らせ</div>${notices.map(n=>`<div class="notice-card"><div class="notice-dot ${n.dot}"></div><div class="notice-text">${n.text}</div></div>`).join('')}`:''}
    <div class="sec-label">期限が近いやりたいこと</div>
    ${renderUpcomingWants()}
  `;
}
function renderUpcomingWants(){
  const today=new Date(); today.setHours(0,0,0,0);
  const upcoming=wants.filter(w=>w.state==='pending'&&w.period).sort((a,b)=>{
    const ea=endDate(a.period),eb=endDate(b.period); return (ea||Infinity)-(eb||Infinity);
  }).slice(0,3);
  if(!upcoming.length) return '<div class="empty"><div class="empty-icon">🌸</div><div class="empty-text">期限付きの予定はありません</div></div>';
  return upcoming.map(w=>`<div class="notice-card" onclick="openWantsDetail('${w.id}')"><div class="notice-dot blue"></div><div class="notice-text"><strong>${w.title}</strong><br>${w.period}</div></div>`).join('');
}
function endDate(period){ const m=period.match(/(\d{4}\/\d{1,2}\/\d{1,2})/g); if(!m||m.length<2)return null; const d=new Date(m[1].replace(/\//g,'-')); return isNaN(d)?null:d }

/* ═══════════════════════════════════════════════════════════
   PAYMENT
═══════════════════════════════════════════════════════════ */
let payTab='A';
let payTarget='A',payState='unpaid';

function switchPayTab(t){
  payTab=t;
  document.getElementById('payTabA').className='tab-pill '+(t==='A'?'on':'off');
  document.getElementById('payTabB').className='tab-pill '+(t==='B'?'on':'off');
  document.getElementById('payArrow').style.transform=t==='B'?'scaleX(-1)':'scaleX(1)';
  renderPay();
}

function renderPay(){
  const el=document.getElementById('pay-scroll');
  const mine=payments.filter(p=>p.target===payTab);
  const other=payments.filter(p=>p.target===(payTab==='A'?'B':'A'));
  const unpaid=mine.filter(p=>p.state==='unpaid').sort((a,b)=>b.date.localeCompare(a.date));
  const paid=mine.filter(p=>p.state==='paid').sort((a,b)=>b.date.localeCompare(a.date));
  const unTotal=unpaid.reduce((s,p)=>s+p.amount,0);
  const otherUnTotal=other.filter(p=>p.state==='unpaid').reduce((s,p)=>s+p.amount,0);
  const diff=otherUnTotal-unTotal;
  const diffStr=(diff>=0?'＋':'－')+yen(Math.abs(diff));
  const diffClass=diff>=0?'positive':'negative';

  function row(p){
    return `<div class="card-row" onclick="openPayDetail('${p.id}')">
      <div class="row-main">
        <div class="row-title">${fmtDate(p.date)}</div>
        ${p.memo?`<div class="row-sub">${p.memo}</div>`:''}
      </div>
      <div class="row-right">
        <div class="amount">${yen(p.amount)}</div>
      </div>
    </div>`;
  }

  el.innerHTML=`
    <div class="sec-label">未支払い</div>
    <div class="card">${unpaid.length?unpaid.map(row).join(''):'<div class="empty" style="padding:20px"><div class="empty-text">データなし</div></div>'}</div>
    <div class="sec-label">支払済み</div>
    <div class="card">${paid.length?paid.map(row).join(''):'<div class="empty" style="padding:20px"><div class="empty-text">データなし</div></div>'}</div>
    <div class="sec-label">合計</div>
    <div class="card">
      <div class="card-row"><div class="row-main"><div class="row-title">未支払合計</div></div><div class="amount">${yen(unTotal)}</div></div>
      <div class="card-row"><div class="row-main"><div class="row-title">相手との差額</div></div><div class="amount" style="color:var(--${diff>=0?'green':'red'})">${diffStr}</div></div>
    </div>
    <div style="height:8px"></div>
  `;
}

function openPayModal(){
  document.getElementById('p-date').value=nowISO();
  document.getElementById('p-amount').value='';
  document.getElementById('p-memo').value='';
  setPayTarget(payTab);
  setPayState('unpaid');
  openModal('payModal');
}
function setPayTarget(t){
  payTarget=t;
  document.getElementById('p-tgtA').className='tgl '+(t==='A'?'tgl-accent':'tgl-off');
  document.getElementById('p-tgtB').className='tgl '+(t==='B'?'tgl-accent':'tgl-off');
}
function setPayState(s){
  payState=s;
  document.getElementById('p-unpaid').className='tgl '+(s==='unpaid'?'tgl-red':'tgl-off');
  document.getElementById('p-paid').className='tgl '+(s==='paid'?'tgl-green':'tgl-off');
}
function submitPay(){
  const date=document.getElementById('p-date').value;
  const amount=parseInt(document.getElementById('p-amount').value,10);
  if(!date||isNaN(amount)||amount<1){alert('日時と金額を入力してください');return}
  payments.push({id:uid(),date,amount,memo:document.getElementById('p-memo').value,target:payTarget,state:payState,paidDate:payState==='paid'?date:null});
  payments.sort((a,b)=>b.date.localeCompare(a.date));
  save(KEYS.pay,payments);
  closeModal('payModal');
  renderPay();
  renderHome();
}

function openPayDetail(id){
  const p=payments.find(x=>x.id===id); if(!p)return;
  document.getElementById('payDetailContent').innerHTML=`
    <div class="detail-title">${yen(p.amount)}</div>
    <div class="detail-row"><span class="detail-key">発生日時</span><span class="detail-val">${fmtDate(p.date)}</span></div>
    <div class="detail-row"><span class="detail-key">支払者</span><span class="detail-val">${p.target==='A'?'自分(A)':'相手(B)'}</span></div>
    <div class="detail-row"><span class="detail-key">状態</span><span class="detail-val">${p.state==='paid'?'✅ 支払済み':'⏳ 未支払い'}</span></div>
    ${p.paidDate?`<div class="detail-row"><span class="detail-key">支払日時</span><span class="detail-val">${fmtDate(p.paidDate)}</span></div>`:''}
    ${p.memo?`<div class="detail-row"><span class="detail-key">メモ</span><span class="detail-val">${p.memo}</span></div>`:''}
  `;
  document.getElementById('payDeleteBtn').onclick=()=>{
    if(confirm('削除しますか？')){ payments=payments.filter(x=>x.id!==id); save(KEYS.pay,payments); closeModal('payDetailModal'); renderPay(); renderHome(); }
  };
  openModal('payDetailModal');
}

/* ═══════════════════════════════════════════════════════════
   WANTS LIST
═══════════════════════════════════════════════════════════ */
let wantsReg='A',wantsState='pending';

function renderWants(){
  const el=document.getElementById('wants-scroll');
  const q=document.getElementById('wants-search')?.value?.toLowerCase()||'';
  const list=wants.filter(w=>!q||w.title.toLowerCase().includes(q)).sort((a,b)=>b.regDate.localeCompare(a.regDate));
  const pending=list.filter(w=>w.state==='pending');
  const done=list.filter(w=>w.state==='done');
  const total=wants.length,doneCount=wants.filter(w=>w.state==='done').length;
  const aCount=wants.filter(w=>w.registrar==='A').length,bCount=wants.filter(w=>w.registrar==='B').length;

  function row(w){
    return `<div class="card-row" onclick="openWantsDetail('${w.id}')">
      <div class="row-main">
        <div class="row-title">${w.title}</div>
        <div class="row-sub">登録: ${fmtDay(w.regDate)} · ${w.registrar==='A'?'自分(A)':'相手(B)'}</div>
      </div>
      <div class="row-right">
        <span class="badge ${w.state==='done'?'badge-green':'badge-orange'}">${w.state==='done'?'実行済':'未実行'}</span>
      </div>
    </div>`;
  }

  el.innerHTML=`
    <div class="search-bar">
      <span style="color:var(--sub)">🔍</span>
      <input class="search-input" id="wants-search" placeholder="検索..." oninput="renderWants()" value="${q}"/>
    </div>
    <div class="chart-row">
      <div class="chart-box">
        <div class="chart-label">実行率</div>
        <canvas class="pie" id="pie-rate"></canvas>
        <div style="font-size:11px;color:var(--sub);margin-top:6px">${doneCount}/${total}件</div>
      </div>
      <div class="chart-box">
        <div class="chart-label">登録数の割合</div>
        <canvas class="pie" id="pie-reg"></canvas>
        <div style="font-size:11px;color:var(--sub);margin-top:6px">A:${aCount} / B:${bCount}</div>
      </div>
    </div>
    <div class="sec-label">未実行 (${pending.length})</div>
    <div class="card">${pending.length?pending.map(row).join(''):'<div class="empty" style="padding:20px"><div class="empty-text">データなし</div></div>'}</div>
    <div class="sec-label">実行済み (${done.length})</div>
    <div class="card">${done.length?done.map(row).join(''):'<div class="empty" style="padding:20px"><div class="empty-text">データなし</div></div>'}</div>
    <div style="height:8px"></div>
  `;
  drawPie('pie-rate',[doneCount,total-doneCount],['#34c759','#e5e5ea']);
  drawPie('pie-reg',[aCount,bCount],['#7c7aff','#ff9500']);
}

function drawPie(id,data,colors){
  const c=document.getElementById(id); if(!c)return;
  c.width=80;c.height=80;
  const ctx=c.getContext('2d');
  const total=data.reduce((s,v)=>s+v,0)||1;
  let angle=-Math.PI/2;
  data.forEach((v,i)=>{
    const slice=(v/total)*2*Math.PI;
    ctx.beginPath();ctx.moveTo(40,40);
    ctx.arc(40,40,36,angle,angle+slice);
    ctx.closePath();ctx.fillStyle=colors[i];ctx.fill();
    angle+=slice;
  });
  ctx.beginPath();ctx.arc(40,40,22,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
}

function openWantsModal(){
  document.getElementById('w-title').value='';
  document.getElementById('w-regdate').value=todayStr();
  document.getElementById('w-period').value='';
  document.getElementById('w-url').value='';
  document.getElementById('w-memo').value='';
  setWantsReg('A');
  setWantsState('pending');
  openModal('wantsModal');
}
function setWantsReg(r){
  wantsReg=r;
  document.getElementById('w-regA').className='tgl '+(r==='A'?'tgl-accent':'tgl-off');
  document.getElementById('w-regB').className='tgl '+(r==='B'?'tgl-accent':'tgl-off');
}
function setWantsState(s){
  wantsState=s;
  document.getElementById('w-pending').className='tgl '+(s==='pending'?'tgl-orange':'tgl-off');
  document.getElementById('w-done').className='tgl '+(s==='done'?'tgl-green':'tgl-off');
}
function submitWants(){
  const title=document.getElementById('w-title').value.trim();
  if(!title){alert('タイトルを入力してください');return}
  wants.push({id:uid(),title,regDate:document.getElementById('w-regdate').value||todayStr(),period:document.getElementById('w-period').value,url:document.getElementById('w-url').value,memo:document.getElementById('w-memo').value,registrar:wantsReg,state:wantsState,doneDate:wantsState==='done'?todayStr():null});
  save(KEYS.wants,wants);
  closeModal('wantsModal');
  renderWants();
  renderHome();
}

function openWantsDetail(id){
  const w=wants.find(x=>x.id===id); if(!w)return;
  document.getElementById('wantsDetailContent').innerHTML=`
    <div class="detail-title">${w.title}</div>
    <div class="detail-row"><span class="detail-key">登録日</span><span class="detail-val">${fmtDay(w.regDate)}</span></div>
    <div class="detail-row"><span class="detail-key">登録者</span><span class="detail-val">${w.registrar==='A'?'自分(A)':'相手(B)'}</span></div>
    <div class="detail-row"><span class="detail-key">状態</span><span class="detail-val">${w.state==='done'?'✅ 実行済み':'⏳ 未実行'}</span></div>
    ${w.doneDate?`<div class="detail-row"><span class="detail-key">実行日</span><span class="detail-val">${fmtDay(w.doneDate)}</span></div>`:''}
    ${w.period?`<div class="detail-row"><span class="detail-key">イベント期間</span><span class="detail-val">${w.period}</span></div>`:''}
    ${w.url?`<div class="detail-row"><span class="detail-key">URL</span><span class="detail-val"><a href="${w.url}" target="_blank" style="color:var(--accent)">${w.url}</a></span></div>`:''}
    ${w.memo?`<div class="detail-row"><span class="detail-key">メモ</span><span class="detail-val">${w.memo}</span></div>`:''}
  `;
  const toggleBtn=document.getElementById('wantsToggleBtn');
  if(w.state==='done'){
    toggleBtn.textContent='↩ 未実行に戻す';
    toggleBtn.style.background='var(--orange)';
    toggleBtn.onclick=()=>{ w.state='pending';w.doneDate=null;save(KEYS.wants,wants);closeModal('wantsDetailModal');renderWants();renderHome(); };
  } else {
    toggleBtn.textContent='✅ 実行済みにする';
    toggleBtn.style.background='var(--green)';
    toggleBtn.onclick=()=>{ w.state='done';w.doneDate=todayStr();save(KEYS.wants,wants);closeModal('wantsDetailModal');renderWants();renderHome(); };
  }
  document.getElementById('wantsDeleteBtn').onclick=()=>{
    if(confirm('削除しますか？')){ wants=wants.filter(x=>x.id!==id);save(KEYS.wants,wants);closeModal('wantsDetailModal');renderWants();renderHome(); }
  };
  openModal('wantsDetailModal');
}

/* ═══════════════════════════════════════════════════════════
   BINGO
═══════════════════════════════════════════════════════════ */
const SEASONS=[
  {key:'spring',label:'🌸 春',start:'03-01',end:'05-31'},
  {key:'summer',label:'🌻 夏',start:'06-01',end:'08-31'},
  {key:'autumn',label:'🍂 秋',start:'09-01',end:'11-30'},
  {key:'winter',label:'❄️ 冬',start:'12-01',end:'02-28'},
];

function initBingo(){
  const data={seasons:[]};
  // generate all 4 seasons for current year
  const y=new Date().getFullYear();
  SEASONS.forEach(s=>{
    const key=`${y}-${s.key}`;
    if(!data.seasons.find(x=>x.key===key)){
      data.seasons.push({key,label:`${y}年 ${s.label}`,seasonKey:s.key,start:`${y}/${s.start.replace('-','/')}`,end:s.key==='winter'?`${y+1}/02/28`:`${y}/${s.end.replace('-','/')}`,cells:Array(25).fill(null),reward:'',generated:new Date().toISOString()});
    }
  });
  return data;
}

let bingoIdx=0;
let bingoEditMode=false;
let editingCellIdx=-1;

function getCurrentSeason(){
  const now=new Date(); const m=now.getMonth()+1;
  if(m>=3&&m<=5)return 'spring';
  if(m>=6&&m<=8)return 'summer';
  if(m>=9&&m<=11)return 'autumn';
  return 'winter';
}

function isSeasonExpired(s){
  const end=new Date(s.end.replace(/\//g,'-')+'T23:59:59');
  return new Date()>end;
}

function checkBingo(cells){
  const lines=[];
  // rows
  for(let r=0;r<5;r++){const row=[];for(let c=0;c<5;c++)row.push(r*5+c);lines.push(row)}
  // cols
  for(let c=0;c<5;c++){const col=[];for(let r=0;r<5;r++)col.push(r*5+c);lines.push(col)}
  // diag
  lines.push([0,6,12,18,24]);lines.push([4,8,12,16,20]);
  return lines.filter(line=>line.every(i=>cells[i]&&cells[i].cleared));
}

function renderBingo(){
  ensureBingoSeasons();
  const seasons=bingoData.seasons;
  if(!seasons||!seasons.length){document.getElementById('bingo-scroll').innerHTML='<div class="empty"><div class="empty-icon">🎯</div><div class="empty-text">ビンゴカードがありません</div></div>';return}
  if(bingoIdx>=seasons.length)bingoIdx=seasons.length-1;
  if(bingoIdx<0)bingoIdx=0;
  const s=seasons[bingoIdx];
  const expired=isSeasonExpired(s);
  const bingoLines=checkBingo(s.cells);
  const clearSet=new Set(bingoLines.flat());

  // edit btn
  const editBtn=document.getElementById('bingoEditBtn');
  if(expired){editBtn.style.display='none';bingoEditMode=false}
  else{editBtn.style.display='flex'}
  document.getElementById('editModeBar').className='edit-mode-bar'+(bingoEditMode?' show':'');

  const grid=s.cells.map((cell,i)=>{
    const inLine=clearSet.has(i);
    const cls=inLine?'bingo-cell bingo-line':cell&&cell.cleared?'bingo-cell cleared':'bingo-cell';
    const label=cell?cell.title:'';
    return `<div class="${cls}" onclick="bingoCellClick(${i})">${label}</div>`;
  }).join('');

  const rewardText=s.reward||bingoReward;

  document.getElementById('bingo-scroll').innerHTML=`
    <div class="bingo-nav">
      <button class="bingo-nav-btn" onclick="moveBingo(-1)">‹</button>
      <div class="bingo-season-label">${s.label}</div>
      <button class="bingo-nav-btn" onclick="moveBingo(1)">›</button>
    </div>
    <div class="bingo-wrap">
      <div class="bingo-title">BINGO</div>
      <div class="bingo-grid">${grid}</div>
    </div>
    ${bingoLines.length?`<div style="background:linear-gradient(135deg,#f59e0b,var(--orange));border-radius:var(--r);padding:14px 16px;margin-bottom:12px;color:#fff;font-weight:700;font-size:15px;text-align:center">🎉 ビンゴ達成！報酬をゲット！</div>`:''}
    <div class="bingo-reward">
      <div class="reward-title">ビンゴ報酬について <button onclick="openBingoRewardModal('${s.key}')" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:12px">${expired?'':'✏️ 編集'}</button></div>
      <div class="reward-text">${rewardText}</div>
    </div>
    <div style="height:8px"></div>
  `;
}

function moveBingo(dir){
  bingoIdx=Math.max(0,Math.min(bingoData.seasons.length-1,bingoIdx+dir));
  renderBingo();
}

function ensureBingoSeasons(){
  if(!bingoData.seasons)bingoData.seasons=[];
  const y=new Date().getFullYear();
  SEASONS.forEach(s=>{
    const key=`${y}-${s.key}`;
    if(!bingoData.seasons.find(x=>x.key===key)){
      bingoData.seasons.push({key,label:`${y}年 ${s.label}`,seasonKey:s.key,start:`${y}/${s.start.replace('-','/')}`,end:s.key==='winter'?`${y+1}/02/28`:`${y}/${s.end.replace('-','/')}`,cells:Array(25).fill(null),reward:'',generated:new Date().toISOString()});
    }
  });
  save(KEYS.bingo,bingoData);
}

function toggleBingoEdit(){
  bingoEditMode=!bingoEditMode;
  renderBingo();
}

function bingoCellClick(idx){
  const s=bingoData.seasons[bingoIdx];
  const expired=isSeasonExpired(s);
  if(bingoEditMode&&!expired){
    editingCellIdx=idx;
    // show wants list to pick from
    const el=document.getElementById('bingoCellList');
    const pendingWants=wants.filter(w=>w.state==='pending');
    if(!pendingWants.length){el.innerHTML='<div class="empty"><div class="empty-text">未実行のやりたいことがありません</div></div>'}
    else{
      el.innerHTML=pendingWants.map(w=>`<div class="card-row" onclick="setBingoCell('${w.id}')"><div class="row-main"><div class="row-title">${w.title}</div><div class="row-sub">${fmtDay(w.regDate)}</div></div></div>`).join('');
    }
    el.innerHTML+='<div class="card-row" onclick="clearBingoCell()" style="color:var(--red)">🗑 このマスをクリア</div>';
    openModal('bingoCellModal');
  } else {
    // view mode
    const cell=s.cells[idx];
    if(!cell){return}
    document.getElementById('bingoCellViewContent').innerHTML=`
      <div class="detail-title">${cell.title}</div>
      <div class="detail-row"><span class="detail-key">状態</span><span class="detail-val">${cell.cleared?'✅ クリア済み':'⏳ 未クリア'}</span></div>
    `;
    openModal('bingoCellViewModal');
  }
}

function setBingoCell(wantsId){
  const w=wants.find(x=>x.id===wantsId); if(!w)return;
  const s=bingoData.seasons[bingoIdx];
  s.cells[editingCellIdx]={wantsId,title:w.title,cleared:w.state==='done'};
  save(KEYS.bingo,bingoData);
  closeModal('bingoCellModal');
  renderBingo();
}
function clearBingoCell(){
  bingoData.seasons[bingoIdx].cells[editingCellIdx]=null;
  save(KEYS.bingo,bingoData);
  closeModal('bingoCellModal');
  renderBingo();
}

// sync bingo clear state when wants done
function syncBingoCells(){
  bingoData.seasons.forEach(s=>{
    s.cells.forEach((cell,i)=>{
      if(cell&&cell.wantsId){
        const w=wants.find(x=>x.id===cell.wantsId);
        if(w) s.cells[i]={...cell,cleared:w.state==='done'};
      }
    });
  });
  save(KEYS.bingo,bingoData);
}

function openBingoRewardModal(skey){
  const s=bingoData.seasons.find(x=>x.key===skey);
  document.getElementById('br-text').value=s?s.reward||bingoReward:bingoReward;
  document.getElementById('bingoRewardModal').dataset.skey=skey;
  openModal('bingoRewardModal');
}
function saveBingoReward(){
  const skey=document.getElementById('bingoRewardModal').dataset.skey;
  const text=document.getElementById('br-text').value.trim()||'報酬未設定';
  if(skey){
    const s=bingoData.seasons.find(x=>x.key===skey);
    if(s){s.reward=text;save(KEYS.bingo,bingoData)}
  }
  bingoReward=text;save(KEYS.bingoReward,bingoReward);
  closeModal('bingoRewardModal');
  renderBingo();
}

/* ═══════════════════════════════════════════════════════════
   STAMP CARD
═══════════════════════════════════════════════════════════ */
let stampCardIdx=0;

function initStamp(){
  const card=createStampCard();
  return {cards:[card]};
}
function createStampCard(){
  const now=new Date();
  return {id:uid(),title:`スタンプカード`,goal:'毎日の目標',startDate:now.toISOString(),cells:Array(30).fill(false),stampDates:Array(30).fill(null),completed:false,completedDate:null};
}

function renderStamp(){
  autoNewStampCard();
  const cards=stampData.cards;
  if(!cards||!cards.length){document.getElementById('stamp-scroll').innerHTML='<div class="empty"><div class="empty-text">カードなし</div></div>';return}
  if(stampCardIdx>=cards.length)stampCardIdx=cards.length-1;
  if(stampCardIdx<0)stampCardIdx=0;
  const card=cards[stampCardIdx];
  const stamped=card.cells.filter(Boolean).length;
  const todayStamped=card.stampDates.some(d=>d&&d.startsWith(todayStr()));
  const fab=document.getElementById('stampFab');
  fab.style.display=card.completed||todayStamped?'none':'flex';

  const grid=card.cells.map((s,i)=>`<div class="stamp-cell ${s?'stamped':'empty'}" onclick="viewStampCell(${i},'${card.id}')"></div>`).join('');

  document.getElementById('stamp-scroll').innerHTML=`
    <div class="stamp-nav">
      <button class="bingo-nav-btn" onclick="moveStamp(-1)">‹</button>
      <div class="bingo-season-label">カード ${stampCardIdx+1} / ${cards.length}</div>
      <button class="bingo-nav-btn" onclick="moveStamp(1)">›</button>
    </div>
    <div class="stamp-wrap">
      <div class="stamp-header">
        <div class="stamp-card-title">${card.title}</div>
        <div class="stamp-period">スタンプ目標: ${card.goal} &nbsp;·&nbsp; ${stamped}/30</div>
        <div style="margin-top:6px">
          <input style="font-size:13px;border:none;background:transparent;font-family:inherit;color:var(--sub);text-align:center;width:100%;outline:none" 
            value="${card.goal}" onchange="updateStampGoal('${card.id}',this.value)" placeholder="目標を入力..."/>
        </div>
      </div>
      <div class="stamp-grid">${grid}</div>
      ${card.completed?'<div style="text-align:center;padding:8px;color:var(--green);font-weight:700;font-size:14px">🎉 コンプリート！</div>':''}
    </div>
    <div class="stamp-reward">
      <div class="reward-title">コンプリート報酬 <button onclick="openModal(\'stampRewardModal\')" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:12px">✏️ 編集</button></div>
      <div class="reward-text">${stampReward}</div>
    </div>
    <div style="height:80px"></div>
  `;

  document.getElementById('sr-text').value=stampReward;
}

function moveStamp(dir){
  stampCardIdx=Math.max(0,Math.min(stampData.cards.length-1,stampCardIdx+dir));
  renderStamp();
}

function pressStamp(){
  const card=stampData.cards[stampData.cards.length-1];
  if(!card||card.completed)return;
  // check today already stamped (00:01~24:00)
  const today=todayStr();
  if(card.stampDates.some(d=>d&&d.startsWith(today))){alert('今日はすでにスタンプ済みです');return}
  const nextIdx=card.cells.findIndex(c=>!c);
  if(nextIdx===-1)return;
  card.cells[nextIdx]=true;
  card.stampDates[nextIdx]=new Date().toISOString();
  if(card.cells.every(Boolean)){
    card.completed=true;card.completedDate=new Date().toISOString();
    alert('🎉 スタンプカードコンプリート！報酬をゲット！');
    autoNewStampCard();
  }
  stampCardIdx=stampData.cards.length-1;
  save(KEYS.stamp,stampData);
  renderStamp();
  renderHome();
}

function autoNewStampCard(){
  const cards=stampData.cards;
  if(!cards||!cards.length){stampData.cards=[createStampCard()];save(KEYS.stamp,stampData);return}
  const latest=cards[cards.length-1];
  if(latest.completed&&(!cards[cards.length-1]||latest.completed)){
    // check if new card already created
    const lastCard=cards[cards.length-1];
    if(lastCard.completed){
      const newCard=createStampCard();
      stampData.cards.push(newCard);
      save(KEYS.stamp,stampData);
    }
  }
}

function updateStampGoal(id,val){
  const card=stampData.cards.find(c=>c.id===id);
  if(card){card.goal=val;save(KEYS.stamp,stampData)}
}

function viewStampCell(idx,cardId){
  const card=stampData.cards.find(c=>c.id===cardId); if(!card)return;
  if(!card.cells[idx])return;
  alert(`スタンプ ${idx+1}番目\n押した日時: ${fmtDate(card.stampDates[idx]||'')}`);
}

function saveStampReward(){
  stampReward=document.getElementById('sr-text').value.trim()||'報酬未設定';
  save(KEYS.stampReward,stampReward);
  closeModal('stampRewardModal');
  renderStamp();
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
autoClean();
syncBingoCells();
renderHome();
