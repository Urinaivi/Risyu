let currentPage = 'A';
  let addTarget = 'A';
  let addState  = 'unpaid';

  const dataA = {
    unpaid: [{date:'2026/04/06 14:00', amount:800}, {date:'2026/04/05 16:00', amount:1200}],
    paid:   [{date:'2026/04/01 01:00', amount:100}]
  };
  const dataB = {
    unpaid: [{date:'2026/04/04 12:00', amount:1000}],
    paid:   [{date:'2026/03/30 09:00', amount:500}]
  };

  function fmtYen(n){ return '¥' + n.toLocaleString(); }

  function renderPage(page, anim){
    const el = document.getElementById('scrollArea');
    const data  = page === 'A' ? dataA : dataB;
    const other = page === 'A' ? dataB : dataA;
    const unpaidTotal = data.unpaid.reduce((s,r)=>s+r.amount, 0);
    const otherTotal  = other.unpaid.reduce((s,r)=>s+r.amount, 0);
    const diff = otherTotal - unpaidTotal;
    const diffStr   = (diff >= 0 ? '＋' : '－') + fmtYen(Math.abs(diff));
    const diffClass = diff >= 0 ? 'positive' : 'negative';

    function rows(items){
      if(!items.length) return '<div class="empty-msg">データなし</div>';
      return items.map(r=>`
        <div class="card-item">
          <span class="card-date">${r.date}</span>
          <span class="card-amount">${fmtYen(r.amount)}</span>
        </div>`).join('');
    }

    el.innerHTML = `
      <div class="section-label">未支払い</div>
      <div class="card-list">${rows(data.unpaid)}</div>
      <div class="section-label">支払い済み</div>
      <div class="card-list">${rows(data.paid)}</div>
      <div class="section-label">合計</div>
      <div class="summary-card">
        <div class="summary-row">
          <span class="summary-label">未支払合計</span>
          <span class="summary-amount">${fmtYen(unpaidTotal)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">相手との差額</span>
          <span class="summary-amount ${diffClass}">${diffStr}</span>
        </div>
      </div>`;

    if(anim){
      el.classList.remove('anim-right','anim-left');
      void el.offsetWidth;
      el.classList.add(anim);
    }
  }

  function switchPage(target){
    if(target === currentPage) return;
    const anim = target === 'B' ? 'anim-right' : 'anim-left';
    currentPage = target;
    // update tab colours
    document.getElementById('tabA').className = 'tab-btn ' + (target==='A' ? 'is-active' : 'is-inactive');
    document.getElementById('tabB').className = 'tab-btn ' + (target==='B' ? 'is-active' : 'is-inactive');
    // flip arrow
    document.getElementById('arrowEl').style.transform = target==='B' ? 'scaleX(-1)' : 'scaleX(1)';
    renderPage(currentPage, anim);
  }

  /* ── Modal ── */
  function openModal(){
    const now = new Date(); now.setSeconds(0,0);
    document.getElementById('inputDate').value = now.toISOString().slice(0,16);
    document.getElementById('inputAmount').value = '';
    document.getElementById('inputMemo').value = '';
    setTarget(currentPage);
    setState('unpaid');
    document.getElementById('modalOverlay').classList.add('open');
  }

  function closeModal(){
    document.getElementById('modalOverlay').classList.remove('open');
  }

  function bgClose(e){
    if(e.target === document.getElementById('modalOverlay')) closeModal();
  }

  function setTarget(t){
    addTarget = t;
    document.getElementById('tgtA').className = 'tgl ' + (t==='A' ? 'tgl-purple' : 'tgl-off');
    document.getElementById('tgtB').className = 'tgl ' + (t==='B' ? 'tgl-purple' : 'tgl-off');
  }

  function setState(s){
    addState = s;
    document.getElementById('stUnpaid').className = 'tgl ' + (s==='unpaid' ? 'tgl-red'   : 'tgl-off');
    document.getElementById('stPaid'  ).className = 'tgl ' + (s==='paid'   ? 'tgl-green' : 'tgl-off');
  }

  function submitEntry(){
    const rawDate = document.getElementById('inputDate').value;
    const amount  = parseInt(document.getElementById('inputAmount').value, 10);
    if(!rawDate || isNaN(amount) || amount <= 0){
      alert('日時と金額を正しく入力してください');
      return;
    }
    const d = new Date(rawDate);
    const p = n => String(n).padStart(2,'0');
    const dateStr = `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;

    const data = addTarget === 'A' ? dataA : dataB;
    data[addState].push({date: dateStr, amount});
    data[addState].sort((a,b) => b.date.localeCompare(a.date));

    closeModal();
    renderPage(currentPage, null);
  }

  // init
  renderPage('A', null);