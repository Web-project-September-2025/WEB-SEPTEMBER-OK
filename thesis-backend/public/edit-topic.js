const API_BASE = 'http://localhost:3000';

function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

const editForm = document.getElementById('editForm');
const thesisId = localStorage.getItem('editTopicId');

// 1) Έλεγχος ότι υπάρχει ID
if (!thesisId) {
  alert('Μη έγκυρο θέμα για επεξεργασία.');
  window.location.href = 'topics-management.html';
}

// 2) Φόρτωση στοιχείων θέματος από το API
fetch(`${API_BASE}/thesis/${thesisId}`)
  .then(res => {
    if (!res.ok) throw new Error('Σφάλμα φόρτωσης δεδομένων');
    return res.json();
  })
  .then(thesis => {
    if (!thesis || !thesis.ThesisID) {
      throw new Error('Το θέμα δεν βρέθηκε στη βάση.');
    }
    document.getElementById('title').value = thesis.Title || '';
    document.getElementById('summary').value = thesis.Description || '';
    document.getElementById('status').value = thesis.Status || 'UNDER-ASSIGNMENT';
  })
  .catch(err => {
    alert('⛔ ' + err.message);
    window.location.href = 'topics-management.html';
  });

// 3) Υποβολή αλλαγών (με προαιρετικό PDF)
editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(editForm); // περιέχει title, summary, status, pdfFile

  fetch(`${API_BASE}/professor/topics/${thesisId}`, {
    method: 'PUT',
    headers: { ...authHeader() }, 
    body: formData
  })
  .then(res => {
    if (!res.ok) return res.json().then(j => { throw new Error(j.message || 'Αποτυχία αποθήκευσης'); });
    return res.json();
  })
  .then(() => {
    alert('✅ Αποθηκεύτηκε!');
    localStorage.removeItem('editTopicId');
    window.location.href = 'topics-management.html';
  })
  .catch(err => alert('⛔ ' + err.message));
});
