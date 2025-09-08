// prof-theses.js
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

const roleSel = document.getElementById('role');
const statusesSel = document.getElementById('statuses');
const qInput = document.getElementById('q');
const tbody = document.getElementById('tbody');
const table = document.getElementById('table');
const countWrap = document.getElementById('countWrap');

const detailBox = document.getElementById('detail');
const d_title = document.getElementById('d_title');
const d_prof = document.getElementById('d_prof');
const d_student = document.getElementById('d_student');
const d_committee = document.getElementById('d_committee');
const d_timeline = document.getElementById('d_timeline');
const d_grade = document.getElementById('d_grade');
const d_links = document.getElementById('d_links');

document.getElementById('searchBtn').addEventListener('click', loadList);
document.getElementById('exportCsvBtn').addEventListener('click', () => exportList('csv'));
document.getElementById('exportJsonBtn').addEventListener('click', () => exportList('json'));

window.addEventListener('DOMContentLoaded', loadList);

function getSelectedStatuses() {
  return Array.from(statusesSel.selectedOptions).map(o => o.value);
}

async function loadList() {
  const params = new URLSearchParams();
  params.set('role', roleSel.value);
  const sts = getSelectedStatuses();
  if (sts.length) params.set('statuses', sts.join(','));
  const q = qInput.value.trim();
  if (q) params.set('q', q);

  tbody.innerHTML = `<tr><td colspan="6">Φόρτωση...</td></tr>`;
  detailBox.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/professor/theses?${params.toString()}`, {
      headers: { ...authHeader() }
    });
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6">Σφάλμα φόρτωσης.</td></tr>`;
      return;
    }
    const rows = await res.json();
    countWrap.textContent = `${rows.length} αποτελέσματα`;
    renderTable(rows);
  } catch {
    tbody.innerHTML = `<tr><td colspan="6">Σφάλμα επικοινωνίας.</td></tr>`;
  }
}

function renderTable(rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">Δεν βρέθηκαν αποτελέσματα.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.ThesisID}</td>
      <td>${escapeHtml(r.Title)}</td>
      <td>${escapeHtml(r.StudentName || '—')}</td>
      <td><span class="pill">${r.Status}</span></td>
      <td>${r.StartDate || '—'}</td>
      <td>${r.EndDate || '—'}</td>
    `;
    tr.addEventListener('click', () => loadDetails(r.ThesisID, r));
    frag.appendChild(tr);
  });
  tbody.innerHTML = '';
  tbody.appendChild(frag);
}

async function loadDetails(id, row) {
  try {
    const res = await fetch(`${API_BASE}/thesis/${id}/full`, {
      headers: { ...authHeader() }
    });
    if (!res.ok) { alert('Σφάλμα φόρτωσης λεπτομερειών'); return; }
    const data = await res.json();
    fillDetails(data);
  } catch {
    alert('Σφάλμα επικοινωνίας');
  }
}

function fillDetails({ thesis, committee, timeline, finalGrade, latestSubmission }) {
  detailBox.style.display = 'block';
  d_title.textContent = thesis.Title;
  d_prof.textContent = `Επιβλέπων: ${thesis.ProfessorName || '—'}`;
  d_student.textContent = `Φοιτητής: ${thesis.StudentName || '—'} ${thesis.StudentAM ? `(AM: ${thesis.StudentAM})` : ''}`;

  d_committee.innerHTML = '';
  (committee || []).forEach(m => {
    const li = document.createElement('li');
    li.textContent = `${m.UserName} (${m.Email})`;
    d_committee.appendChild(li);
  });
  if (!committee || !committee.length) {
    d_committee.innerHTML = '<li>—</li>';
  }

  d_timeline.innerHTML = '';
  (timeline || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = `${t.label}${t.date ? ` — ${t.date}` : ''}`;
    d_timeline.appendChild(li);
  });

  d_grade.textContent = finalGrade != null ? Number(finalGrade).toFixed(2) : '—';

  d_links.innerHTML = '';
  if (thesis.RepositoryLink && thesis.RepositoryLink.trim().toLowerCase() !== 'unknown') {
    const a = document.createElement('a');
    a.href = thesis.RepositoryLink; a.target = '_blank';
    a.className = 'btn-small'; a.textContent = 'Αποθετήριο';
    d_links.appendChild(a);
  }
  if (latestSubmission?.FileURL) {
    const a = document.createElement('a');
    a.href = latestSubmission.FileURL; a.target = '_blank';
    a.className = 'btn-small'; a.textContent = 'Τελευταίο Υποβληθέν Αρχείο';
    d_links.appendChild(a);
  }
  if (!d_links.children.length) {
    const span = document.createElement('span');
    span.textContent = '—';
    d_links.appendChild(span);
  }
}

function exportList(format) {
  const params = new URLSearchParams();
  params.set('role', roleSel.value);
  const sts = getSelectedStatuses();
  if (sts.length) params.set('statuses', sts.join(','));
  const q = qInput.value.trim();
  if (q) params.set('q', q);
  params.set('format', format);

  // απλό navigation για λήψη αρχείου/JSON
  const url = `${API_BASE}/professor/theses/export?${params.toString()}`;
  // Χρησιμοποιούμε window.open για να κρατήσουμε τη σελίδα
  window.open(url, '_blank');
}

// helpers
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}
