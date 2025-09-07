// Απλή προσωρινή αποθήκευση θεμάτων (θα μπορούσε να είναι fetch σε backend)
let topics = [];

// Στοιχεία DOM
const topicsList = document.getElementById('topicsList');
const addTopicForm = document.getElementById('addTopicForm');

// Φόρτωση θεμάτων από localStorage (αν υπάρχει)
if(localStorage.getItem('topics')) {
    topics = JSON.parse(localStorage.getItem('topics'));
    renderTopics();
}

// Συνάρτηση για εμφάνιση λίστας θεμάτων
function renderTopics() {
    topicsList.innerHTML = '';
    if(topics.length === 0) {
        topicsList.innerHTML = '<li>Δεν υπάρχουν θέματα.</li>';
        return;
    }

topicsList.appendChild(topicRow);
        topics.forEach((topic, index) => {
                const topicRow = document.createElement('div');
                topicRow.classList.add('thesis-row'); // Θα το στυλάρουμε με CSS

                // Αν το θέμα έχει πεδία από backend, χρησιμοποίησε Title/Description
                const title = topic.Title || topic.title || 'Χωρίς τίτλο';
                const summary = topic.Description || topic.summary || '';

                topicRow.innerHTML = `
                    <div class="thesis-title">${title}</div>
                    <div class="thesis-actions">
                        <button data-index="${index}" class="editBtn">Επεξεργασία</button>
                    </div>
                `;

                topicsList.appendChild(topicRow);
        });

    // Προσθήκη event listeners στα κουμπιά επεξεργασίας
    document.querySelectorAll('.editBtn').forEach(button => {
        button.addEventListener('click', event => {
            const idx = event.target.getAttribute('data-index');
            localStorage.setItem('editTopicIndex', idx);
            window.location.href = 'edit-topic.html';
        });
    });
}

// Χειριστής προσθήκης νέου θέματος
addTopicForm.addEventListener('submit', event => {
    event.preventDefault();

    const title = addTopicForm.title.value.trim();
    const summary = addTopicForm.summary.value.trim();
    const pdfInput = addTopicForm.pdfFile;

    if(!title || !summary) {
        alert('Παρακαλώ συμπληρώστε τίτλο και σύνοψη.');
        return;
    }

    // Αν έχει επιλεγεί PDF, το διαβάζουμε σαν base64
    if(pdfInput.files.length > 0) {
        const file = pdfInput.files[0];
        if(file.type !== 'application/pdf') {
            alert('Παρακαλώ επιλέξτε αρχείο PDF.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const pdfData = e.target.result; // base64
            addNewTopic(title, summary, file.name, pdfData);
        };
        reader.readAsDataURL(file);
    } else {
        // Χωρίς PDF
        addNewTopic(title, summary, null, null);
    }
});

function addNewTopic(title, summary, pdfName, pdfData) {
    const user = JSON.parse(localStorage.getItem('user')); // Πάρε τα στοιχεία του καθηγητή

    function generateUniqueId() {
        return Date.now() + Math.floor(Math.random() * 1000); // απλό μοναδικό id με timestamp + τυχαίο αριθμό
    }

    const newTopic = {
        title,
        summary,
        pdfName,
        pdfData,
        Status: 'UNDER-ASSIGNMENT',
        ProfessorID: user?.UserID || null,
        ProfessorName: user?.Name || 'Άγνωστος',
        StartDate: new Date().toISOString(),
        EndDate: null,
        StudentID: null,
        Progress: 0,
        RepositoryLink: '',
        ThesisID: generateUniqueId(), // Προαιρετικά αν θες id
        assignedTo: null,
        confirmed: false
    };

            topics.push(newTopic);
            localStorage.setItem('topics', JSON.stringify(topics));
            renderTopics();
            addTopicForm.reset();
            alert('Το θέμα προστέθηκε!');
}
