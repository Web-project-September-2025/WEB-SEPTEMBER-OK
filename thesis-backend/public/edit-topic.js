document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('editTopicForm');
    const titleInput = document.getElementById('title');
    const summaryInput = document.getElementById('summary');
    const pdfInput = document.getElementById('pdfFile');
    const currentPdf = document.getElementById('currentPdf');
    const deleteBtn = document.getElementById('deleteBtn');

    // Φόρτωση δεδομένων θέματος από localStorage
    const topics = JSON.parse(localStorage.getItem('topics') || '[]');
    const idx = localStorage.getItem('editTopicIndex');
    if(idx === null || idx >= topics.length) {
        alert('Μη έγκυρο θέμα για επεξεργασία.');
        window.location.href = 'professor-dashboard.html';
        return;
    }

    let currentTopic = topics[idx];
    titleInput.value = currentTopic.title;
    summaryInput.value = currentTopic.summary;

    if(currentTopic.pdfName) {
        currentPdf.innerHTML = `Τρέχον αρχείο PDF: <a href="${currentTopic.pdfData}" target="_blank">${currentTopic.pdfName}</a>`;
    } else {
        currentPdf.textContent = 'Δεν υπάρχει επισυναπτόμενο αρχείο PDF.';
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        const newTitle = titleInput.value.trim();
        const newSummary = summaryInput.value.trim();

        if(!newTitle || !newSummary) {
            alert('Παρακαλώ συμπληρώστε τίτλο και σύνοψη.');
            return;
        }

        // Αν έχει επιλεγεί νέο pdf
        if(pdfInput.files.length > 0) {
            const file = pdfInput.files[0];
            if(file.type !== 'application/pdf') {
                alert('Παρακαλώ επιλέξτε αρχείο PDF.');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                currentTopic.title = newTitle;
                currentTopic.summary = newSummary;
                currentTopic.pdfName = file.name;
                currentTopic.pdfData = event.target.result;
                topics[idx] = currentTopic;
                localStorage.setItem('topics', JSON.stringify(topics));
                alert('Οι αλλαγές αποθηκεύτηκαν!');
                window.location.href = 'professor-dashboard.html';
            };
            reader.readAsDataURL(file);
        } else {
            currentTopic.title = newTitle;
            currentTopic.summary = newSummary;
            topics[idx] = currentTopic;
            localStorage.setItem('topics', JSON.stringify(topics));
            alert('Οι αλλαγές αποθηκεύτηκαν!');
            window.location.href = 'professor-dashboard.html';
        }
    });

    deleteBtn.addEventListener('click', () => {
        if(confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε το θέμα;')) {
            topics.splice(idx, 1);
            localStorage.setItem('topics', JSON.stringify(topics));
            alert('Το θέμα διαγράφηκε.');
            window.location.href = 'professor-dashboard.html';
        }
    });
});
