// professor-requests.js

document.addEventListener('DOMContentLoaded', async () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.Role !== 'PROFESSOR') {
    alert('⛔ Μη εξουσιοδοτημένη πρόσβαση');
    window.location.href = 'login.html';
    return;
  }

  const requestsList = document.getElementById('requestsList');
  requestsList.innerHTML = '<p>Φόρτωση...</p>';

  try {
    const res = await fetch(`http://localhost:3000/my-requests/${user.UserID}`);
    const requests = await res.json();
    if (!requests || requests.length === 0) {
      requestsList.innerHTML = '<p>Δεν υπάρχουν εκκρεμείς προσκλήσεις.</p>';
      return;
    }
    requestsList.innerHTML = '';
    requests.forEach(req => {
      const div = document.createElement('div');
      div.className = 'request-item';
      div.innerHTML = `
        <strong>Θέμα:</strong> ${req.Title}<br/>
        <strong>Φοιτητής:</strong> ${req.StudentName} (ΑΜ: ${req.StudentID})<br/>
        <strong>Κατάσταση:</strong> ${req.ReqStatus}<br/>
        <button class="btn-small accept-btn">Αποδοχή</button>
        <button class="btn-small reject-btn">Απόρριψη</button>
        <span class="request-msg" style="margin-left:10px;"></span>
      `;
      const acceptBtn = div.querySelector('.accept-btn');
      const rejectBtn = div.querySelector('.reject-btn');
      const msgSpan = div.querySelector('.request-msg');
      acceptBtn.addEventListener('click', async () => {
        acceptBtn.disabled = true;
        rejectBtn.disabled = true;
        msgSpan.textContent = 'Αποδοχή...';
        const res = await fetch(`http://localhost:3000/requests/${req.ReqID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ACCEPTED' })
        });
        if (res.ok) {
          msgSpan.textContent = 'Αποδεκτή!';
          div.style.opacity = 0.5;
        } else {
          msgSpan.textContent = 'Σφάλμα.';
        }
      });
      rejectBtn.addEventListener('click', async () => {
        acceptBtn.disabled = true;
        rejectBtn.disabled = true;
        msgSpan.textContent = 'Απόρριψη...';
        const res = await fetch(`http://localhost:3000/requests/${req.ReqID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'REJECTED' })
        });
        if (res.ok) {
          msgSpan.textContent = 'Απορρίφθηκε!';
          div.style.opacity = 0.5;
        } else {
          msgSpan.textContent = 'Σφάλμα.';
        }
      });
      requestsList.appendChild(div);
    });
  } catch (err) {
    requestsList.innerHTML = '<p>Σφάλμα φόρτωσης προσκλήσεων.</p>';
  }
});
