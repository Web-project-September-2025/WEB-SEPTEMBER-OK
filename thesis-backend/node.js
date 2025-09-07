const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

// ---- DB
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "2004",
  database: "thesisdetails",
});

db.connect((err) => {
  if (err) throw err;
  console.log("✅ Συνδέθηκε με τη βάση!");
});

// ---- AUTH
app.post("/login", (req, res) => {
  let { email = "", password = "", role = "" } = req.body;
  email = email.trim();
  password = password.trim();
  const wantedRole = (role || "").toString().trim().toUpperCase();

  const sql = "SELECT * FROM users WHERE Email = ? AND Password = ? LIMIT 1";
  db.query(sql, [email, password], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(401).json({ message: "Λάθος στοιχεία" });

    const user = rows[0];
    if (wantedRole && user.Role !== wantedRole) {
      return res.status(403).json({ message: "Λανθασμένος ρόλος για αυτόν τον χρήστη" });
    }
    res.json(user);
  });
});

// ---- APIs

// Όλες/φιλτραρισμένες ΔΕ
app.get("/theses", (req, res) => {
  const statuses = (req.query.statuses || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (statuses.length === 0) {
    const sql = `
      SELECT t.*, u.UserName AS ProfessorName
      FROM thesis t
      LEFT JOIN users u ON t.ProfessorID = u.UserID
      ORDER BY t.ThesisID ASC
    `;
    return db.query(sql, (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    });
  }

  const placeholders = statuses.map(() => "?").join(",");
  const sql = `
    SELECT t.*, u.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.Status IN (${placeholders})
    ORDER BY t.ThesisID ASC
  `;
  db.query(sql, statuses, (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// Λεπτομέρειες ΔΕ
app.get("/thesis/:id", (req, res) => {
  const thesisId = req.params.id;
  const sql = `
    SELECT t.*, u.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.ThesisID = ?
  `;
  db.query(sql, [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).send("Not found");
    res.json(rows[0]);
  });
});

// Αιτήσεις/μέλη επιτροπής για ΔΕ
app.get("/thesis/:id/requests", (req, res) => {
  const thesisId = req.params.id;
  const sql = `
    SELECT r.*, u.UserName AS ProfessorName, u.Email
    FROM requests r
    JOIN users u ON r.ProfessorID = u.UserID
    WHERE r.ThesisID = ?
  `;
  db.query(sql, [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// Καταχώρηση Πρωτοκόλλου (ACTIVE)
app.post("/thesis/:id/protocol", (req, res) => {
  const thesisId = req.params.id;
  const { protocol } = req.body;
  if (!protocol) return res.status(400).json({ message: "Λείπει protocol" });
  const sql = `UPDATE thesis SET ProtocolNumber = ? WHERE ThesisID = ?`;
  db.query(sql, [protocol, thesisId], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: "OK" });
  });
});

/**
 * ❗ Ακύρωση ενεργής ΔΕ από Γραμματεία
 * Αλλάζει Status σε 'CANCELLED' και αποθηκεύει:
 *  - CancellationGSNumber (π.χ. ΓΣ-15/2025)
 *  - CancellationReason   (ελεύθερο κείμενο)
 *
 * Προϋποθέσεις στήλες στον πίνακα thesis:
 *   CancellationGSNumber VARCHAR(50) NULL,
 *   CancellationReason   TEXT        NULL
 */
app.put("/thesis/:id/cancel", (req, res) => {
  const thesisId = req.params.id;
  const { gsNumber, reason } = req.body;

  if (!gsNumber || !reason) {
    return res
      .status(400)
      .json({ message: "Απαιτούνται ΑΠ ΓΣ και λόγος ακύρωσης." });
  }

  // Επιτρέπουμε ακύρωση μόνο από ACTIVE
  const checkSql = "SELECT Status FROM thesis WHERE ThesisID = ? LIMIT 1";
  db.query(checkSql, [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length)
      return res.status(404).json({ message: "Δεν βρέθηκε διπλωματική." });

    if (rows[0].Status !== "ACTIVE") {
      return res
        .status(409)
        .json({ message: "Ακύρωση επιτρέπεται μόνο για ενεργές διπλωματικές." });
    }

    const sql = `
      UPDATE thesis
      SET Status = 'CANCELLED',
        CancellationGSNumber = ?,
        CancellationYear = YEAR(CURDATE()),
        CancellationReason = ?,
        IsCancelled = 1,
        EndDate = CURDATE()
      WHERE ThesisID = ?
    `;

    db.query(sql, [gsNumber, reason, thesisId], (err2) => {
      if (err2) return res.status(500).send(err2);
      res.json({ message: "Η ΔΕ ακυρώθηκε επιτυχώς." });
    });
  });
});

// Έλεγχος αν μια ΔΕ είναι "έτοιμη για περάτωση"
app.get("/thesis/:id/finishable", (req, res) => {
  const thesisId = req.params.id;

  const qGrades = `
    SELECT COUNT(*) AS cnt
    FROM exam e
    JOIN grade g ON g.ExamID = e.ExamID
    WHERE e.ThesisID = ?
  `;
  const qRepo = `SELECT RepositoryLink FROM thesis WHERE ThesisID = ? LIMIT 1`;

  db.query(qGrades, [thesisId], (err, rowsG) => {
    if (err) return res.status(500).send(err);
    const hasGrades = (rowsG?.[0]?.cnt || 0) > 0;

    db.query(qRepo, [thesisId], (err2, rowsR) => {
      if (err2) return res.status(500).send(err2);
      const repo = rowsR?.[0]?.RepositoryLink || "";
      // Δεχόμαστε repo που δεν είναι κενό ούτε 'unknown'
      const hasRepositoryLink = !!repo && repo.trim() !== "" && repo.trim().toLowerCase() !== "unknown";

      res.json({ hasGrades, hasRepositoryLink, ok: hasGrades && hasRepositoryLink });
    });
  });
});

// Περάτωση ΔΕ (μόνο από UNDER-EXAMINATION και μόνο αν ok)
app.post("/thesis/:id/finalize", (req, res) => {
  const thesisId = req.params.id;

  const qStatus = `SELECT Status FROM thesis WHERE ThesisID = ? LIMIT 1`;
  db.query(qStatus, [thesisId], (err, rowsS) => {
    if (err) return res.status(500).send(err);
    if (!rowsS.length) return res.status(404).json({ message: "Δεν βρέθηκε διπλωματική." });
    if (rowsS[0].Status !== "UNDER-EXAMINATION") {
      return res.status(409).json({ message: "Περάτωση επιτρέπεται μόνο για διπλωματικές Υπό Εξέταση." });
    }

    // Ξανα-ελέγχουμε προϋποθέσεις
    const qGrades = `
      SELECT COUNT(*) AS cnt
      FROM exam e
      JOIN grade g ON g.ExamID = e.ExamID
      WHERE e.ThesisID = ?
    `;
    const qRepo = `SELECT RepositoryLink FROM thesis WHERE ThesisID = ? LIMIT 1`;

    db.query(qGrades, [thesisId], (errG, rowsG) => {
      if (errG) return res.status(500).send(errG);
      const hasGrades = (rowsG?.[0]?.cnt || 0) > 0;

      db.query(qRepo, [thesisId], (errR, rowsR) => {
        if (errR) return res.status(500).send(errR);
        const repo = rowsR?.[0]?.RepositoryLink || "";
        const hasRepositoryLink = !!repo && repo.trim() !== "" && repo.trim().toLowerCase() !== "unknown";

        if (!hasGrades || !hasRepositoryLink) {
          return res.status(422).json({ message: "Απαιτούνται βαθμοί και σύνδεσμος Νημερτής/αποθετηρίου." });
        }

        const qUpdate = `
          UPDATE thesis
          SET Status = 'FINISHED',
              EndDate = CURDATE()
          WHERE ThesisID = ?
        `;
        db.query(qUpdate, [thesisId], (errU) => {
          if (errU) return res.status(500).send(errU);
          res.json({ message: "✅ Η διπλωματική περατώθηκε." });
        });
      });
    });
  });
});


// Εισαγωγή χρηστών από JSON
app.post("/import-users", (req, res) => {
  const users = req.body;
  if (!Array.isArray(users)) {
    return res
      .status(400)
      .json({ message: "Το αρχείο δεν περιέχει έγκυρο array JSON." });
  }
  const sql = `
    INSERT INTO users (Password, UserName, Role, Adress, Phone, Email)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const tasks = users.map(
    (u) =>
      new Promise((resolve, reject) => {
        db.query(
          sql,
          [u.Password, u.UserName, u.Role, u.Adress, u.Phone || null, u.Email],
          (err) => (err ? reject(err) : resolve())
        );
      })
  );
  Promise.all(tasks)
    .then(() => res.json({ message: "✅ Οι χρήστες καταχωρήθηκαν με επιτυχία." }))
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Σφάλμα κατά την εισαγωγή χρηστών." });
    });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});



