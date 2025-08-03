let topics = [];
let currentStudent = null;

const searchStudentForm = document.getElementById('searchStudentForm');
const searchInput = document.getElementById('searchInput');
const studentResult = document.getElementById('studentResult');
const assignSection = document.querySelector('.assign-topic-section');
const availableTopicsList = document.getElementById('availableTopicsList');
const cancelAssignmentBtn = document.getElementById('cancelAssignmentBtn');

// === Αντί για localStorage, φέρε τα topics από backend ===
async function fetchTopicsFromBackend() {
  // Φέρε τον logged-in καθηγητή
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user.UserID) return [];
  // Ζήτα μόνο τα θέματα του συγκεκριμένου καθηγητή
  const res = await fetch(`http://localhost:3000/thesis?professorId=${user.UserID}`);
  if (!res.ok) return [];
  const data = await res.json();
  // Βεβαιώσου ότι κάθε θέμα έχει ThesisID
  return data.map(t => {
    if (!t.ThesisID && t.id) t.ThesisID = t.id;
    return t;
  });
}

// Προσοχή: το αντικείμενο topics έχει id, title, professorName, assignedTo, confirmed

// === Αναζήτηση φοιτητή με error handling στο frontend ===
searchStudentForm.addEventListener('submit', async e => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  try {
    const res = await fetch(`http://localhost:3000/students?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const errData = await res.json();
      studentResult.innerHTML = `<p style='color: #ff4444;'>${errData.message || 'Σφάλμα αναζήτησης.'}</p>`;
      assignSection.style.display = 'none';
      currentStudent = null;
      return;
    }
    const found = await res.json();
    if (!found || found.length === 0) {
      studentResult.innerHTML = '<p>Δεν βρέθηκε φοιτητής.</p>';
   assignSection.style.display = 'none';
      currentStudent = null;
      return;
    }
    currentStudent = { am: found[0].UserID, name: found[0].UserName };
    studentResult.innerHTML = `<p>Φοιτητής: ${currentStudent.name} (ΑΜ: ${currentStudent.am})</p>`;
    assignSection.style.display = 'block';
    // === Φέρε τα topics από backend ===
    topics = await fetchTopicsFromBackend();
    renderAvailableTopics();
  } catch (err) {
    studentResult.innerHTML = `<p style='color: #ff4444;'>Σφάλμα επικοινωνίας με τον server.</p>`;
    assignSection.style.display = 'none';
    currentStudent = null;
  }
});

async function renderAvailableTopics() {
  availableTopicsList.innerHTML = '';
  

  // Φέρε τον logged-in καθηγητή
  const user = JSON.parse(localStorage.getItem('user'));
  // Εμφάνιση μόνο θεμάτων που είναι διαθέσιμα για ανάθεση ΚΑΙ ανήκουν στον καθηγητή
  const available = topics.filter(
    t => (!t.confirmed && (!t.assignedTo || t.assignedTo === currentStudent.am))
);


  if (available.length === 0) {
    availableTopicsList.innerHTML = '<p>Δεν υπάρχουν διαθέσιμα θέματα για προσωρινή ανάθεση.</p>';
    cancelAssignmentBtn.style.display = 'none';
    return;
  }

  for (const topic of available) {
    const div = document.createElement('div');
    div.classList.add('topic-item');
    div.innerHTML = `
      <strong>${topic.Title}</strong><br/>
      <span>${topic.Description || ''}</span><br/>
      <button class="assignBtn">Προσωρινή Ανάθεση</button>
    `;
    div.querySelector('button').addEventListener('click', async () => {
      // Επιβεβαίωση ανάθεσης με modal
      const confirmAssign = await showConfirmModal('Επιβεβαιώνετε την προσωρινή ανάθεση του θέματος στον φοιτητή;');
      if (!confirmAssign) return;
      await fetch(`http://localhost:3000/thesis/${topic.ThesisID}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: currentStudent.am }),
      });
      alert('Το θέμα ανατέθηκε προσωρινά στον φοιτητή.');
      topics = await fetchTopicsFromBackend();
      renderAvailableTopics();
    });
    availableTopicsList.appendChild(div);
  }
  cancelAssignmentBtn.style.display = 'none';
}

cancelAssignmentBtn.addEventListener('click', async () => {
  if (!currentStudent) return;
  for (const topic of topics) {
    if (topic.assignedTo === currentStudent.am && !topic.confirmed) {
      topic.assignedTo = null;
      topic.confirmed = false;
      await fetch(`http://localhost:3000/thesis/${topic.ThesisID}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: null }),
      });
    }
  }
  // localStorage.setItem('topics', JSON.stringify(topics));
  alert('Όλες οι προσωρινές αναθέσεις ακυρώθηκαν.');
  renderAvailableTopics();
});

// === Επιτροπή: Πρόσκληση μελών ===
const committeeSection = document.querySelector('.committee-invite-section');
const inviteCommitteeForm = document.getElementById('inviteCommitteeForm');
const professorSelect1 = document.getElementById('professorSelect1');
const professorSelect2 = document.getElementById('professorSelect2');
const inviteCommitteeMsg = document.getElementById('inviteCommitteeMsg');

let availableProfessors = [];
let selectedThesisId = null;

// Εμφάνιση φόρμας επιτροπής όταν γίνει προσωρινή ανάθεση
async function showCommitteeInvite(thesisId, excludeProfessorId) {
  console.log('[DEBUG] showCommitteeInvite()', thesisId, excludeProfessorId);
  // Φέρε όλους τους καθηγητές εκτός του επιβλέποντα
  const res = await fetch('http://localhost:3000/professors');
  const profs = await res.json();
  availableProfessors = profs.filter(p => p.UserID !== excludeProfessorId);
  // Γέμισε τα select
  professorSelect1.innerHTML = '<option value="">--Επιλογή--</option>';
  professorSelect2.innerHTML = '<option value="">--Επιλογή--</option>';
  availableProfessors.forEach(p => {
    professorSelect1.innerHTML += `<option value="${p.UserID}">${p.UserName} (${p.Email})</option>`;
    professorSelect2.innerHTML += `<option value="${p.UserID}">${p.UserName} (${p.Email})</option>`;
  });
  professorSelect1.selectedIndex = 0;
  professorSelect2.selectedIndex = 0;
  selectedThesisId = thesisId;
  inviteCommitteeMsg.textContent = '';
  committeeSection.style.display = 'block';
  console.log('[DEBUG] committeeSection εμφανίστηκε');
}

if (inviteCommitteeForm) {
  inviteCommitteeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const prof1 = professorSelect1.value;
    const prof2 = professorSelect2.value;
    if (!prof1 || !prof2 || prof1 === prof2) {
      inviteCommitteeMsg.textContent = 'Επιλέξτε δύο διαφορετικούς καθηγητές.';
      inviteCommitteeMsg.style.color = '#ff4444';
      return;
    }
    // Αποστολή προσκλήσεων
    try {
      const res1 = await fetch('http://localhost:3000/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ThesisID: selectedThesisId, ProfessorID: prof1 })
      });
      const res2 = await fetch('http://localhost:3000/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ThesisID: selectedThesisId, ProfessorID: prof2 })
      });
      if (res1.status === 201 && res2.status === 201) {
        inviteCommitteeMsg.textContent = 'Οι προσκλήσεις στάλθηκαν επιτυχώς!';
        inviteCommitteeMsg.style.color = 'green';
        committeeSection.style.display = 'none';
      } else {
        const err1 = await res1.json();
        const err2 = await res2.json();
        inviteCommitteeMsg.textContent = (err1.message || '') + ' ' + (err2.message || '');
        inviteCommitteeMsg.style.color = '#ff4444';
      }
    } catch (err) {
      inviteCommitteeMsg.textContent = 'Σφάλμα αποστολής προσκλήσεων.';
      inviteCommitteeMsg.style.color = '#ff4444';
    }
  });
}

// === Custom modal confirmation ===
function showConfirmModal(message) {
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

// Απόκρυψη φόρμας επιτροπής όταν αλλάζει φοιτητής ή όταν δεν υπάρχει προσωρινή ανάθεση
function hideCommitteeInvite() {
  if (committeeSection) committeeSection.style.display = 'none';
}

// Κρύψε τη φόρμα όταν δεν υπάρχει προσωρινή ανάθεση
function checkShowCommitteeSection() {
  // Αν υπάρχει θέμα προσωρινά ανατεθειμένο στον φοιτητή, δείξε τη φόρμα
  const assignedTopic = topics.find(
    t => t.assignedTo === currentStudent?.am && !t.confirmed
  );
  if (assignedTopic) {
    // Βρες τον επιβλέποντα
    if (assignedTopic.professorId || assignedTopic.professorID) {
      showCommitteeInvite(assignedTopic.ThesisID, assignedTopic.professorId || assignedTopic.professorID);
    } else {
      fetch(`http://localhost:3000/thesis/${assignedTopic.ThesisID}`)
        .then(res => res.ok ? res.json() : null)
        .then(thesis => {
          if (thesis) showCommitteeInvite(assignedTopic.ThesisID, thesis.ProfessorID);
        });
    }
  } else {
    hideCommitteeInvite();
  }
}

// Κρύψε τη φόρμα όταν αλλάζει φοιτητής ή όταν δεν υπάρχει προσωρινή ανάθεση
searchStudentForm.addEventListener('submit', () => {
  hideCommitteeInvite();
});

// === Modal εμφάνιση φόρμας επιτροπής ===
function showCommitteeModal(thesisId, excludeProfessorId) {
  // Φέρε όλους τους καθηγητές εκτός του επιβλέποντα
  fetch('http://localhost:3000/professors')
    .then(res => res.json())
    .then(profs => {
      availableProfessors = profs.filter(p => p.UserID !== excludeProfessorId);
      professorSelect1.innerHTML = '<option value="">--Επιλογή--</option>';
      professorSelect2.innerHTML = '<option value="">--Επιλογή--</option>';
      availableProfessors.forEach(p => {
        professorSelect1.innerHTML += `<option value="${p.UserID}">${p.UserName} (${p.Email})</option>`;
        professorSelect2.innerHTML += `<option value="${p.UserID}">${p.UserName} (${p.Email})</option>`;
      });
      professorSelect1.selectedIndex = 0;
      professorSelect2.selectedIndex = 0;
      selectedThesisId = thesisId;
      inviteCommitteeMsg.textContent = '';
      // Εμφάνιση ως modal
      committeeSection.classList.add('modal');
      committeeSection.style.display = 'flex';
      committeeSection.style.position = 'fixed';
      committeeSection.style.top = '0';
      committeeSection.style.left = '0';
      committeeSection.style.width = '100vw';
      committeeSection.style.height = '100vh';
      committeeSection.style.justifyContent = 'center';
      committeeSection.style.alignItems = 'center';
      committeeSection.style.background = 'rgba(0,0,0,0.5)';
      // Κλείσιμο modal όταν πατηθεί εκτός φόρμας
      committeeSection.addEventListener('click', function handler(e) {
        if (e.target === committeeSection) {
          committeeSection.style.display = 'none';
          committeeSection.classList.remove('modal');
          committeeSection.style = '';
          committeeSection.removeEventListener('click', handler);
        }
      });
    });
}

// === ΝΕΟ: Κουμπί και modal για πρόσκληση στην τριμελή ===
const inviteCommitteeMainBtn = document.getElementById('inviteCommitteeMainBtn');
const mainCommitteeModal = document.getElementById('mainCommitteeModal');
const closeMainCommitteeModalBtn = document.getElementById('closeMainCommitteeModalBtn');
const mainInviteCommitteeForm = document.getElementById('mainInviteCommitteeForm');
const thesisSelect = document.getElementById('thesisSelect');
const mainProfessorSelect1 = document.getElementById('mainProfessorSelect1');
const mainProfessorSelect2 = document.getElementById('mainProfessorSelect2');
const mainInviteCommitteeMsg = document.getElementById('mainInviteCommitteeMsg');

let mainAvailableTheses = [];
let mainAvailableProfessors = [];

if (inviteCommitteeMainBtn) {
  inviteCommitteeMainBtn.addEventListener('click', async () => {
    // Φέρε τις διπλωματικές που έχει αναθέσει ο καθηγητής (ή όλες αν δεν υπάρχει φίλτρο)
    // Εδώ υποθέτουμε ότι ο logged in user είναι καθηγητής και υπάρχει στο localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.Role !== 'PROFESSOR') {
      alert('Δεν έχετε δικαίωμα πρόσβασης.');
      return;
    }
    // Φέρε όλα τα θέματα που είναι επιβλέπων ο καθηγητής
    const res = await fetch(`http://localhost:3000/thesis`);
    const allTheses = await res.json();
    mainAvailableTheses = allTheses.filter(t => t.ProfessorID === user.UserID);
    thesisSelect.innerHTML = '<option value="">--Επιλογή--</option>';
    mainAvailableTheses.forEach(t => {
      thesisSelect.innerHTML += `<option value="${t.ThesisID}">${t.Title} (${t.StudentID ? 'ΑΜ: '+t.StudentID : 'Χωρίς φοιτητή'})</option>`;
    });
    // Φέρε όλους τους καθηγητές
    const profRes = await fetch('http://localhost:3000/professors');
    const profs = await profRes.json();
    mainAvailableProfessors = profs.filter(p => p.UserID !== user.UserID);
    mainProfessorSelect1.innerHTML = '<option value="">--Επιλογή--</option>';
    mainProfessorSelect2.innerHTML = '<option value="">--Επιλογή--</option>';
    mainAvailableProfessors.forEach(p => {
      mainProfessorSelect1.innerHTML += `<option value="${p.UserID}">${p.UserName} (${p.Email})</option>`;
      mainProfessorSelect2.innerHTML += `<option value="${p.UserID}">${p.UserName} (${p.Email})</option>`;
    });
    mainProfessorSelect1.selectedIndex = 0;
    mainProfessorSelect2.selectedIndex = 0;
    mainInviteCommitteeMsg.textContent = '';
    mainCommitteeModal.style.display = 'flex';
  });
}
if (closeMainCommitteeModalBtn) {
  closeMainCommitteeModalBtn.addEventListener('click', () => {
    mainCommitteeModal.style.display = 'none';
  });
}
if (mainInviteCommitteeForm) {
  mainInviteCommitteeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const thesisId = thesisSelect.value;
    const prof1 = mainProfessorSelect1.value;
    const prof2 = mainProfessorSelect2.value;
    if (!thesisId || !prof1 || !prof2 || prof1 === prof2) {
      mainInviteCommitteeMsg.textContent = 'Επιλέξτε διπλωματική και δύο διαφορετικούς καθηγητές.';
      mainInviteCommitteeMsg.style.color = '#ff4444';
      return;
    }
    try {
      const res1 = await fetch('http://localhost:3000/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ThesisID: thesisId, ProfessorID: prof1 })
      });
      const res2 = await fetch('http://localhost:3000/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ThesisID: thesisId, ProfessorID: prof2 })
      });
      if (res1.status === 201 && res2.status === 201) {
        mainInviteCommitteeMsg.textContent = 'Οι προσκλήσεις στάλθηκαν επιτυχώς!';
        mainInviteCommitteeMsg.style.color = 'green';
        setTimeout(() => { mainCommitteeModal.style.display = 'none'; }, 1200);
      } else {
        const err1 = await res1.json();
        const err2 = await res2.json();
        mainInviteCommitteeMsg.textContent = (err1.message || '') + ' ' + (err2.message || '');
        mainInviteCommitteeMsg.style.color = '#ff4444';
      }
    } catch (err) {
      mainInviteCommitteeMsg.textContent = 'Σφάλμα αποστολής προσκλήσεων.';
      mainInviteCommitteeMsg.style.color = '#ff4444';
    }
  });
}

if (mainProfessorSelect1 && mainProfessorSelect2) {
  mainProfessorSelect1.addEventListener('change', () => {
    const selected1 = mainProfessorSelect1.value;
    Array.from(mainProfessorSelect2.options).forEach(opt => {
      opt.disabled = (opt.value && opt.value === selected1);
    });
  });
  mainProfessorSelect2.addEventListener('change', () => {
    const selected2 = mainProfessorSelect2.value;
    Array.from(mainProfessorSelect1.options).forEach(opt => {
      opt.disabled = (opt.value && opt.value === selected2);
    });
  });
}
