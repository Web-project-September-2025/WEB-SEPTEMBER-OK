<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ανάθεση Θέματος σε Φοιτητή</title>
  <link rel="stylesheet" href="styles/main.css" />
  <script defer src="assign-topic.js"></script>
</head>
<body class="assign-topic">

  <div class="overlay-logo">
    <img src="images/logo.png" alt="logo" class="logo" />
    <div class="top-line"></div>
  </div>

  <div class="top-right-title">
    <h2>Ανάθεση Θέματος σε Φοιτητή</h2>
  </div>

  <section class="search-student">
    <h3>Αναζήτηση Φοιτητή</h3>
    <form id="searchStudentForm">
      <label for="searchInput">ΑΜ ή Ονοματεπώνυμο:</label><br />
      <input type="text" id="searchInput" name="searchInput" required />
      <button type="submit" class="btn-small">Αναζήτηση</button>
    </form>
    <div id="studentResult"></div>
  </section>

  <section class="assign-topic-section" style="display:none;">
    <h3>Επιλογή Θέματος προς Ανάθεση</h3>
    <div id="availableTopicsList"></div>
    <button id="cancelAssignmentBtn" class="btn-small" style="display:none; margin-top: 10px;">
      Ακύρωση Όλων των Προσωρινών Αναθέσεων
    </button>
  </section>

  <div id="confirmModal" class="modal" style="display:none;">
    <div class="modal-content">
      <p id="confirmModalText"></p>
      <div class="modal-actions">
        <button id="confirmYesBtn" class="btn-small">Ναι</button>
        <button id="confirmNoBtn" class="btn-small">Όχι</button>
      </div>
    </div>
  </div>

  <button id="inviteCommitteeMainBtn" class="btn-small" style="position:fixed;bottom:30px;right:30px;z-index:1000;background:#2980b9;color:white;">Πρόσκληση στην Τριμελή</button>

  <div id="mainCommitteeModal" class="modal" style="display:none;">
    <section class="main-committee-invite-section" style="margin-top:0;min-width:320px;max-width:90vw;background:#222;padding:30px 20px 20px 20px;border-radius:10px;position:relative;">
      <button id="closeMainCommitteeModalBtn" style="position:absolute;top:10px;right:20px;font-size:1.5rem;background:none;border:none;color:white;cursor:pointer;">&times;</button>
      <h3>Πρόσκληση Μελών Τριμελούς Επιτροπής</h3>
      <form id="mainInviteCommitteeForm">
        <label for="thesisSelect">Επιλέξτε διπλωματική:</label>
        <select id="thesisSelect" required style="width:100%;margin-bottom:10px;"></select>
        <label for="mainProfessorSelect1">Επιλέξτε 1ο μέλος:</label>
        <select id="mainProfessorSelect1" required style="width:100%;"></select>
        <br/>
        <label for="mainProfessorSelect2">Επιλέξτε 2ο μέλος:</label>
        <select id="mainProfessorSelect2" required style="width:100%;"></select>
        <br/>
        <button type="submit" class="btn-small" style="margin-top:10px;">Αποστολή Προσκλήσεων</button>
        <div id="mainInviteCommitteeMsg" style="margin-top:10px;"></div>
      </form>
    </section>
  </div>

  <button class="logout-btn" onclick="window.location.href='index.html'">Αποσύνδεση</button>
  <a href="edit-profile.html" class="btn-small" style="position: absolute; top: 120px; right: 60px;">Επεξεργασία Προφίλ</a>

</body>
</html>
