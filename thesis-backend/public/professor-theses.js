// professor-theses.js
const API_BASE = 'http://localhost:3000';

// auth helpers 
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

// normalize helper for file/link URLs 
function normalizeFileURL(s){
  if(!s) return null;
  if(/^https?:\/\//i.test(s)) return s;
  if(s.startsWith('/uploads/')) return API_BASE + s;
  if(s.startsWith('/')) return API_BASE + s;
  return API_BASE + '/uploads/pdfs/' + s; // fallback for plain filenames
}

//filters 
const roleSel     = document.getElementById('role');
const statusesSel = document.getElementById('statuses');
const qInput      = document.getElementById('q');
const tbody       = document.getElementById('tbody');
const countWrap   = document.getElementById('countWrap');

//detail pane
const detailBox   = document.getElementById('detail');
const d_title     = document.getElementById('d_title');
const d_prof      = document.getElementById('d_prof');
const d_student   = document.getElementById('d_student');
const d_committee = document.getElementById('d_committee');
const d_timeline  = document.getElementById('d_timeline');
const d_grade     = document.getElementById('d_grade');
const d_links     = document.getElementById('d_links');

// supervisor actions 
const actionsBox      = document.getElementById('supervisorActions');
const activeSinceInfo = document.getElementById('activeSinceInfo');
const btnToUnderExam  = document.getElementById('btnToUnderExam');
const btnCancelActive = document.getElementById('btnCancelActive');
const gsNumberInput   = document.getElementById('gsNumber');

// notes 
const notesBox  = document.getElementById('notesBox');
const noteForm  = document.getElementById('noteForm');
const noteBody  = document.getElementById('noteBody');
const noteCount = document.getElementById('noteCount');
const notesList = document.getElementById('notesList');

// UNDER-EXAMINATION blocks 
const submissionsBox   = document.getElementById('submissionsBox');
const subsList         = document.getElementById('subsList');

const announcementBox  = document.getElementById('announcementBox');
const btnAnnPreview    = document.getElementById('btnAnnPreview');
const btnAnnSave       = document.getElementById('btnAnnSave');
const annPreviewText   = document.getElementById('annPreviewText');

const gradingBox       = document.getElementById('gradingBox');
const gradingInfo      = document.getElementById('gradingInfo');
const gradingToggleRow = document.getElementById('gradingToggleRow');
const chkOpenGrading   = document.getElementById('chkOpenGrading');
const gradeForm        = document.getElementById('gradeForm');
const scWork           = document.getElementById('scWork');
const scDur            = document.getElementById('scDur');
const scText           = document.getElementById('scText');
const scPres           = document.getElementById('scPres');
const scTotal          = document.getElementById('scTotal');
const gradesBody       = document.getElementById('gradesBody');

// events
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
    const res = await fetch(`${API_BASE}/professor/theses?${params.toString()}`, { headers: { ...authHeader() }});
    if (!res.ok) { tbody.innerHTML = `<tr><td colspan="6">Σφάλμα φόρτωσης.</td></tr>`; return; }
    const rows = await res.json();
    countWrap.textContent = `${rows.length} αποτελέσματα`;
    renderTable(rows);
  } catch {
    tbody.innerHTML = `<tr><td colspan="6">Σφάλμα επικοινωνίας.</td></tr>`;
  }
}

function renderTable(rows) {
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6">Δεν βρέθηκαν αποτελέσματα.</td></tr>`; return; }
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
    const res = await fetch(`${API_BASE}/thesis/${id}/full`, { headers: { ...authHeader() }});
    const text = await res.text();
    if (!res.ok) { console.error('Load details failed:', text); alert('Σφάλμα φόρτωσης λεπτομερειών'); return; }
    fillDetails(JSON.parse(text));
  } catch {
    alert('Σφάλμα επικοινωνίας');
  }
}

// live total for grading form 
function recomputeTotal() {
  const w = Number(scWork?.value || 0);
  const d = Number(scDur?.value || 0);
  const t = Number(scText?.value || 0);
  const p = Number(scPres?.value || 0);
  const total = w*0.60 + d*0.15 + t*0.15 + p*0.10;
  if (scTotal) scTotal.textContent = total.toFixed(2);
}
[scWork, scDur, scText, scPres].forEach(i => i && i.addEventListener('input', recomputeTotal));

function fillDetails({ thesis, committee, timeline, finalGrade, latestSubmission, exam }) {
  detailBox.style.display = 'block';
  d_title.textContent = thesis.Title;
  d_prof.textContent = `Επιβλέπων: ${thesis.ProfessorName || '—'}`;
  d_student.textContent = `Φοιτητής: ${thesis.StudentName || '—'} ${thesis.StudentAM ? `(AM: ${thesis.StudentAM})` : ''}`;

  // committee
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

  // final grade
  d_grade.textContent = finalGrade != null ? Number(finalGrade).toFixed(2) : '—';

  // links
  d_links.innerHTML = '';
  // if (thesis.RepositoryLink && thesis.RepositoryLink.trim().toLowerCase() !== 'unknown') {
  //   const a = document.createElement('a');
  //   a.href = thesis.RepositoryLink; a.target='_blank'; a.className='btn-small'; a.textContent='Αποθετήριο';
  //   d_links.appendChild(a);
  // }
  // if (latestSubmission?.FileURL) {
  //   const a = document.createElement('a');
  //   a.href = normalizeFileURL(latestSubmission.FileURL);
  //   a.target = '_blank'; a.className = 'btn-small'; a.textContent = 'Τελευταίο Υποβληθέν Αρχείο';
  //   d_links.appendChild(a);
  }
  if (!d_links.children.length) {
    const span = document.createElement('span'); span.textContent = '—'; d_links.appendChild(span);
  }

  // Supervisor actions & notes — only ACTIVE
  const isSupervisor = Number(me?.UserID) === Number(thesis.ProfessorID);

  // UNDER-EXAMINATION
  const amCommittee = (committee || []).some(m => Number(m.UserID) === Number(me?.UserID));
  const canSeeExamStuff = isSupervisor || amCommittee;
  const hasExam = !!(exam && exam.ExamDate);

  if (thesis.Status === 'UNDER-EXAMINATION') {
    // (1) Υποβολές (draft)
    if (submissionsBox) submissionsBox.style.display = canSeeExamStuff ? 'block' : 'none';
    if (canSeeExamStuff && subsList) {
      subsList.innerHTML = '<li class="muted">Φόρτωση…</li>';
      fetch(`${API_BASE}/thesis/${thesis.ThesisID}/submissions`, { headers: { ...authHeader() }})
        .then(r => r.json())
        .then(list => {
          if (!Array.isArray(list) || !list.length) { subsList.innerHTML = '<li class="muted">Δεν υπάρχουν υποβολές.</li>'; return; }
          const frag = document.createDocumentFragment();
          list.forEach(s => {
            const li = document.createElement('li');
            li.style.marginBottom = '6px';
            const fileBtn = s.FileURL ? `<a class="btn-small" href="${normalizeFileURL(s.FileURL)}" target="_blank" rel="noopener">Αρχείο</a>` : '';
            const linkBtn = s.LinkURL ? `<a class="btn-small" href="${s.LinkURL}" target="_blank" rel="noopener">Σύνδεσμος</a>` : '';
            li.innerHTML = `${fileBtn} ${linkBtn} <span class="muted" style="margin-left:8px;">${s.DateUploaded}</span>`;
            frag.appendChild(li);
          });
          subsList.innerHTML = '';
          subsList.appendChild(frag);
        })
        .catch(() => subsList.innerHTML = '<li class="muted">Σφάλμα φόρτωσης.</li>');
    }

    // (2) Ανακοίνωση (supervisor + has exam)
    if (announcementBox) announcementBox.style.display = (isSupervisor && hasExam) ? 'block' : 'none';
    if (isSupervisor && hasExam && btnAnnPreview && btnAnnSave && annPreviewText) {
      btnAnnPreview.onclick = async () => {
        annPreviewText.textContent = 'Παράγεται…';
        const r = await fetch(`${API_BASE}/thesis/${thesis.ThesisID}/announcement/preview`, { headers: { ...authHeader() }});
        const j = await r.json().catch(()=>({}));
        annPreviewText.textContent = r.ok ? (j.Description || '—') : (j.message || 'Αποτυχία.');
      };
      btnAnnSave.onclick = async () => {
        if (!annPreviewText.textContent.trim()) { alert('Πρώτα Προεπισκόπηση.'); return; }
        const r = await fetch(`${API_BASE}/thesis/${thesis.ThesisID}/announcement`, {
          method:'POST', headers: { 'Content-Type':'application/json', ...authHeader() },
          body: JSON.stringify({ Description: annPreviewText.textContent })
        });
        const j = await r.json().catch(()=>({}));
        if (!r.ok) { alert(j.message || 'Αποτυχία.'); return; }
        alert('Η ανακοίνωση καταχωρήθηκε.');
      };
    }

    // (3) Βαθμολόγηση
    if (gradingBox) gradingBox.style.display = (canSeeExamStuff && hasExam) ? 'block' : 'none';
    if (canSeeExamStuff && hasExam) {
      const loadGrades = async () => {
        gradesBody.innerHTML = '<tr><td colspan="7" class="muted">Φόρτωση…</td></tr>';
        const r = await fetch(`${API_BASE}/exam/${exam.ExamID}/grades`, { headers: { ...authHeader() } });
        if (!r.ok) { gradesBody.innerHTML = '<tr><td colspan="7" class="muted">Σφάλμα.</td></tr>'; return; }
        const rows = await r.json();
        if (!rows.length) { gradesBody.innerHTML = '<tr><td colspan="7" class="muted">—</td></tr>'; return; }
        const frag = document.createDocumentFragment();
        rows.forEach(g => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="padding:6px 8px;">${escapeHtml(g.ProfessorName || '—')}</td>
            <td style="text-align:center;">${Number(g.Grade).toFixed(2)}</td>
            <td style="text-align:center;">${g.ScoreWorkQuality}</td>
            <td style="text-align:center;">${g.ScoreDuration}</td>
            <td style="text-align:center;">${g.ScoreTextQuality}</td>
            <td style="text-align:center;">${g.ScorePresentation}</td>
            <td style="text-align:center;">${g.UpdatedAt}</td>
          `;
          frag.appendChild(tr);
        });
        gradesBody.innerHTML = '';
        gradesBody.appendChild(frag);
      };

      gradingInfo.textContent = exam.GradingOpen ? 'Η βαθμολόγηση είναι ΑΝΟΙΧΤΗ.' : 'Η βαθμολόγηση είναι ΚΛΕΙΣΤΗ.';

      if (gradingToggleRow && chkOpenGrading) {
        gradingToggleRow.style.display = isSupervisor ? 'block' : 'none';
        chkOpenGrading.checked = !!exam.GradingOpen;
        chkOpenGrading.onchange = async () => {
          const r = await fetch(`${API_BASE}/thesis/${thesis.ThesisID}/grading/open`, {
            method:'PUT', headers: { 'Content-Type':'application/json', ...authHeader() },
            body: JSON.stringify({ open: chkOpenGrading.checked ? 1 : 0 })
          });
          const j = await r.json().catch(()=>({}));
          if (!r.ok) { alert(j.message || 'Αποτυχία.'); chkOpenGrading.checked = !chkOpenGrading.checked; return; }
          gradingInfo.textContent = chkOpenGrading.checked ? 'Η βαθμολόγηση είναι ΑΝΟΙΧΤΗ.' : 'Η βαθμολόγηση είναι ΚΛΕΙΣΤΗ.';
          exam.GradingOpen = chkOpenGrading.checked ? 1 : 0;
          gradeForm.style.display = (exam.GradingOpen && canSeeExamStuff) ? 'block' : 'none';
        };
      }

      if (gradeForm) {
        gradeForm.style.display = (exam.GradingOpen && canSeeExamStuff) ? 'block' : 'none';
        gradeForm.onsubmit = async (ev) => {
          ev.preventDefault();
          const payload = {
            ScoreWorkQuality: Number(scWork?.value || 0),
            ScoreDuration: Number(scDur?.value || 0),
            ScoreTextQuality: Number(scText?.value || 0),
            ScorePresentation: Number(scPres?.value || 0),
          };
          const bad = Object.values(payload).some(v => Number.isNaN(v) || v < 0 || v > 10);
          if (bad) return alert('Οι τιμές πρέπει να είναι 0..10');
          const r = await fetch(`${API_BASE}/exam/${exam.ExamID}/grade`, {
            method:'POST', headers: { 'Content-Type':'application/json', ...authHeader() },
            body: JSON.stringify(payload)
          });
          const j = await r.json().catch(()=>({}));
          if (!r.ok) return alert(j.message || 'Αποτυχία.');
          alert('Ο βαθμός καταχωρήθηκε.');
          recomputeTotal();
          loadGrades();
        };
      }

      recomputeTotal();
      loadGrades();
    }
  } else {
    if (submissionsBox) submissionsBox.style.display = 'none';
    if (announcementBox) announcementBox.style.display = 'none';
    if (gradingBox) gradingBox.style.display = 'none';
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

  // ΠΕΡΝΑΜΕ ΤΟ JWT ΩΣ query 
  const token = localStorage.getItem('authToken') || '';
  params.set('token', token);

  const url = `${API_BASE}/professor/theses/export?${params.toString()}`;
  window.open(url, '_blank');
}

// helpers
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
