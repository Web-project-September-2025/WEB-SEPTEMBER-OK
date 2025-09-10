// invite-committee.js
const API_BASE = 'http://localhost:3000';

function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function ensureProfessor(){
  const u = JSON.parse(localStorage.getItem('user') || 'null');
  if (!u || u.Role !== 'PROFESSOR') {
    alert('Μόνο για Διδάσκοντες.');
    window.location.href = 'login.html';
  }
}
ensureProfessor();

// DOM
const thesisSelect = document.getElementById('thesisSelect');
const thesisInfo   = document.getElementById('thesisInfo');
const qProf        = document.getElementById('qProf');
const searchBtn    = document.getElementById('searchBtn');
const profResults  = document.getElementById('profResults');
const invitesWrap  = document.getElementById('invitesWrap');

let theses = [];
let currentThesisId = null;

async function fetchProvisional() {
  const res = await fetch(`${API_BASE}/professor/provisional-theses`, { headers: { ...authHeader() } });
  if (!res.ok) return [];
  return res.json();
}

async function fetchInvites(thesisId) {
  const res = await fetch(`${API_BASE}/thesis/${thesisId}/requests`, { headers: { ...authHeader() } });
  if (!res.ok) return [];
  return res.json();
}

function renderThesisSelect() {
  thesisSelect.innerHTML = '';
  if (!theses.length) {
    thesisSelect.innerHTML = `<option value="">— Δεν υπάρχουν PROVISIONAL διπλωματικές —</option>`;
    thesisInfo.textContent = '';
    currentThesisId = null;
    profResults.innerHTML = '';
    invitesWrap.innerHTML  = '';
    return;
  }
  theses.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.ThesisID;
    const st = t.StudentName ? ` — ${t.StudentName} (AM: ${t.StudentAM || '—'})` : '';
    opt.textContent = `#${t.ThesisID} · ${t.Title}${st}`;
    thesisSelect.appendChild(opt);
  });
  currentThesisId = theses[0].ThesisID;
  thesisSelect.value = String(currentThesisId);
  thesisInfo.textContent = infoLine(theses[0]);
  // load invites for first
  loadInvites();
}

function infoLine(t) {
  const s = t.StudentName ? `${t.StudentName}${t.StudentAM ? ' — AM: '+t.StudentAM : ''}` : '—';
  return `Φοιτητής: ${s}`;
}

thesisSelect.addEventListener('change', () => {
  currentThesisId = Number(thesisSelect.value || 0) || null;
  const t = theses.find(x => x.ThesisID === currentThesisId);
  thesisInfo.textContent = t ? infoLine(t) : '';
  profResults.innerHTML = '';
  loadInvites();
});

async function loadPage() {
  theses = await fetchProvisional();
  renderThesisSelect();
}
loadPage();

// ---------- helpers ----------
function fmt(dt){
  if (!dt) return '—';
  // αναμένεται "YYYY-MM-DD HH:MM:SS" λόγω dateStrings:true
  const s = String(dt).replace('T', ' ');
  return s.slice(0, 16); // YYYY-MM-DD HH:MM
}
// -----------------------------

async function loadInvites() {
  invitesWrap.innerHTML = 'Φόρτωση...';
  if (!currentThesisId) { invitesWrap.innerHTML = ''; return; }

  const invites = await fetchInvites(currentThesisId);

  // enable/disable αναζήτηση/πρόσκληση ανάλογα με τα accepted
  const accepted = invites.filter(r => r.ReqStatus === 'ACCEPTED').length;
  setInviteEnabled(accepted < 2);

  if (!invites.length) {
    invitesWrap.innerHTML = '<div class="muted">Δεν υπάρχουν προσκλήσεις για αυτή τη ΔΕ.</div>';
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'list';

  invites.forEach(r => {
    const li = document.createElement('li');
    li.className = 'item';

    const sentAt = fmt(r.CreatedAt);
    const accAt  = r.AcceptedAt ? fmt(r.AcceptedAt) : null;
    const rejAt  = r.RejectedAt ? fmt(r.RejectedAt) : null;

    const statusPill = `<span class="pill">${r.ReqStatus}</span>`;

    const datesLine = `
      <div class="muted">
        Αποστολή: ${sentAt}
        ${accAt ? ` · Αποδοχή: ${accAt}` : ""}
        ${rejAt ? ` · Απόρριψη: ${rejAt}` : ""}
      </div>
    `;

    li.innerHTML = `
      <div>
        <div><strong>${r.ProfessorName || 'Καθηγητής'}</strong> — <span class="muted">${r.Email || ''}</span></div>
        ${datesLine}
        <div class="muted">ReqID: ${r.ReqID}</div>
      </div>
      <div>
        ${statusPill}
        ${r.ReqStatus === 'REJECTED'
          ? `<button class="btn-small" data-reinvite="${r.ProfessorID}">Επαναποστολή</button>`
          : ''}
      </div>
    `;
    ul.appendChild(li);
  });

  invitesWrap.innerHTML = '';
  invitesWrap.appendChild(ul);

  // επαναποστολή (γυρίζει σε QUEUED, CreatedAt=NOW(), μηδενίζει AcceptedAt/RejectedAt)
  ul.onclick = async (e) => {
    const btn = e.target.closest('button[data-reinvite]');
    if (!btn) return;
    const profId = Number(btn.getAttribute('data-reinvite'));
    try {
      const res = await fetch(`${API_BASE}/thesis/${currentThesisId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...authHeader() },
        body: JSON.stringify({ professorId: profId })
      });
      const d = await res.json().catch(()=>({}));
      if (!res.ok) { alert(d.message || 'Αποτυχία.'); return; }
      await loadInvites();
      alert(d.message || 'OK');
      if (qProf.value.trim()) await runSearch(); // ανανέωσε τα διαθέσιμα
    } catch {
      alert('Σφάλμα επικοινωνίας.');
    }
  };
}

function setInviteEnabled(enabled){
  qProf.disabled = !enabled;
  searchBtn.disabled = !enabled;
  if (!enabled) {
    profResults.innerHTML = '<div class="muted">Η τριμελής είναι πλήρης (2/2). Δεν μπορείτε να στείλετε άλλες προσκλήσεις.</div>';
  }
}

async function runSearch() {
  profResults.innerHTML = 'Αναζήτηση...';
  const q = qProf.value.trim();
  if (!currentThesisId) { profResults.innerHTML = '<div class="muted">Διάλεξε ΔΕ πρώτα.</div>'; return; }

  const url = new URL(`${API_BASE}/professors`);
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('excludeMe', '1');
  url.searchParams.set('excludeThesisId', String(currentThesisId));

  try {
    const res = await fetch(url, { headers: { ...authHeader() } });
    if (!res.ok) { profResults.innerHTML = '<div class="muted">Σφάλμα αναζήτησης.</div>'; return; }
    const rows = await res.json();
    if (!rows.length) { profResults.innerHTML = '<div class="muted">Δεν βρέθηκαν καθηγητές.</div>'; return; }

    const ul = document.createElement('ul');
    ul.className = 'list';
    rows.forEach(p => {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `
        <div>
          <div><strong>${p.UserName}</strong></div>
          <div class="muted">${p.Email || ''}</div>
        </div>
        <div>
          <button class="btn-small" data-invite="${p.UserID}">Πρόσκληση</button>
        </div>
      `;
      ul.appendChild(li);
    });
    profResults.innerHTML = '';
    profResults.appendChild(ul);

    ul.onclick = async (e) => {
      const btn = e.target.closest('button[data-invite]');
      if (!btn) return;
      const pid = Number(btn.getAttribute('data-invite'));

      try {
        const res = await fetch(`${API_BASE}/thesis/${currentThesisId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', ...authHeader() },
          body: JSON.stringify({ professorId: pid })
        });
        const d = await res.json().catch(()=>({}));
        if (!res.ok) { alert(d.message || 'Αποτυχία.'); return; }
        await loadInvites();
        await runSearch(); // κρύψε αυτόν από τα διαθέσιμα
        alert(d.message || 'OK');
      } catch {
        alert('Σφάλμα επικοινωνίας.');
      }
    };

  } catch (err) {
    profResults.innerHTML = '<div class="muted">Σφάλμα επικοινωνίας.</div>';
  }
}

searchBtn.addEventListener('click', runSearch);
qProf.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });