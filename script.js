// ===== DATA STORE =====
let db = {
  agents: [
    { id: 1, name: 'Agent One', note: '' },
    { id: 2, name: 'Agent Two', note: '' }
  ],
  cutting: [],
  finishing: [],
  ledger: []
};

let currentAgentId = 1;
let pendingDelete = null;
const DB_KEY = 'fuji_san_lanka_v1_db';

// ===== INIT & PERFORMANCE ENHANCEMENTS =====
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');
    }, 400); 
});

document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('fuji_san_theme');
  if(theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  const btn = document.getElementById('themeBtn');
  if(btn) btn.textContent = (theme === 'dark') ? '☀️ Light' : '🌙 Dark';
  
  loadOfflineData();
  
  document.querySelectorAll('input, textarea, select').forEach(el=>{
    el.addEventListener('change', requestSaveData);
    el.addEventListener('input', requestSaveData);
  });
});

let saveTimeout = null;
function requestSaveData() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveOfflineData, 1000); 
}

function saveOfflineData(){
  try{
    if (window.electronAPI) { window.electronAPI.saveData(db); }
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    localStorage.setItem('fuji_san_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    const st = document.getElementById('saveStatus');
    if(st){ st.textContent = 'Saved ' + new Date().toLocaleTimeString('en-LK',{hour:'2-digit',minute:'2-digit'}); }
  }catch(e){ console.error('Save error:', e); }
}

async function loadOfflineData(){
  try{
    let loadedDB = null;
    if (window.electronAPI) { 
        loadedDB = await window.electronAPI.loadData(); 
    }
    
    if (!loadedDB) {
      const saved = localStorage.getItem(DB_KEY);
      if(saved) loadedDB = JSON.parse(saved);
    }
    
    if(loadedDB && typeof loadedDB === 'object' && loadedDB.agents) { 
        db = loadedDB; 
    }

    renderAgentTabs();
    renderCurrentPage();
    refreshDash();

  }catch(e){ console.error('Load error:', e); }
}

// ===== THEME & SIDEBAR =====
function toggleTheme(){
  const isDark = document.body.classList.toggle('dark-mode');
  const btn = document.getElementById('themeBtn');
  if(btn) btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  document.body.style.background = '';
  requestSaveData();
}

function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('mobile-open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ===== AGENTS =====
function renderAgentTabs() {
  const tabs = document.getElementById('agentTabs');
  tabs.innerHTML = '';
  db.agents.forEach(a => {
    const btn = document.createElement('div');
    btn.className = 'agent-tab' + (a.id === currentAgentId ? ' active' : '');
    btn.innerHTML = `<span>${a.name}</span><span class="agent-dot"></span>`;
    btn.onclick = () => switchAgent(a.id);
    if (a.id === currentAgentId && db.agents.length > 1) {
      const del = document.createElement('button');
      del.style.cssText = 'font-size:13px;color:var(--accent4);background:transparent;border:none;cursor:pointer;padding:0 3px;margin-left:4px;line-height:1';
      del.textContent = '×';
      del.title = 'Remove agent';
      del.onclick = (e) => { e.stopPropagation(); removeAgent(a.id); };
      btn.appendChild(del);
    }
    tabs.appendChild(btn);
  });
  document.getElementById('agentBadge').textContent = currentAgent().name;
}

function currentAgent() { return db.agents.find(a => a.id === currentAgentId) || db.agents[0]; }

function switchAgent(id) {
  currentAgentId = id;
  renderAgentTabs();
  renderCurrentPage();
  refreshDash();
}

function openAddAgentModal() {
  document.getElementById('newAgentName').value = '';
  document.getElementById('newAgentNote').value = '';
  openModal('addAgentModal');
}

function addAgent() {
  const name = document.getElementById('newAgentName').value.trim();
  if (!name) { showToast('⚠️ Agent name required', 'error'); return; }
  const id = Date.now();
  db.agents.push({ id, name, note: document.getElementById('newAgentNote').value });
  currentAgentId = id;
  renderAgentTabs();
  closeModal('addAgentModal');
  refreshDash();
  saveOfflineData();
  showToast('✅ Agent "' + name + '" created');
}

function removeAgent(id) {
  if (db.agents.length <= 1) { showToast('Cannot remove last agent', 'error'); return; }
  if (!confirm('Remove this agent and all their data?')) return;
  db.agents = db.agents.filter(a => a.id !== id);
  db.cutting = db.cutting.filter(e => e.agentId !== id);
  db.finishing = db.finishing.filter(e => e.agentId !== id);
  db.ledger = db.ledger.filter(e => e.agentId !== id);
  currentAgentId = db.agents[0].id;
  renderAgentTabs();
  renderCurrentPage();
  refreshDash();
  saveOfflineData();
  showToast('Agent removed');
}

// ===== NAVIGATION =====
function navTo(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('page-' + page).classList.add('active');
  const titles = { dashboard: 'Executive Dashboard', cutting: 'Cutting & Dispatch Log', finishing: 'Finishing Receipts', ledger: 'Account Ledger', summary: 'Statement & Invoice' };
  document.getElementById('topTitle').textContent = titles[page] || page;
  if (page === 'finishing') { populateCutDropdown(); renderFinTable(); }
  if (page === 'cutting') renderCutTable();
  if (page === 'ledger') renderLedTable();
  if (page === 'dashboard') refreshDash();
  if (page === 'summary') buildInvoice();
}

function renderCurrentPage() {
  const active = document.querySelector('.page.active');
  if (!active) return;
  const id = active.id.replace('page-', '');
  if (id === 'cutting') renderCutTable();
  else if (id === 'finishing') { renderFinTable(); populateCutDropdown(); }
  else if (id === 'ledger') renderLedTable();
  else if (id === 'dashboard') refreshDash();
  else if (id === 'summary') buildInvoice();
}

// ===== ACCESSORIES =====
function addAccessoryField() {
    const container = document.getElementById('accessoriesContainer');
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.innerHTML = `
        <input class="form-input acc-name" placeholder="Item Name (e.g., Buttons, Twill Roll)" style="flex:2">
        <input type="number" class="form-input acc-qty" placeholder="Qty" style="flex:1">
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">❌</button>
    `;
    container.appendChild(row);
}
function getAccessories() {
    const accs = [];
    document.querySelectorAll('#accessoriesContainer > div').forEach(row => {
        const name = row.querySelector('.acc-name').value.trim();
        const qty = row.querySelector('.acc-qty').value.trim();
        if (name && qty) accs.push({name, qty});
    });
    return accs;
}

// ===== CUTTING =====
function calcCut() {
  const l = parseFloat(document.getElementById('cLayers').value) || 0;
  const s = parseFloat(document.getElementById('cSizes').value) || 0;
  const r = parseFloat(document.getElementById('cRate').value) || 0;
  document.getElementById('cExpQty').textContent = (l * s);
  document.getElementById('cProjVal').textContent = (l * s * r).toFixed(2);
}

function addCutting() {
  const inv = document.getElementById('cInvoice').value.trim();
  const date = document.getElementById('cDate').value;
  const layers = parseFloat(document.getElementById('cLayers').value);
  const sizes = parseFloat(document.getElementById('cSizes').value);
  const rate = parseFloat(document.getElementById('cRate').value);
  const status = document.getElementById('cStatus').value;
  if (!inv || !date || !layers || !sizes || !rate || !status) { showToast('⚠️ Please fill all required fields', 'error'); return; }
  db.cutting.push({
    id: Date.now(), agentId: currentAgentId, invoiceNo: inv, date, layers, sizes,
    itemName: document.getElementById('cItemName').value.trim(),
    description: document.getElementById('cDescription').value.trim(),
    sizesLabel: document.getElementById('cSizesLabel').value.trim(),
    accessories: getAccessories(),
    expectedQty: layers * sizes, unitRate: rate, projectedValue: layers * sizes * rate, status
  });
  renderCutTable(); clearCuttingForm(); refreshDash(); saveOfflineData(); showToast('✅ Dispatch added');
}

function renderCutTable() {
  const tb = document.querySelector('#cutTable tbody'); tb.innerHTML = '';
  const rows = db.cutting.filter(e => e.agentId === currentAgentId);
  if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="12">No entries yet.</td></tr>'; return; }
  rows.forEach(e => {
    const tr = tb.insertRow();
    const statusClass = e.status === 'Completed' ? 'badge-completed' : e.status === 'In Progress' ? 'badge-inprogress' : 'badge-pending';
    tr.innerHTML = `
      <td style="font-weight:600;color:var(--text)">${e.invoiceNo}</td><td>${fmtDate(e.date)}</td>
      <td style="font-weight:500;color:var(--text)">${e.itemName || '—'}</td><td style="color:var(--text2)">${e.description || '—'}</td>
      <td>${e.layers}</td><td>${e.sizes}</td><td style="color:var(--text2)">${e.sizesLabel || '—'}</td>
      <td><strong>${e.expectedQty}</strong></td><td>LKR ${e.unitRate.toFixed(2)}</td><td>LKR ${e.projectedValue.toFixed(2)}</td>
      <td><span class="badge ${statusClass}">${e.status}</span></td>
      <td><div class="action-cell">
        <button class="btn btn-warning btn-sm" onclick="openEditCut(${e.id})" title="Edit">✏️</button>
        <button class="btn btn-pdf btn-sm" onclick="pdfCutInvoice(${e.id})" title="PDF">📄</button>
        <button class="btn btn-ghost btn-sm" onclick="printCutInvoice(${e.id})" title="Print">🖨️</button>
        <button class="btn btn-danger btn-sm" onclick="askDelete('cutting',${e.id})" title="Delete">🗑️</button>
      </div></td>`;
  });
}

function clearCuttingForm() {
  ['cInvoice','cDate','cLayers','cSizes','cRate','cStatus','cItemName','cDescription','cSizesLabel'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('accessoriesContainer').innerHTML = ''; calcCut();
}

function openEditCut(id) {
  const e = db.cutting.find(x => x.id === id); if (!e) return;
  document.getElementById('editCutId').value = id; document.getElementById('ecInvoice').value = e.invoiceNo;
  document.getElementById('ecDate').value = e.date; document.getElementById('ecLayers').value = e.layers;
  document.getElementById('ecSizes').value = e.sizes; document.getElementById('ecRate').value = e.unitRate;
  document.getElementById('ecStatus').value = e.status; document.getElementById('ecItemName').value = e.itemName || '';
  document.getElementById('ecDescription').value = e.description || ''; document.getElementById('ecSizesLabel').value = e.sizesLabel || '';
  calcEditCut(); openModal('editCutModal');
}

function calcEditCut() {
  const l = parseFloat(document.getElementById('ecLayers').value) || 0;
  const s = parseFloat(document.getElementById('ecSizes').value) || 0;
  const r = parseFloat(document.getElementById('ecRate').value) || 0;
  document.getElementById('ecCalcNote').innerHTML = `<strong>Expected Qty:</strong> ${l * s} units &nbsp;|&nbsp; <strong>Projected Value:</strong> LKR ${(l * s * r).toFixed(2)}`;
}

function saveEditCut() {
  const id = parseInt(document.getElementById('editCutId').value); const e = db.cutting.find(x => x.id === id); if (!e) return;
  e.invoiceNo = document.getElementById('ecInvoice').value.trim() || e.invoiceNo; e.date = document.getElementById('ecDate').value;
  e.layers = parseFloat(document.getElementById('ecLayers').value) || e.layers; e.sizes = parseFloat(document.getElementById('ecSizes').value) || e.sizes;
  e.unitRate = parseFloat(document.getElementById('ecRate').value) || e.unitRate; e.status = document.getElementById('ecStatus').value;
  e.itemName = document.getElementById('ecItemName').value.trim(); e.description = document.getElementById('ecDescription').value.trim();
  e.sizesLabel = document.getElementById('ecSizesLabel').value.trim(); e.expectedQty = e.layers * e.sizes; e.projectedValue = e.expectedQty * e.unitRate;
  closeModal('editCutModal'); renderCutTable(); refreshDash(); saveOfflineData(); showToast('✅ Updated');
}

function setupCutInvoiceTemplate(id) {
    const e = db.cutting.find(x => x.id === id); if (!e) return false;
    const agent = db.agents.find(a => a.id === e.agentId);
    document.getElementById('ci-no').textContent = e.invoiceNo; document.getElementById('ci-date').textContent = 'Date: ' + fmtDate(e.date);
    document.getElementById('ci-agent').textContent = agent.name; document.getElementById('ci-item').textContent = e.itemName || '—';
    document.getElementById('ci-desc').textContent = e.description || '—'; document.getElementById('ci-cuts').textContent = e.layers;
    document.getElementById('ci-layers').textContent = e.sizes; document.getElementById('ci-exp').textContent = e.expectedQty;
    const accTbody = document.getElementById('ci-acc-tbody'); accTbody.innerHTML = '';
    if (e.accessories && e.accessories.length > 0) {
        e.accessories.forEach(acc => accTbody.innerHTML += `<tr><td>${acc.name}</td><td>${acc.qty}</td></tr>`);
    } else { accTbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#999;font-style:italic">No accessories</td></tr>'; }
    return true;
}

function printCutInvoice(id) { if(setupCutInvoiceTemplate(id)) printElementAsPNG('cutInvoiceArea'); }
function pdfCutInvoice(id) { if(setupCutInvoiceTemplate(id)) captureMultiPagePDF('cutInvoiceArea', `Cut_Issue_${id}.pdf`); }

// ===== FINISHING =====
function populateCutDropdown() {
  const sel = document.getElementById('fCutInv'); const cur = sel.value;
  sel.innerHTML = '<option value="">— Select Cut Invoice —</option>';
  db.cutting.filter(e => e.agentId === currentAgentId).forEach(e => sel.innerHTML += `<option value="${e.invoiceNo}">${e.invoiceNo} ${e.itemName ? '— '+e.itemName : ''}</option>`);
  if (cur) sel.value = cur;
}

function onCutSelect() {
  const inv = document.getElementById('fCutInv').value;
  const e = db.cutting.find(x => x.agentId === currentAgentId && x.invoiceNo === inv);
  document.getElementById('fExpQty').value = e ? e.expectedQty : '';
  document.getElementById('fURate').textContent = e ? e.unitRate.toFixed(2) : '0.00';
  calcFin();
}

function calcFin() {
  const exp = parseFloat(document.getElementById('fExpQty').value) || 0;
  const a = parseFloat(document.getElementById('fGradeA').value) || 0;
  const b = parseFloat(document.getElementById('fDmgComp').value) || 0;
  const c = parseFloat(document.getElementById('fWaste').value) || 0;
  const rate = parseFloat(document.getElementById('fURate').textContent) || 0;
  document.getElementById('fTotAcc').textContent = a + b;
  document.getElementById('fShort').textContent = exp - (a + b) - c;
  document.getElementById('fGross').textContent = ((a + b) * rate).toFixed(2);
}

function addFinishing() {
  const subInv = document.getElementById('fSubInv').value.trim(); const cutInv = document.getElementById('fCutInv').value;
  const date = document.getElementById('fDate').value; const gradeA = parseFloat(document.getElementById('fGradeA').value);
  const dmgComp = parseFloat(document.getElementById('fDmgComp').value); const waste = parseFloat(document.getElementById('fWaste').value);
  if (!subInv || !cutInv || !date || isNaN(gradeA) || isNaN(dmgComp) || isNaN(waste)) { showToast('⚠️ Fill all fields', 'error'); return; }
  const ce = db.cutting.find(x => x.agentId === currentAgentId && x.invoiceNo === cutInv); if (!ce) return;
  const totalAcc = gradeA + dmgComp; const gross = totalAcc * ce.unitRate;
  db.finishing.push({ id: Date.now(), agentId: currentAgentId, subInvoice: subInv, cutInvoice: cutInv, date, gradeA, damagedComplete: dmgComp, waste, expectedQty: ce.expectedQty, totalAccepted: totalAcc, shortage: ce.expectedQty - totalAcc - waste, unitRate: ce.unitRate, grossBill: gross });
  db.ledger.push({ id: Date.now()+1, agentId: currentAgentId, date, type: 'Invoice Accrual', reference: subInv, paymentMethod: '', transactionRef: '', debit: 0, credit: gross });
  renderFinTable(); renderLedTable(); clearFinForm(); refreshDash(); saveOfflineData(); showToast('✅ Receipt recorded');
}

function renderFinTable() {
  const tb = document.querySelector('#finTable tbody'); tb.innerHTML = '';
  const rows = db.finishing.filter(e => e.agentId === currentAgentId);
  if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="11">No receipts yet.</td></tr>'; return; }
  rows.forEach(e => {
    tb.innerHTML += `<tr><td style="font-weight:600;color:var(--text)">${e.subInvoice}</td><td>${e.cutInvoice}</td><td>${fmtDate(e.date)}</td><td>${e.gradeA}</td><td>${e.damagedComplete}</td><td>${e.waste}</td><td><strong>${e.totalAccepted}</strong></td><td style="color:${e.shortage>0?'var(--accent4)':'var(--accent2)'}">${e.shortage}</td><td>LKR ${e.unitRate.toFixed(2)}</td><td style="font-weight:600;color:var(--text)">LKR ${e.grossBill.toFixed(2)}</td><td><div class="action-cell"><button class="btn btn-warning btn-sm" onclick="openEditFin(${e.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="askDelete('finishing',${e.id})">🗑️</button></div></td></tr>`;
  });
}

function clearFinForm() { ['fSubInv','fCutInv','fDate','fGradeA','fDmgComp','fWaste','fExpQty'].forEach(id => document.getElementById(id).value = ''); document.getElementById('fURate').textContent = '0.00'; calcFin(); }

function openEditFin(id) {
  const e = db.finishing.find(x => x.id === id); if (!e) return;
  document.getElementById('editFinId').value = id; document.getElementById('efGradeA').value = e.gradeA;
  document.getElementById('efDmgComp').value = e.damagedComplete; document.getElementById('efWaste').value = e.waste;
  document.getElementById('efDate').value = e.date; calcEditFin(); openModal('editFinModal');
}

function calcEditFin() {
  const e = db.finishing.find(x => x.id === parseInt(document.getElementById('editFinId').value)); if (!e) return;
  const a = parseFloat(document.getElementById('efGradeA').value) || 0; const b = parseFloat(document.getElementById('efDmgComp').value) || 0;
  const c = parseFloat(document.getElementById('efWaste').value) || 0; const acc = a + b;
  document.getElementById('efCalcNote').innerHTML = `<strong>Accepted:</strong> ${acc} &nbsp;|&nbsp; <strong>Shortage:</strong> ${e.expectedQty - acc - c} &nbsp;|&nbsp; <strong>Gross Bill:</strong> LKR ${(acc * e.unitRate).toFixed(2)}`;
}

function saveEditFin() {
  const e = db.finishing.find(x => x.id === parseInt(document.getElementById('editFinId').value)); if (!e) return;
  e.gradeA = parseFloat(document.getElementById('efGradeA').value) || 0; e.damagedComplete = parseFloat(document.getElementById('efDmgComp').value) || 0;
  e.waste = parseFloat(document.getElementById('efWaste').value) || 0; e.date = document.getElementById('efDate').value;
  e.totalAccepted = e.gradeA + e.damagedComplete; e.shortage = e.expectedQty - e.totalAccepted - e.waste; e.grossBill = e.totalAccepted * e.unitRate;
  const le = db.ledger.find(x => x.agentId === e.agentId && x.reference === e.subInvoice && x.type === 'Invoice Accrual');
  if (le) { le.credit = e.grossBill; le.date = e.date; }
  closeModal('editFinModal'); renderFinTable(); renderLedTable(); refreshDash(); saveOfflineData(); showToast('✅ Receipt updated');
}

// ===== LEDGER =====
function selectPayPill(el, val) {
  document.querySelectorAll('.pay-pill').forEach(p => p.classList.remove('active')); el.classList.add('active');
  document.getElementById('lPayMtd').value = val;
  document.getElementById('lTxRefGrp').style.display = (val === 'Cheque Payment' || val === 'Online Transfer' || val === 'Bank Deposit') ? 'block' : 'none';
}
function onLedgerType() {
  const t = document.getElementById('lType').value; const isPayment = t === 'Disbursed Payment';
  document.getElementById('lPayMtdGrp').style.display = isPayment ? 'block' : 'none';
  if (!isPayment) { document.getElementById('lTxRefGrp').style.display = 'none'; document.getElementById('lPayMtd').value = ''; document.querySelectorAll('.pay-pill').forEach(p => p.classList.remove('active')); }
  document.getElementById('lAmtLabel').textContent = isPayment ? 'Amount Paid (LKR) *' : 'Amount (LKR) *'; refreshDash();
}

function agentBalance(agentId) { return db.ledger.filter(e => e.agentId === agentId).reduce((b, e) => b + e.credit - e.debit, 0); }

function addLedger() {
  const date = document.getElementById('lDate').value; const type = document.getElementById('lType').value;
  const ref = document.getElementById('lRef').value.trim(); const amt = parseFloat(document.getElementById('lAmt').value);
  if (!date || !type || !ref || !amt || amt <= 0) { showToast('⚠️ Complete required fields properly', 'error'); return; }
  if (type === 'Disbursed Payment' && !document.getElementById('lPayMtd').value) { showToast('⚠️ Select payment method', 'error'); return; }
  db.ledger.push({ id: Date.now(), agentId: currentAgentId, date, type, reference: ref, paymentMethod: document.getElementById('lPayMtd').value, transactionRef: document.getElementById('lTxRef').value.trim(), debit: type === 'Disbursed Payment' ? amt : 0, credit: type === 'Invoice Accrual' ? amt : 0 });
  db.ledger.sort((a, b) => new Date(a.date) - new Date(b.date));
  renderLedTable(); clearLedger(); refreshDash(); saveOfflineData(); showToast('✅ Transaction recorded');
}

function renderLedTable() {
  const tb = document.querySelector('#ledTable tbody'); tb.innerHTML = '';
  const rows = db.ledger.filter(e => e.agentId === currentAgentId);
  if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="8">No transactions yet.</td></tr>'; return; }
  let bal = 0;
  rows.forEach(e => {
    bal += e.credit - e.debit; const tr = tb.insertRow();
    let actions = `<button class="btn btn-warning btn-sm" onclick="openEditLed(${e.id})">✏️</button>`;
    if(e.type === 'Disbursed Payment') { actions += `<button class="btn btn-pdf btn-sm" onclick="pdfReceipt(${e.id})">📄</button><button class="btn btn-ghost btn-sm" onclick="printReceipt(${e.id})">🖨️</button>`; }
    actions += `<button class="btn btn-danger btn-sm" onclick="askDelete('ledger',${e.id})">🗑️</button>`;
    tr.innerHTML = `<td>${fmtDate(e.date)}</td><td><span class="badge badge-${e.type==='Invoice Accrual'?'credit':'debit'}">${e.type}</span></td><td style="color:var(--text)">${e.reference}</td><td>${e.paymentMethod || '—'}</td><td style="color:var(--accent4)">${e.debit > 0 ? 'LKR ' + e.debit.toFixed(2) : '—'}</td><td style="color:var(--accent2)">${e.credit > 0 ? 'LKR ' + e.credit.toFixed(2) : '—'}</td><td style="font-weight:700;color:${bal>=0?'var(--accent3)':'var(--accent2)'}">LKR ${bal.toFixed(2)}</td><td><div class="action-cell">${actions}</div></td>`;
  });
  document.getElementById('lCurBal').textContent = agentBalance(currentAgentId).toFixed(2);
  const newAmt = parseFloat(document.getElementById('lAmt').value) || 0;
  document.getElementById('lNewBal').textContent = (agentBalance(currentAgentId) + (document.getElementById('lType').value === 'Invoice Accrual' ? newAmt : -newAmt)).toFixed(2);
}

function clearLedger() { ['lDate','lType','lRef','lAmt'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); const txRef = document.getElementById('lTxRef'); if(txRef) txRef.value = ''; document.getElementById('lPayMtd').value = ''; document.getElementById('lPayMtdGrp').style.display = 'none'; document.getElementById('lTxRefGrp').style.display = 'none'; document.querySelectorAll('.pay-pill').forEach(p => p.classList.remove('active')); document.getElementById('lAmtLabel').textContent = 'Amount (LKR) *'; }

function openEditLed(id) {
  const e = db.ledger.find(x => x.id === id); if (!e) return;
  document.getElementById('editLedId').value = id; document.getElementById('elDate').value = e.date;
  document.getElementById('elRef').value = e.reference; document.getElementById('elAmt').value = e.debit > 0 ? e.debit : e.credit;
  document.getElementById('elPayMtd').value = e.paymentMethod || ''; document.getElementById('elTxRef').value = e.transactionRef || ''; openModal('editLedModal');
}

function saveEditLed() {
  const e = db.ledger.find(x => x.id === parseInt(document.getElementById('editLedId').value)); if (!e) return;
  e.date = document.getElementById('elDate').value; e.reference = document.getElementById('elRef').value.trim();
  const amt = parseFloat(document.getElementById('elAmt').value) || 0;
  if (e.debit > 0) e.debit = amt; else e.credit = amt;
  e.paymentMethod = document.getElementById('elPayMtd').value; e.transactionRef = document.getElementById('elTxRef').value.trim();
  closeModal('editLedModal'); renderLedTable(); refreshDash(); saveOfflineData(); showToast('✅ Updated');
}

function setupReceiptTemplate(id) {
    const e = db.ledger.find(x => x.id === id); if (!e) return false;
    document.getElementById('rcpt-no').textContent = 'RCPT-' + id.toString().slice(-6);
    document.getElementById('rcpt-date').textContent = 'Date: ' + fmtDate(e.date);
    document.getElementById('rcpt-agent').textContent = db.agents.find(a => a.id === e.agentId).name;
    document.getElementById('rcpt-method').textContent = e.paymentMethod || '—';
    document.getElementById('rcpt-ref').textContent = e.transactionRef || '—';
    document.getElementById('rcpt-amt').textContent = 'LKR ' + e.debit.toFixed(2);
    document.getElementById('rcpt-note').textContent = `Payment applied against outstanding balances.`;
    return true;
}
function printReceipt(id) { if(setupReceiptTemplate(id)) printElementAsPNG('receiptArea'); }
function pdfReceipt(id) { if(setupReceiptTemplate(id)) captureMultiPagePDF('receiptArea', `Receipt_${id}.pdf`); }

// ===== DELETE =====
function askDelete(type, id) { pendingDelete = { type, id }; openModal('deleteModal'); }
function confirmDelete() {
  if (!pendingDelete) return; const { type, id } = pendingDelete;
  if (type === 'cutting') { db.cutting = db.cutting.filter(e => e.id !== id); renderCutTable(); }
  else if (type === 'finishing') { const e = db.finishing.find(x => x.id === id); if (e) db.ledger = db.ledger.filter(x => !(x.reference === e.subInvoice && x.type === 'Invoice Accrual' && x.agentId === e.agentId)); db.finishing = db.finishing.filter(e => e.id !== id); renderFinTable(); renderLedTable(); }
  else if (type === 'ledger') { db.ledger = db.ledger.filter(e => e.id !== id); renderLedTable(); }
  pendingDelete = null; closeModal('deleteModal'); refreshDash(); saveOfflineData(); showToast('🗑️ Deleted');
}

// ===== DASHBOARD =====
function refreshDash() {
  const aCut = db.cutting.filter(e => e.agentId === currentAgentId); const aFin = db.finishing.filter(e => e.agentId === currentAgentId); const aLed = db.ledger.filter(e => e.agentId === currentAgentId);
  const expQty = aCut.reduce((s,e) => s+e.expectedQty, 0); const finGoods = aFin.reduce((s,e) => s+e.totalAccepted, 0); const shortage = aFin.reduce((s,e) => s+Math.max(0,e.shortage), 0);
  const totalBills = aFin.reduce((s,e) => s+e.grossBill, 0); const totalPaid = aLed.reduce((s,e) => s+e.debit, 0); const outstanding = totalBills - totalPaid;
  document.getElementById('k1').textContent = expQty; document.getElementById('k2').textContent = finGoods; document.getElementById('k3').textContent = shortage;
  document.getElementById('k4').textContent = 'LKR ' + totalBills.toFixed(0); document.getElementById('d1').textContent = 'LKR ' + totalBills.toFixed(2); document.getElementById('d2').textContent = 'LKR ' + totalPaid.toFixed(2);
  const d3el = document.getElementById('d3'); d3el.textContent = 'LKR ' + outstanding.toFixed(2); d3el.style.color = outstanding > 0 ? 'var(--accent3)' : outstanding < 0 ? 'var(--accent2)' : 'var(--text)';

  const sumTb = document.querySelector('#agentSummaryTable tbody'); sumTb.innerHTML = '';
  db.agents.forEach(a => {
    const aC = db.cutting.filter(e => e.agentId === a.id); const aF = db.finishing.filter(e => e.agentId === a.id); const aL = db.ledger.filter(e => e.agentId === a.id);
    const gb = aF.reduce((s,e)=>s+e.grossBill,0); const pd = aL.reduce((s,e)=>s+e.debit,0); const ou = gb - pd;
    sumTb.innerHTML += `<tr><td style="font-weight:600;color:var(--accent)">${a.name}</td><td>${aC.reduce((s,e)=>s+e.expectedQty,0)}</td><td>${aF.reduce((s,e)=>s+e.totalAccepted,0)}</td><td style="color:${aF.reduce((s,e)=>s+Math.max(0,e.shortage),0)>0?'var(--accent4)':'var(--accent2)'}">${aF.reduce((s,e)=>s+Math.max(0,e.shortage),0)}</td><td>LKR ${gb.toFixed(2)}</td><td style="color:var(--accent2)">LKR ${pd.toFixed(2)}</td><td style="font-weight:700;color:${ou>0?'var(--accent3)':'var(--accent2)'}">LKR ${ou.toFixed(2)}</td></tr>`;
  });
  if (document.getElementById('lCurBal')) document.getElementById('lCurBal').textContent = agentBalance(currentAgentId).toFixed(2);
}

// ===== INVOICE/STATEMENT =====
function buildInvoice() {
  const agent = currentAgent(); const aFin = db.finishing.filter(e => e.agentId === currentAgentId); const aLed = db.ledger.filter(e => e.agentId === currentAgentId);
  const totalBills = aFin.reduce((s,e)=>s+e.grossBill,0); const totalPaid = aLed.reduce((s,e)=>s+e.debit,0); const outstanding = totalBills - totalPaid; const now = new Date();
  document.getElementById('invStatementNo').textContent = 'STMT-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
  document.getElementById('invCreatedDate').textContent = 'Created: ' + now.toLocaleDateString('en-LK', { year:'numeric', month:'long', day:'numeric' });
  document.getElementById('invFooterDate').textContent = 'Generated ' + now.toLocaleDateString('en-LK', { year:'numeric', month:'short', day:'numeric' });
  document.getElementById('invAgent').textContent = agent.name + (agent.note ? ' — ' + agent.note : '');
  document.getElementById('invTotalWork').textContent = 'LKR ' + totalBills.toFixed(2); document.getElementById('invTotalPaid').textContent = 'LKR ' + totalPaid.toFixed(2);
  const balEl = document.getElementById('invBalance'); balEl.textContent = 'LKR ' + outstanding.toFixed(2); balEl.style.color = outstanding > 0 ? '#d97706' : outstanding < 0 ? '#059669' : '#2563eb';
  document.getElementById('invTotalPayable').textContent = 'LKR ' + totalBills.toFixed(2); document.getElementById('invTotalPaidSummary').textContent = 'LKR ' + totalPaid.toFixed(2);

  const finRows = document.getElementById('invFinRows'); finRows.innerHTML = '';
  if (aFin.length) aFin.forEach(e => finRows.innerHTML += `<tr><td>${e.subInvoice}</td><td>${fmtDate(e.date)}</td><td>${e.totalAccepted}</td><td>LKR ${e.unitRate.toFixed(2)}</td><td><strong>LKR ${e.grossBill.toFixed(2)}</strong></td></tr>`);
  else finRows.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:16px;font-style:italic">No receipts recorded</td></tr>';

  const ledRows = document.getElementById('invLedRows'); ledRows.innerHTML = ''; const payments = aLed.filter(e => e.debit > 0);
  if (payments.length) payments.forEach(e => ledRows.innerHTML += `<tr><td>${fmtDate(e.date)}</td><td>${e.reference}</td><td>${e.type}</td><td>${e.paymentMethod || '—'}</td><td>${e.transactionRef || '—'}</td><td><strong>LKR ${e.debit.toFixed(2)}</strong></td></tr>`);
  else ledRows.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:16px;font-style:italic">No payments recorded</td></tr>';
}

function buildUniversalReport() {
    document.getElementById('ur-date').textContent = new Date().toLocaleDateString('en-LK');
    document.getElementById('ur-agent').textContent = currentAgent().name;

    const aCut = db.cutting.filter(e=>e.agentId===currentAgentId); const aFin = db.finishing.filter(e=>e.agentId===currentAgentId); const aLed = db.ledger.filter(e=>e.agentId===currentAgentId);
    const tbills = aFin.reduce((s,e) => s+e.grossBill, 0); const tpaid = aLed.reduce((s,e) => s+e.debit, 0);

    document.getElementById('ur-exp').textContent = aCut.reduce((s,e) => s+e.expectedQty, 0);
    document.getElementById('ur-acc').textContent = aFin.reduce((s,e) => s+e.totalAccepted, 0);
    document.getElementById('ur-short').textContent = aFin.reduce((s,e) => s+Math.max(0,e.shortage), 0);
    document.getElementById('ur-gross').textContent = 'LKR ' + tbills.toFixed(2);
    document.getElementById('ur-paid').textContent = 'LKR ' + tpaid.toFixed(2);
    document.getElementById('ur-out').textContent = 'LKR ' + (tbills - tpaid).toFixed(2);

    const cutTb = document.getElementById('ur-cut-tb'); cutTb.innerHTML = '';
    aCut.forEach(e => { cutTb.innerHTML += `<tr><td>${e.invoiceNo}</td><td>${fmtDate(e.date)}</td><td>${e.itemName||'—'}</td><td>${e.layers} / ${e.sizes}</td><td>${e.expectedQty}</td><td>LKR ${e.projectedValue.toFixed(2)}</td></tr>`; });

    const finTb = document.getElementById('ur-fin-tb'); finTb.innerHTML = '';
    aFin.forEach(e => { finTb.innerHTML += `<tr><td>${e.subInvoice}</td><td>${e.cutInvoice}</td><td>${fmtDate(e.date)}</td><td>${e.totalAccepted}</td><td>${e.shortage}</td><td>LKR ${e.grossBill.toFixed(2)}</td></tr>`; });

    const ledTb = document.getElementById('ur-led-tb'); ledTb.innerHTML = '';
    aLed.forEach(e => { ledTb.innerHTML += `<tr><td>${fmtDate(e.date)}</td><td>${e.type}</td><td>${e.reference}</td><td>${e.paymentMethod||'—'}</td><td>${e.debit?'LKR '+e.debit.toFixed(2):'—'}</td><td>${e.credit?'LKR '+e.credit.toFixed(2):'—'}</td></tr>`; });
}

function buildListReport(tab) {
    document.getElementById('lr-date').textContent = new Date().toLocaleDateString('en-LK');
    document.getElementById('lr-agent').textContent = 'Agent: ' + currentAgent().name;
    const thead = document.getElementById('lr-thead'); const tbody = document.getElementById('lr-tbody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    if (tab === 'cutting') {
        document.getElementById('lr-title').textContent = 'Cutting & Dispatch Log';
        thead.innerHTML = '<tr><th>Invoice</th><th>Date</th><th>Item</th><th>Exp. Qty</th><th>Proj. Value</th><th>Status</th></tr>';
        db.cutting.filter(e=>e.agentId===currentAgentId).forEach(e => tbody.innerHTML += `<tr><td>${e.invoiceNo}</td><td>${fmtDate(e.date)}</td><td>${e.itemName || '—'}</td><td>${e.expectedQty}</td><td>LKR ${e.projectedValue.toFixed(2)}</td><td>${e.status}</td></tr>`);
    } else if (tab === 'finishing') {
        document.getElementById('lr-title').textContent = 'Finishing Receipts Log';
        thead.innerHTML = '<tr><th>Sub Invoice</th><th>Cut Invoice</th><th>Date</th><th>Accepted</th><th>Shortage</th><th>Gross Bill</th></tr>';
        db.finishing.filter(e=>e.agentId===currentAgentId).forEach(e => tbody.innerHTML += `<tr><td>${e.subInvoice}</td><td>${e.cutInvoice}</td><td>${fmtDate(e.date)}</td><td>${e.totalAccepted}</td><td>${e.shortage}</td><td>LKR ${e.grossBill.toFixed(2)}</td></tr>`);
    } else if (tab === 'ledger') {
        document.getElementById('lr-title').textContent = 'Account Ledger Log';
        thead.innerHTML = '<tr><th>Date</th><th>Type</th><th>Ref</th><th>Method</th><th>Paid</th><th>Earned</th></tr>';
        db.ledger.filter(e=>e.agentId===currentAgentId).forEach(e => tbody.innerHTML += `<tr><td>${fmtDate(e.date)}</td><td>${e.type}</td><td>${e.reference}</td><td>${e.paymentMethod || '—'}</td><td>${e.debit ? 'LKR '+e.debit.toFixed(2) : '—'}</td><td>${e.credit ? 'LKR '+e.credit.toFixed(2) : '—'}</td></tr>`);
    }
}

// ===== ROBUST PIXEL-PERFECT CAPTURE ENGINE (CHROME / ELECTRON SAFE) =====

async function prepareForCapture(elementId) {
    const el = document.getElementById(elementId);
    const originalDisplay = el.style.display;
    const isHiddenTemplate = (originalDisplay === 'none' || originalDisplay === '');

    // 1. Hijack the loading screen to mask the heavy DOM manipulation glitch
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    const originalLoaderText = loaderText ? loaderText.textContent : 'Loading...';
    
    if (loaderText) loaderText.textContent = "Processing Document...";
    loader.classList.remove('hidden');

    // 2. Wait for the loader to fade in completely (0.4s transition)
    await new Promise(r => setTimeout(r, 450));

    // 3. Reset scroll perfectly
    const originalScroll = window.scrollY;
    window.scrollTo(0, 0);

    if (isHiddenTemplate) {
        // Bring hidden templates forcefully to the front so Chrome paints them, 
        // but safely behind the loader via zIndex stacking.
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.zIndex = '99990'; 
    }
    
    el.style.display = 'block';
    document.body.classList.add('capturing-pdf');
    
    // Critical Pause: Wait for browser layout & fonts to catch up
    await new Promise(r => setTimeout(r, 300));
    
    return { el, originalDisplay, originalScroll, isHiddenTemplate, originalLoaderText };
}

async function cleanupAfterCapture(state) {
    if (state.isHiddenTemplate) {
        state.el.style.position = '';
        state.el.style.top = '';
        state.el.style.left = '';
        state.el.style.zIndex = '';
    }
    state.el.style.display = state.originalDisplay;
    document.body.classList.remove('capturing-pdf');
    window.scrollTo(0, state.originalScroll);

    // Hide loader and restore text safely
    const loader = document.getElementById('loader');
    loader.classList.add('hidden');
    setTimeout(() => {
        const loaderText = document.getElementById('loaderText');
        if (loaderText) loaderText.textContent = state.originalLoaderText;
    }, 400);
}

async function captureMultiPagePDF(elementId, filename) {
    showToast('📄 Generating PDF...', 'success');
    const state = await prepareForCapture(elementId);

    try {
        const canvas = await html2canvas(state.el, { 
            scale: 1.5, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            scrollY: 0,
            windowY: 0
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95); 
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const ratio = pdfW / canvas.width;
        const totalPdfH = canvas.height * ratio;

        let heightLeft = totalPdfH;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfW, totalPdfH);
        heightLeft -= pdfH;

        while (heightLeft > 0) {
            position = heightLeft - totalPdfH; 
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfW, totalPdfH);
            heightLeft -= pdfH;
        }
        
        pdf.save(filename);
        showToast('✅ PDF Downloaded Successfully!');
    } catch(err) {
        console.error('PDF Error:', err);
        showToast('⚠️ Error generating PDF', 'error');
    } finally {
        await cleanupAfterCapture(state);
    }
}

async function printElementAsPNG(elementId) {
    showToast('🖨️ Preparing print...', 'success');
    const state = await prepareForCapture(elementId);
    
    try {
        const canvas = await html2canvas(state.el, { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            scrollY: 0,
            windowY: 0 
        });
        const imgData = canvas.toDataURL('image/png');
        
        let iframe = document.getElementById('print-iframe');
        if(iframe) { iframe.remove(); }
        
        iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        // Fixed: Set width/height to 1px (0 width breaks printing in some browsers) and hide securely
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.opacity = '0';
        iframe.style.border = 'none';
        iframe.style.zIndex = '-1000';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <style>
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 15px; display: flex; justify-content: center; background: #fff; }
                    img { width: 100%; max-width: 190mm; height: auto; display: block; margin: 0 auto; }
                </style>
            </head>
            <body>
                <img src="${imgData}" id="printImg" />
                <script>
                    window.onafterprint = function() {
                        setTimeout(() => { window.parent.document.getElementById('print-iframe').remove(); }, 500);
                    };
                    document.getElementById('printImg').onload = function() {
                        setTimeout(() => { 
                            window.focus(); 
                            window.print(); 
                            // Fallback if onafterprint doesn't fire securely
                            setTimeout(() => { 
                                const frame = window.parent.document.getElementById('print-iframe');
                                if(frame) frame.remove(); 
                            }, 60000);
                        }, 250);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
        
    } catch(err) {
        console.error(err);
        showToast('⚠️ Print failed', 'error');
    } finally {
        await cleanupAfterCapture(state);
    }
}

// Router for Export Action Buttons
function exportTabPDF(tab) {
    if (tab === 'dashboard') { captureMultiPagePDF('page-dashboard', 'Dashboard.pdf'); }
    else if (tab === 'summary') { buildInvoice(); captureMultiPagePDF('invoiceArea', 'Statement.pdf'); }
    else { buildListReport(tab); captureMultiPagePDF('listReportArea', `${tab}_log.pdf`); }
}

function printTab(tab) {
    if (tab === 'dashboard') { printElementAsPNG('page-dashboard'); }
    else if (tab === 'summary') { buildInvoice(); printElementAsPNG('invoiceArea'); }
    else { buildListReport(tab); printElementAsPNG('listReportArea'); }
}

function printInvoice() { buildInvoice(); printElementAsPNG('invoiceArea'); }

function exportPDFUniversal() {
    buildUniversalReport();
    captureMultiPagePDF('universalReportArea', `Fuji_Master_Report_${currentAgent().name.replace(/ /g,'_')}.pdf`);
}

// ===== HELPERS & SHORTCUTS =====
function fmtDate(d) { if (!d) return '—'; try { return new Date(d + 'T00:00:00').toLocaleDateString('en-LK', { year:'numeric', month:'short', day:'2-digit' }); } catch(e) { return d; } }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast ' + type + ' show';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));
document.addEventListener('keydown', (e)=>{ if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); saveOfflineData(); showToast('💾 Data saved locally'); } });

// ===== EXCEL EXPORT =====
function exportTabExcel(tab) {
  const wb = XLSX.utils.book_new(); const agent = currentAgent(); const dateStr = new Date().toISOString().slice(0,10);
  if (tab === 'dashboard') {
    const sumData = [['Fuji San Lanka Pvt Ltd — Executive Dashboard'],['Agent:', agent.name],['Generated:', new Date().toLocaleString()],[],['FINANCIAL SUMMARY'],['Total Expected Output', db.cutting.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.expectedQty,0)],['Finished Goods', db.finishing.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.totalAccepted,0)],['Shortage', db.finishing.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+Math.max(0,e.shortage),0)],['Total Gross Bills', db.finishing.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.grossBill,0)],['Total Payments', db.ledger.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.debit,0)],['Outstanding Balance', db.finishing.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.grossBill,0) - db.ledger.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.debit,0)],[],['ALL AGENTS OVERVIEW'],['Agent','Expected Qty','Finished Goods','Shortage','Gross Bills','Payments','Outstanding']];
    db.agents.forEach(a => { const gb = db.finishing.filter(e=>e.agentId===a.id).reduce((s,e)=>s+e.grossBill,0); const pd = db.ledger.filter(e=>e.agentId===a.id).reduce((s,e)=>s+e.debit,0); sumData.push([a.name, db.cutting.filter(e=>e.agentId===a.id).reduce((s,e)=>s+e.expectedQty,0), db.finishing.filter(e=>e.agentId===a.id).reduce((s,e)=>s+e.totalAccepted,0), db.finishing.filter(e=>e.agentId===a.id).reduce((s,e)=>s+Math.max(0,e.shortage),0), gb, pd, gb-pd]); });
    const ws = XLSX.utils.aoa_to_sheet(sumData); ws['!cols'] = [{wch:28},{wch:20}]; XLSX.utils.book_append_sheet(wb, ws, 'Dashboard'); XLSX.writeFile(wb, `FujiSanLanka_Dashboard_${dateStr}.xlsx`);
  } else if (tab === 'cutting') {
    const cutData = [['Invoice No.','Date','Item Name','Description','Cuts','Layers/Cut','Sizes','Expected Qty','Unit Rate (LKR)','Projected Value (LKR)','Status','Accessories']];
    db.cutting.filter(e=>e.agentId===currentAgentId).forEach(e => { let accStr = e.accessories ? e.accessories.map(a => a.name + ':' + a.qty).join(', ') : ''; cutData.push([e.invoiceNo,e.date,e.itemName||'',e.description||'',e.layers,e.sizes,e.sizesLabel||'',e.expectedQty,e.unitRate,e.projectedValue,e.status,accStr]); });
    const ws = XLSX.utils.aoa_to_sheet(cutData); ws['!cols'] = [{wch:18},{wch:14},{wch:16},{wch:20},{wch:8},{wch:10},{wch:16},{wch:14},{wch:16},{wch:20},{wch:12},{wch:24}]; XLSX.utils.book_append_sheet(wb, ws, 'Cutting'); XLSX.writeFile(wb, `FujiSanLanka_Cutting_${dateStr}.xlsx`);
  } else if (tab === 'finishing') {
    const finData = [['Sub Invoice','Cut Invoice','Date','Grade A','Dmg Complete','Waste','Total Accepted','Shortage','Unit Rate (LKR)','Gross Bill (LKR)']];
    db.finishing.filter(e=>e.agentId===currentAgentId).forEach(e => finData.push([e.subInvoice,e.cutInvoice,e.date,e.gradeA,e.damagedComplete,e.waste,e.totalAccepted,e.shortage,e.unitRate,e.grossBill]));
    const ws = XLSX.utils.aoa_to_sheet(finData); ws['!cols'] = [{wch:16},{wch:16},{wch:14},{wch:10},{wch:16},{wch:10},{wch:16},{wch:10},{wch:16},{wch:18}]; XLSX.utils.book_append_sheet(wb, ws, 'Finishing'); XLSX.writeFile(wb, `FujiSanLanka_Finishing_${dateStr}.xlsx`);
  } else if (tab === 'ledger') {
    const ledData = [['Date','Type','Reference','Payment Method','Cheque/Transfer Ref','Debit (Paid)','Credit (Earned)','Running Balance']]; let bal = 0;
    db.ledger.filter(e=>e.agentId===currentAgentId).forEach(e => { bal += e.credit - e.debit; ledData.push([e.date,e.type,e.reference,e.paymentMethod||'',e.transactionRef||'',e.debit||'',e.credit||'',bal]); });
    const ws = XLSX.utils.aoa_to_sheet(ledData); ws['!cols'] = [{wch:14},{wch:20},{wch:18},{wch:18},{wch:20},{wch:16},{wch:16},{wch:18}]; XLSX.utils.book_append_sheet(wb, ws, 'Ledger'); XLSX.writeFile(wb, `FujiSanLanka_Ledger_${dateStr}.xlsx`);
  } else if (tab === 'summary') {
    buildInvoice(); const aFin = db.finishing.filter(e=>e.agentId===currentAgentId); const aLed = db.ledger.filter(e=>e.agentId===currentAgentId);
    const totalBills = aFin.reduce((s,e)=>s+e.grossBill,0); const totalPaid = aLed.reduce((s,e)=>s+e.debit,0);
    const stmtData = [['Fuji San Lanka Pvt Ltd — Statement of Account'],['Agent:', agent.name],['Generated:', new Date().toLocaleString()],[],['Total Work Rendered', totalBills],['Total Payments Received', totalPaid],['Net Outstanding Balance', totalBills - totalPaid],[],['FINISHING RECEIPTS'],['Sub Invoice','Date','Total Accepted','Unit Rate','Gross Bill']];
    aFin.forEach(e => stmtData.push([e.subInvoice, e.date, e.totalAccepted, e.unitRate, e.grossBill])); stmtData.push([]); stmtData.push(['PAYMENT HISTORY']); stmtData.push(['Date','Reference','Type','Payment Method','Ref No.','Amount']);
    aLed.filter(e=>e.debit>0).forEach(e => stmtData.push([e.date, e.reference, e.type, e.paymentMethod||'', e.transactionRef||'', e.debit]));
    const ws = XLSX.utils.aoa_to_sheet(stmtData); ws['!cols'] = [{wch:28},{wch:20}]; XLSX.utils.book_append_sheet(wb, ws, 'Statement'); XLSX.writeFile(wb, `FujiSanLanka_Statement_${dateStr}.xlsx`);
  }
  showToast('📊 Excel exported successfully!');
}

function exportExcelAll() {
  const wb = XLSX.utils.book_new(); const agent = currentAgent(); const dateStr = new Date().toISOString().slice(0,10);
  const sumData = [['Fuji San Lanka Pvt Ltd — Full Report'],['Agent:', agent.name], ['Generated:', new Date().toLocaleString()], [],['FINANCIAL SUMMARY'],['Total Expected Output', db.cutting.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.expectedQty,0)],['Finished Goods', db.finishing.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.totalAccepted,0)],['Shortage', db.finishing.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+Math.max(0,e.shortage),0)],['Total Gross Bills', db.finishing.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.grossBill,0)],['Total Payments', db.ledger.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.debit,0)],['Outstanding Balance', db.finishing.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.grossBill,0)-db.ledger.filter(e=>e.agentId===currentAgentId).reduce((s,e)=>s+e.debit,0)]];
  const ws0=XLSX.utils.aoa_to_sheet(sumData); ws0['!cols']=[{wch:30},{wch:20}]; XLSX.utils.book_append_sheet(wb,ws0,'Summary');
  const cutData=[['Invoice No.','Date','Item Name','Description','Cuts','Layers/Cut','Sizes','Expected Qty','Unit Rate (LKR)','Projected Value (LKR)','Status','Accessories']]; db.cutting.filter(e=>e.agentId===currentAgentId).forEach(e=>{ let accStr = e.accessories ? e.accessories.map(a => a.name + ':' + a.qty).join(', ') : ''; cutData.push([e.invoiceNo,e.date,e.itemName||'',e.description||'',e.layers,e.sizes,e.sizesLabel||'',e.expectedQty,e.unitRate,e.projectedValue,e.status,accStr]) }); const ws1=XLSX.utils.aoa_to_sheet(cutData); ws1['!cols']=[{wch:18},{wch:14},{wch:16},{wch:20},{wch:8},{wch:10},{wch:16},{wch:14},{wch:16},{wch:20},{wch:12},{wch:24}]; XLSX.utils.book_append_sheet(wb,ws1,'Cutting');
  const finData=[['Sub Invoice','Cut Invoice','Date','Grade A','Dmg Complete','Waste','Total Accepted','Shortage','Unit Rate (LKR)','Gross Bill (LKR)']]; db.finishing.filter(e=>e.agentId===currentAgentId).forEach(e=>finData.push([e.subInvoice,e.cutInvoice,e.date,e.gradeA,e.damagedComplete,e.waste,e.totalAccepted,e.shortage,e.unitRate,e.grossBill])); const ws2=XLSX.utils.aoa_to_sheet(finData); ws2['!cols']=[{wch:16},{wch:16},{wch:14},{wch:10},{wch:16},{wch:10},{wch:16},{wch:10},{wch:16},{wch:18}]; XLSX.utils.book_append_sheet(wb,ws2,'Finishing');
  const ledData=[['Date','Type','Reference','Payment Method','Cheque/Transfer Ref','Debit (Paid)','Credit (Earned)','Running Balance']]; let bal=0; db.ledger.filter(e=>e.agentId===currentAgentId).forEach(e=>{bal+=e.credit-e.debit;ledData.push([e.date,e.type,e.reference,e.paymentMethod||'',e.transactionRef||'',e.debit||'',e.credit||'',bal]);}); const ws3=XLSX.utils.aoa_to_sheet(ledData); ws3['!cols']=[{wch:14},{wch:20},{wch:18},{wch:18},{wch:20},{wch:16},{wch:16},{wch:18}]; XLSX.utils.book_append_sheet(wb,ws3,'Ledger');
  XLSX.writeFile(wb, `FujiSanLanka_FULL_${agent.name.replace(/ /g,'_')}_${dateStr}.xlsx`); showToast('📊 Full Excel exported successfully!');
}

window.addEventListener('beforeunload', saveOfflineData);