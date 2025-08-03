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

// Σύνδεση με τη βάση
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "2004",
  database: "thesisDetails",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Συνδέθηκε με τη βάση!");
});

// Login
app.post("/login", (req, res) => {
  const { email, password, role } = req.body;
  const sql = "SELECT * FROM users WHERE Email = ? AND Password = ? AND Role = ?";
  db.query(sql, [email, password, role], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results.length === 0) return res.status(401).json({ message: "Λάθος στοιχεία" });
    res.json(results[0]);
  });
});

// Προφίλ χρήστη
app.get("/user/:id", (req, res) => {
  const userId = req.params.id;
  const sql = "SELECT * FROM users WHERE UserID = ?";
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results[0]);
  });
});

// Ενημέρωση στοιχείων χρήστη
app.put("/user/:id", (req, res) => {
  const userId = req.params.id;
  const { Adress, Email, Phone } = req.body;
  const sql = `
    UPDATE users
    SET Adress = ?, Email = ?, Phone = ?
    WHERE UserID = ?
  `;
  db.query(sql, [Adress, Email, Phone, userId], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: "Τα στοιχεία ενημερώθηκαν επιτυχώς." });
  });
});

// Λήψη καθηγητών
app.get("/professors", (req, res) => {
  const sql = "SELECT UserID, UserName, Email FROM users WHERE Role = 'PROFESSOR'";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Θέματα φοιτητή
app.get("/thesis/student/:studentId", (req, res) => {
  const studentId = req.params.studentId;
  const sql = `
    SELECT t.*, u.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.StudentID = ?
  `;
  db.query(sql, [studentId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Προσωρινές αναθέσεις
app.get("/assignments/:studentId", (req, res) => {
  const studentId = req.params.studentId;
  const sql = `
    SELECT t.ThesisID, t.Title, u.UserName AS professorName, t.Confirmed, t.Status, t.Progress
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.StudentID = ? AND t.Confirmed = FALSE
  `;
  db.query(sql, [studentId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Λεπτομέρειες θέματος
app.get("/thesis/:id", (req, res) => {
  const thesisId = req.params.id;
  const sql = `
    SELECT t.*, u.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.ThesisID = ?
  `;
  db.query(sql, [thesisId], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results.length === 0) return res.status(404).send("Not found");
    res.json(results[0]);
  });
});

// Αιτήσεις για θέμα
app.get("/requests/:thesisId", (req, res) => {
  const sql = `
    SELECT r.ReqID, r.ReqStatus, u.UserName, u.Email
    FROM requests r
    JOIN users u ON r.ProfessorID = u.UserID
    WHERE r.ThesisID = ?
  `;
  db.query(sql, [req.params.thesisId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Δημιουργία αίτησης προς καθηγητή
app.post("/requests", (req, res) => {
  const { ThesisID, ProfessorID } = req.body;
  const checkSql = `SELECT * FROM requests WHERE ThesisID = ? AND ProfessorID = ?`;
  db.query(checkSql, [ThesisID, ProfessorID], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results && results.length > 0) {
      return res.status(409).json({ message: "Υπάρχει ήδη πρόσκληση για αυτόν τον καθηγητή και θέμα." });
    }
    const sql = `INSERT INTO requests (ThesisID, ProfessorID, ReqStatus) VALUES (?, ?, 'QUEUED')`;
    db.query(sql, [ThesisID, ProfessorID], (err) => {
      if (err) return res.status(500).send(err);
      res.status(201).json({ message: "Η αίτηση καταχωρήθηκε." });
    });
  });
});

// Καταχώρηση νέας διπλωματικής
app.post("/thesis", upload.single("pdf"), (req, res) => {
  const { title, description, start, end, professorId } = req.body;
  const pdfPath = req.file ? req.file.path : null;
  const sql = `
    INSERT INTO thesis (Title, Description, ProfessorID, Status, StartDate, EndDate, Progress, RepositoryLink, Confirmed)
    VALUES (?, ?, ?, 'UNDER-ASSIGNMENT', ?, ?, 0, ?, FALSE)
  `;
  db.query(sql, [title, description, professorId, start, end, pdfPath], (err) => {
    if (err) return res.status(500).send(err);
    res.status(201).json({ message: "Θέμα καταχωρήθηκε" });
  });
});

// Αναζήτηση φοιτητών
app.get("/students", (req, res) => {
  const query = req.query.q ? req.query.q.trim() : "";
  if (!query) return res.json([]);
  const sql = `
    SELECT u.UserID, u.UserName, u.Email
    FROM users u
    WHERE u.Role = 'STUDENT' AND (u.UserID LIKE ? OR u.UserName LIKE ?)
  `;
  const likeQuery = `%${query}%`;
  db.query(sql, [likeQuery, likeQuery], (err, results) => {
    if (err) return res.status(500).send(err);
    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Δεν βρέθηκε φοιτητής με αυτά τα στοιχεία." });
    }
    res.json(results);
  });
});

// Αποδοχή/Απόρριψη πρόσκλησης
app.put("/requests/:reqId", (req, res) => {
  const reqId = req.params.reqId;
  const { status } = req.body;
  const sql = "UPDATE requests SET ReqStatus = ? WHERE ReqID = ?";
  db.query(sql, [status, reqId], (err) => {
    if (err) return res.status(500).send(err);
    if (status === "ACCEPTED") {
      const getThesisSql = "SELECT ThesisID FROM requests WHERE ReqID = ?";
      db.query(getThesisSql, [reqId], (err, results) => {
        if (err || results.length === 0) return res.json({ message: "OK" });
        const thesisId = results[0].ThesisID;
        const countSql = "SELECT COUNT(*) AS cnt FROM requests WHERE ThesisID = ? AND ReqStatus = 'ACCEPTED'";
        db.query(countSql, [thesisId], (err, results) => {
          if (!err && results[0].cnt === 2) {
            db.query("UPDATE thesis SET Status = 'ACTIVE', Confirmed = TRUE WHERE ThesisID = ?", [thesisId]);
          }
          res.json({ message: "OK" });
        });
      });
    } else {
      res.json({ message: "OK" });
    }
  });
});

// Εκκρεμείς προσκλήσεις καθηγητή
app.get("/my-requests/:professorId", (req, res) => {
  const professorId = req.params.professorId;
  const sql = `
    SELECT r.*, t.Title, t.StudentID, u.UserName AS StudentName
    FROM requests r
    JOIN thesis t ON r.ThesisID = t.ThesisID
    JOIN users u ON t.StudentID = u.UserID
    WHERE r.ProfessorID = ? AND r.ReqStatus = 'QUEUED'
  `;
  db.query(sql, [professorId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Οριστική ανάθεση φοιτητή (ACTIVE)
app.get("/thesis/student/active/:studentId", (req, res) => {
  const studentId = req.params.studentId;
  const sql = `
    SELECT t.*, u.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.StudentID = ? AND t.Status = 'ACTIVE'
  `;
  db.query(sql, [studentId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Προσκλήσεις τριμελούς ανά θέμα
app.get("/thesis/:thesisId/requests", (req, res) => {
  const thesisId = req.params.thesisId;
  const sql = `
    SELECT r.*, u.UserName AS ProfessorName, u.Email
    FROM requests r
    JOIN users u ON r.ProfessorID = u.UserID
    WHERE r.ThesisID = ?
  `;
  db.query(sql, [thesisId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// 📌 ΔΙΟΡΘΩΜΕΝΟ: Λήψη θεμάτων προς ανάθεση
app.get("/thesis", (req, res) => {
  const professorId = req.query.professorId;
  let sql = `
    SELECT t.*, u.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.Status = 'UNDER-ASSIGNMENT'
  `;
  const params = [];
  if (professorId) {
    sql += " AND t.ProfessorID = ?";
    params.push(professorId);
  }
  console.log("[DEBUG] /thesis query:", sql, "params:", params);
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).send(err);
    console.log("[DEBUG] /thesis results:", results);
    res.json(results);
  });
});

// Προσωρινή ανάθεση φοιτητή
app.put("/thesis/:id/assign", (req, res) => {
  const thesisId = req.params.id;
  const { studentId } = req.body;
  const sql = `
    UPDATE thesis
    SET StudentID = ?, Confirmed = FALSE
    WHERE ThesisID = ?
  `;
  db.query(sql, [studentId, thesisId], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: "Η προσωρινή ανάθεση έγινε επιτυχώς." });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
