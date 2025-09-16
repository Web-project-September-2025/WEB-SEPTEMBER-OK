// committee-invitations.js
const API_BASE = 'http://localhost:3000';

function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}
function ensureProfessor() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user || user.Role !== 'PROFESSOR') {
    alert('Μόνο για Διδάσκοντες.');
    window.location.href = 'login.html';
  }
}
ensureProfessor();

const tbody = document.getElementById('tbody');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('empty');

async function fetchInvitations() {
  const res = await fetch(`${API_BASE}/professor/invitations`, { headers: { ...authHeader() } });
  if (!res.ok) {
    tbody.innerHTML = '';
    countEl.textContent = '';
    emptyEl.style.display = 'block';
    return;
  }
  const data = await res.json();
  renderInvites(data);
}

function renderInvites(rows) {
  tbody.innerHTML = '';
  if (!rows || rows.length === 0) {
    emptyEl.style.display = 'block';
    countEl.textContent = '';
    return;
  }
  emptyEl.style.display = 'none';
  countEl.textContent = `${rows.length} ενεργή(ές) πρόσκληση(εις)`;

  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');

    const tdIdx = document.createElement('td'); tdIdx.textContent = String(idx + 1);
    const tdTitle = document.createElement('td'); tdTitle.textContent = r.Title || '—';
    const tdStu = document.createElement('td'); tdStu.textContent = r.StudentName ? `${r.StudentName} (${r.StudentAM || '—'})` : '—';
    const tdSup = document.createElement('td'); tdSup.textContent = r.SupervisorName || '—';
    const tdStatus = document.createElement('td'); tdStatus.innerHTML = `<span class="pill">${r.ThesisStatus}</span>`;
    const tdAct = document.createElement('td'); tdAct.className = 'actions';
    tdAct.innerHTML = `
      <button class="btn-small" data-accept="${r.ReqID}">Αποδοχή</button>
      <button class="btn-small danger" data-reject="${r.ReqID}">Απόρριψη</button>
    `;

    tr.append(tdIdx, tdTitle, tdStu, tdSup, tdStatus, tdAct);
    tbody.appendChild(tr);
  });
}

// Delegated handlers
tbody.addEventListener('click', async (e) => {
  const btnA = e.target.closest('button[data-accept]');
  const btnR = e.target.closest('button[data-reject]');
  if (!btnA && !btnR) return;

  const reqId = Number((btnA || btnR).dataset.accept || (btnR || btnA).dataset.reject);
  const action = btnA ? 'accept' : 'reject';
  const verb = action === 'accept' ? 'Αποδεχθεί' : 'Απορρίψει';
  if (!confirm(`Σίγουρα θέλετε να ${verb.toLowerCase()}τε αυτή την πρόσκληση;`)) return;

  try {
    const res = await fetch(`${API_BASE}/requests/${reqId}/${action}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() }
    });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) {
      alert(j.message || 'Σφάλμα.');
      return;
    }
    alert(j.message || 'OK');
    fetchInvitations();
  } catch {
    alert('Σφάλμα επικοινωνίας.');
  }
});

fetchInvitations();
