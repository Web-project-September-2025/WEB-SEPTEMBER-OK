// topics-management.js

const topicsList = document.getElementById('topicsList');
const addTopicForm = document.getElementById('addTopicForm');

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
loadTopics();

function loadTopics() {
  topicsList.innerHTML = '<div class="empty">Φόρτωση…</div>';
  fetch(`${API_BASE}/professor/topics`, {
    headers: { ...authHeader() }
  })
  .then(res => {
    if (!res.ok) throw new Error('Αποτυχία φόρτωσης');
    return res.json();
  })
  .then(topics => renderTopics(topics))
  .catch(err => {
    console.error(err);
    topicsList.innerHTML = '<div class="empty">Σφάλμα φόρτωσης.</div>';
  });
}

function renderTopics(topics) {
  topicsList.innerHTML = '';
  if (!Array.isArray(topics) || topics.length === 0) {
    topicsList.innerHTML = '<div class="empty">Δεν υπάρχουν θέματα.</div>';
    return;
  }

  topics.forEach((topic) => {
    const row = document.createElement('div');
    row.classList.add('thesis-row');

    const title = topic.Title || 'Χωρίς τίτλο';
    const status = topic.Status || '—';

    row.innerHTML = `
      <div class="thesis-title">${title}</div>
      <div class="thesis-status">${status}</div>
      <div class="thesis-actions">
        <button type="button" data-id="${topic.ThesisID}" class="editBtn">Επεξεργασία</button>
        <button type="button" data-id="${topic.ThesisID}" class="deleteBtn">Διαγραφή</button>
        ${topic.PdfPath ? `<a class="btn-small" href="http://localhost:3000${topic.PdfPath}" target="_blank" rel="noopener">PDF</a>` : ''}
      </div>
    `;
    topicsList.appendChild(row);
  });
}

// Event delegation για τα δυναμικά κουμπιά
topicsList.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.editBtn');
  if (editBtn) {
    const id = editBtn.getAttribute('data-id');
    localStorage.setItem('editTopicId', id);
    window.location.href = 'edit-topic.html';
    return;
  }

  const delBtn = e.target.closest('.deleteBtn');
  if (delBtn) {
    const id = delBtn.getAttribute('data-id');
    if (!confirm('Σίγουρα θέλεις να διαγράψεις το θέμα;')) return;

    fetch(`${API_BASE}/professor/topics/${id}`, {
      method: 'DELETE',
      headers: { ...authHeader() }
    })
    .then(res => {
      if (!res.ok) {
        return res.text().then(t => { throw new Error(t || 'Αποτυχία διαγραφής'); });
      }
      loadTopics();
    })
    .catch(err => alert('Error ' + err.message));
  }
});

// Προσθήκη νέου θέματος
addTopicForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(addTopicForm); // title, summary, pdfFile

  fetch(`${API_BASE}/professor/topics`, {
    method: 'POST',
    headers: { ...authHeader() }, // ΜΗΝ ορίσεις Content-Type για multipart
    body: formData
  })
  .then(res => {
    if (!res.ok) throw new Error('Αποτυχία δημιουργίας');
    return res.json();
  })
  .then(() => {
    addTopicForm.reset();
    alert('Το θέμα προστέθηκε!');
    loadTopics();
  })
  .catch(err => alert('Σφάλμα: ' + err.message));
});
