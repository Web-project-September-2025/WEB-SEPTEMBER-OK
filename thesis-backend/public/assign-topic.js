// assign-topic.js

const API_BASE = 'http://localhost:3000';

function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

let topics = [];
let currentStudent = null;

// DOM
const searchWrap = document.getElementById('searchWrap');
const assignWrap = document.getElementById('assignWrap');
const searchStudentForm = document.getElementById('searchStudentForm');
const searchInput = document.getElementById('searchInput');
const studentMatches = document.getElementById('studentMatches');
const studentInfo = document.getElementById('studentInfo');

const availableTopicsList = document.getElementById('availableTopicsList');
const provisionalList = document.getElementById('provisionalList');
const cancelAllBtn = document.getElementById('cancelAllBtn');

function ensureProfessor() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user || user.Role !== 'PROFESSOR') {
    alert('Μόνο για Διδάσκοντες.');
    window.location.href = 'login.html';
  }
}
ensureProfessor();

const me = JSON.parse(localStorage.getItem('user') || 'null');

// Φέρνουμε θέματα ΜΟΝΟ UNDER-ASSIGNMENT του καθηγητή
async function fetchProfessorAssignable() {
  const res = await fetch(`${API_BASE}/professor/topics?onlyAssignable=1`, {
    headers: { ...authHeader() }
  });
  if (!res.ok) return [];
  return res.json();
}

// Φέρνουμε ΟΛΑ του καθηγητή (για να φιλτράρουμε τα προσωρινά)
async function fetchAllProfessorTheses() {
  const res = await fetch(`${API_BASE}/professor/topics`, {
    headers: { ...authHeader() }
  });
  if (!res.ok) return [];
  return res.json();
}

function showAssignPanels() {
  searchWrap.style.display = 'none';
  assignWrap.style.display = 'block';
}

// ---- Αναζήτηση & επιλογή φοιτητή ----
searchStudentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;

  studentMatches.textContent = 'Αναζήτηση...';
  studentInfo.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/students?q=${encodeURIComponent(q)}`, {
      headers: { ...authHeader() }
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      studentMatches.innerHTML = `<p style="color:#ff6b6b">${e.message || 'Σφάλμα αναζήτησης.'}</p>`;
      return;
    }
    const students = await res.json();
    if (!students || students.length === 0) {
      studentMatches.innerHTML = '<p>Δεν βρέθηκε φοιτητής.</p>';
      return;
    }

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.margin = '0';
    ul.style.padding = '0';

    students.forEach(s => {
      const li = document.createElement('li');
      li.style.margin = '6px 0';
      const am = s.AM ? `AM: ${s.AM}` : `ID: ${s.UserID}`;
      li.innerHTML = `
        <span>${s.UserName} (${am})</span>
        <button class="btn-small" data-id="${s.UserID}" data-am="${s.AM || ''}" style="margin-left:10px;">Επιλογή</button>
      `;
      ul.appendChild(li);
    });

    studentMatches.innerHTML = '';
    studentMatches.appendChild(ul);

    ul.onclick = async (ev) => {
      const btn = ev.target.closest('button[data-id]');
      if (!btn) return;
      const uid = Number(btn.getAttribute('data-id'));
      const am = btn.getAttribute('data-am') || '';
      currentStudent = { userId: uid, am };

      const picked = students.find(x => x.UserID === uid);
      studentInfo.innerHTML = `<strong>Επιλεγμένος φοιτητής:</strong> ${picked.UserName} (${am ? 'AM: '+am : 'ID: '+uid})`;

      // Φόρτωσε panels και εμφάνισέ τα
      await loadPanels();
      showAssignPanels();
    };

  } catch (err) {
    console.error(err);
    studentMatches.innerHTML = `<p style="color:#ff6b6b">Σφάλμα επικοινωνίας.</p>`;
  }
});

// ---- Panels ----
async function loadPanels() {
  // Αριστερά: διαθέσιμα (UNDER-ASSIGNMENT)
  topics = await fetchProfessorAssignable();
  renderAvailable();

  // Δεξιά: προσωρινά του συγκεκριμένου φοιτητή
  const all = await fetchAllProfessorTheses();
  renderProvisional(all);
}

function renderAvailable() {
  availableTopicsList.innerHTML = '';
  if (!topics || topics.length === 0) {
    availableTopicsList.innerHTML = '<p>Δεν υπάρχουν διαθέσιμα θέματα.</p>';
    return;
  }

  const frag = document.createDocumentFragment();
  topics.forEach(t => {
    const div = document.createElement('div');
    div.className = 'topic-item';
    div.innerHTML = `
      <strong>${t.Title}</strong><br/>
      <span>${t.Description || ''}</span><br/>
      <div class="btn-row">
        <button class="btn-small" data-assign="${t.ThesisID}">Προσωρινή Ανάθεση</button>
      </div>
    `;
    frag.appendChild(div);
  });
  availableTopicsList.appendChild(frag);

  availableTopicsList.onclick = async (e) => {
    const btn = e.target.closest('button[data-assign]');
    if (!btn) return;
    const thesisId = btn.getAttribute('data-assign');

    const ok = await confirmModal('Επιβεβαιώνετε την προσωρινή ανάθεση του θέματος στον φοιτητή;');
    if (!ok) return;

    try {
      const resp = await fetch(`${API_BASE}/thesis/${thesisId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ studentId: currentStudent.userId }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(()=>({}));
        alert(e.message || 'Αποτυχία ανάθεσης.');
        return;
      }
      await loadPanels();
      alert('Το θέμα ανατέθηκε προσωρινά.');
    } catch (err) {
      alert('Σφάλμα επικοινωνίας.');
    }
  };
}

function renderProvisional(allTheses) {
  provisionalList.innerHTML = '';

  // Φίλτρο: του τρέχοντα καθηγητή + UNDER-ASSIGNMENT + StudentID = selected + προσωρινό
  const provisional = (allTheses || []).filter(t =>
    t.ProfessorID === me.UserID &&
    t.Status === 'UNDER-ASSIGNMENT' &&
    t.StudentID === currentStudent.userId &&
    Number(t.AssignmentConfirmed) === 0
  );

  if (provisional.length === 0) {
    provisionalList.innerHTML = '<p>Δεν υπάρχουν προσωρινές αναθέσεις για αυτόν τον φοιτητή.</p>';
    cancelAllBtn.style.display = 'none';
    return;
  }

  const frag = document.createDocumentFragment();
  provisional.forEach(t => {
    const div = document.createElement('div');
    div.className = 'topic-item';
    div.innerHTML = `
      <strong>${t.Title}</strong> <span class="pill">PROVISIONAL</span><br/>
      <span>${t.Description || ''}</span><br/>
      <div class="btn-row">
        <button class="btn-small danger" data-cancel="${t.ThesisID}">Ακύρωση Ανάθεσης</button>
      </div>
    `;
    frag.appendChild(div);
  });
  provisionalList.appendChild(frag);

  provisionalList.onclick = async (e) => {
    const btn = e.target.closest('button[data-cancel]');
    if (!btn) return;
    const thesisId = btn.getAttribute('data-cancel');

    const ok = await confirmModal('Να ακυρωθεί η προσωρινή ανάθεση;');
    if (!ok) return;

    try {
      const resp = await fetch(`${API_BASE}/thesis/${thesisId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ studentId: null }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(()=>({}));
        alert(e.message || 'Αποτυχία ακύρωσης.');
        return;
      }
      await loadPanels();
      alert('Η προσωρινή ανάθεση ακυρώθηκε.');
    } catch (err) {
      alert('Σφάλμα επικοινωνίας.');
    }
  };

  cancelAllBtn.style.display = 'inline-block';
  cancelAllBtn.onclick = async () => {
    const ok = await confirmModal('Να ακυρωθούν όλες οι προσωρινές αναθέσεις για τον φοιτητή;');
    if (!ok) return;
    for (const t of provisional) {
      await fetch(`${API_BASE}/thesis/${t.ThesisID}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ studentId: null }),
      });
    }
    await loadPanels();
    alert('Όλες οι προσωρινές αναθέσεις ακυρώθηκαν.');
  };
}

// ---- Modal confirm ----
function confirmModal(message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    const text = document.getElementById('confirmModalText');
    const yesBtn = document.getElementById('confirmYesBtn');
    const noBtn = document.getElementById('confirmNoBtn');
    text.textContent = message;
    modal.style.display = 'flex';

    function cleanup(result) {
      modal.style.display = 'none';
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      resolve(result);
    }
    function onYes() { cleanup(true); }
    function onNo() { cleanup(false); }
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
  });
}
