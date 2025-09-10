// professor-theses.js
// ------------------------------------------------------------
const API_BASE = 'http://localhost:3000';

// --- auth helpers ---
function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function ensureProfessor() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user || user.Role !== 'PROFESSOR') {
    alert('Μόνο για Διδάσκοντες.');
    window.location.href = 'login.html';
  }
}
ensureProfessor();

const me = JSON.parse(localStorage.getItem('user') || 'null');

// --- top filters / table ---
const roleSel     = document.getElementById('role');
const statusesSel = document.getElementById('statuses');
const qInput      = document.getElementById('q');
const tbody       = document.getElementById('tbody');
const table       = document.getElementById('table');
const countWrap   = document.getElementById('countWrap');

// --- detail pane ---
const detailBox   = document.getElementById('detail');
const d_title     = document.getElementById('d_title');
const d_prof      = document.getElementById('d_prof');
const d_student   = document.getElementById('d_student');
const d_committee = document.getElementById('d_committee');
const d_timeline  = document.getElementById('d_timeline');
const d_grade     = document.getElementById('d_grade');
const d_links     = document.getElementById('d_links');

// --- supervisor actions (match HTML ids) ---
const actionsBox      = document.getElementById('supervisorActions');
const activeSinceInfo = document.getElementById('activeSinceInfo');
const btnToUnderExam  = document.getElementById('btnToUnderExam');
const btnCancelActive = document.getElementById('btnCancelActive');
const gsNumberInput   = document.getElementById('gsNumber');
const gsYearInput     = document.getElementById('gsYear'); // πληροφοριακά μόνο

// --- notes block (match HTML ids) ---
const notesBox  = document.getElementById('notesBox');
const noteForm  = document.getElementById('noteForm');
const noteBody  = document.getElementById('noteBody');
const noteCount = document.getElementById('noteCount');
const notesList = document.getElementById('notesList');

// --- events on filters / exports ---
document.getElementById('searchBtn').addEventListener('click', loadList);
document.getElementById('exportCsvBtn').addEventListener('click', () => exportList('csv'));
document.getElementById('exportJsonBtn').addEventListener('click', () => exportList('json'));

window.addEventListener('DOMContentLoaded', loadList);

// ------------------------------------------------------------

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
  } catch (e) {
    console.error(e);
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
    tr.addEventListener('click', () => loadDetails(r.ThesisID));
    frag.appendChild(tr);
  });
  tbody.innerHTML = '';
  tbody.appendChild(frag);
}

async function loadDetails(id) {
  try {
    const res = await fetch(`${API_BASE}/thesis/${id}/full`, {
      headers: { ...authHeader() }
    });
    const text = await res.text(); // για καλύτερο debug
    if (!res.ok) {
      console.error('Load details failed:', text);
      alert('Σφάλμα φόρτωσης λεπτομερειών');
      return;
    }
    const data = JSON.parse(text);
    fillDetails(data);
  } catch (e) {
    console.error(e);
    alert('Σφάλμα επικοινωνίας');
  }
}

function fillDetails({ thesis, committee, timeline, finalGrade, latestSubmission }) {
  // βασικά
  detailBox.style.display = 'block';
  d_title.textContent = thesis.Title;
  d_prof.textContent = `Επιβλέπων: ${thesis.ProfessorName || '—'}`;
  d_student.textContent = `Φοιτητής: ${thesis.StudentName || '—'} ${thesis.StudentAM ? `(AM: ${thesis.StudentAM})` : ''}`;

  // τριμελής
  d_committee.innerHTML = '';
  (committee || []).forEach(m => {
    const li = document.createElement('li');
    li.textContent = `${m.UserName} (${m.Email})`;
    d_committee.appendChild(li);
  });
  if (!committee || !committee.length) d_committee.innerHTML = '<li>—</li>';

  // timeline
  d_timeline.innerHTML = '';
  (timeline || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = `${t.label}${t.date ? ` — ${t.date}` : ''}`;
    d_timeline.appendChild(li);
  });

  // βαθμός
  d_grade.textContent = finalGrade != null ? Number(finalGrade).toFixed(2) : '—';

  // links
  d_links.innerHTML = '';
  if (thesis.RepositoryLink && thesis.RepositoryLink.trim().toLowerCase() !== 'unknown') {
    const a = document.createElement('a');
    a.href = thesis.RepositoryLink;
    a.target = '_blank';
    a.className = 'btn-small';
    a.textContent = 'Αποθετήριο';
    d_links.appendChild(a);
  }
  if (latestSubmission?.FileURL) {
    const a = document.createElement('a');
    a.href = latestSubmission.FileURL;
    a.target = '_blank';
    a.className = 'btn-small';
    a.textContent = 'Τελευταίο Υποβληθέν Αρχείο';
    d_links.appendChild(a);
  }
  if (!d_links.children.length) {
    const span = document.createElement('span');
    span.textContent = '—';
    d_links.appendChild(span);
  }

  // === Ενέργειες & Σημειώσεις μόνο σε ACTIVE ===
  const isSupervisor = Number(me?.UserID) === Number(thesis.ProfessorID);

  if (thesis.Status === 'ACTIVE') {
    // ---- Ενέργειες επιβλέποντα ----
    if (isSupervisor) {
      actionsBox.style.display = 'block';

      // Υπολογισμός ημερών από ActiveSince (fallback StartDate)
      const baseStr = thesis.ActiveSince || thesis.StartDate || null;
      let canCancel = false;
      if (baseStr) {
        const base = new Date(baseStr);
        const today = new Date();
        const diffDays = Math.floor((today - base) / (1000*60*60*24));
        const dd = isNaN(diffDays) ? null : diffDays;
        if (dd != null) {
          canCancel = dd >= 730;
          activeSinceInfo.textContent = `Οριστικοποίηση: ${baseStr} — Έχουν περάσει περίπου ${dd} ημέρες. ${canCancel ? 'Επιτρέπεται ακύρωση.' : 'Δεν έχουν συμπληρωθεί 2 έτη.'}`;
        } else {
          activeSinceInfo.textContent = 'Ημερομηνία οριστικοποίησης άγνωστη.';
        }
      } else {
        activeSinceInfo.textContent = 'Ημερομηνία οριστικοποίησης άγνωστη.';
      }

      // Ενεργοποίηση/απενεργοποίηση κουμπιού ακύρωσης
      const updateCancelBtnState = () => {
        const hasGS = (gsNumberInput.value || '').trim().length > 0;
        btnCancelActive.disabled = !(canCancel && hasGS);
      };
      updateCancelBtnState();
      gsNumberInput.addEventListener('input', updateCancelBtnState);

      // Μετάβαση σε UNDER-EXAMINATION
      btnToUnderExam.onclick = async () => {
        if (!confirm('Να μεταβεί σε UNDER-EXAMINATION;')) return;
        try {
          const res = await fetch(`${API_BASE}/thesis/${thesis.ThesisID}/mark-under-examination`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() }
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) return alert(j.message || 'Αποτυχία.');
          alert(j.message || 'OK');
          await loadDetails(thesis.ThesisID);
          await loadList();
        } catch (e) {
          console.error(e);
          alert('Σφάλμα επικοινωνίας');
        }
      };

      // Ακύρωση ΔΕ
      btnCancelActive.onclick = async () => {
        const gs = (gsNumberInput.value || '').trim();
        if (!gs) return alert('Συμπλήρωσε Αριθμό Πρωτ. ΓΣ.');
        if (!confirm('Να ακυρωθεί η ΔΕ; (απαιτούνται 2 έτη από οριστικοποίηση)')) return;
        try {
          const res = await fetch(`${API_BASE}/thesis/${thesis.ThesisID}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ gsNumber: gs })
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) return alert(j.message || 'Αποτυχία.');
          alert(j.message || 'OK');
          await loadDetails(thesis.ThesisID);
          await loadList();
        } catch (e) {
          console.error(e);
          alert('Σφάλμα επικοινωνίας');
        }
      };

    } else {
      actionsBox.style.display = 'none';
    }

    // ---- Σημειώσεις (ορατές μόνο στον δημιουργό τους) ----
    notesBox.style.display = 'block';

    // live counter
    noteBody.oninput = () => {
      noteCount.textContent = `${noteBody.value.length} / 300`;
    };

    const reloadNotes = async () => {
      notesList.innerHTML = '<div class="muted">Φόρτωση σημειώσεων…</div>';
      try {
        const res = await fetch(`${API_BASE}/thesis/${thesis.ThesisID}/notes`, {
          headers: { ...authHeader() }
        });
        if (!res.ok) {
          notesList.innerHTML = '<div class="muted">Σφάλμα.</div>';
          return;
        }
        const notes = await res.json();
        if (!Array.isArray(notes) || !notes.length) {
          notesList.innerHTML = '<div class="muted">Δεν υπάρχουν σημειώσεις.</div>';
          return;
        }
        const frag = document.createDocumentFragment();
        notes.forEach(n => {
          const li = document.createElement('li');
          li.innerHTML = `<span>${escapeHtml(n.Body)}</span><span class="muted" style="font-size:12px;">${n.CreatedAt}</span>`;
          frag.appendChild(li);
        });
        notesList.innerHTML = '';
        notesList.appendChild(frag);
      } catch (e) {
        console.error(e);
        notesList.innerHTML = '<div class="muted">Σφάλμα επικοινωνίας.</div>';
      }
    };
    reloadNotes();

    // submit νέας σημείωσης
    noteForm.onsubmit = async (ev) => {
      ev.preventDefault();
      const txt = (noteBody.value || '').trim();
      if (!txt) return;
      try {
        const res = await fetch(`${API_BASE}/thesis/${thesis.ThesisID}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ text: txt })
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return alert(j.message || 'Αποτυχία.');
        noteBody.value = '';
        noteCount.textContent = '0 / 300';
        reloadNotes();
      } catch (e) {
        console.error(e);
        alert('Σφάλμα επικοινωνίας');
      }
    };

  } else {
    actionsBox.style.display = 'none';
    notesBox.style.display = 'none';
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

  const url = `${API_BASE}/professor/theses/export?${params.toString()}`;
  window.open(url, '_blank');
}

// ------------------------------------------------------------
// helpers
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[ch]));
}
