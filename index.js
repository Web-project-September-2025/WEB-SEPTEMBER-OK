const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Σύνδεση με τη βάση
const db = mysql.createConnection({
  host: "localhost",
  user: "root",         
  password: "2004",        
  database: "thesisDetails"
});

db.connect((err) => {
  if (err) throw err;
  console.log("✅ Συνδέθηκε με τη βάση!");
});

// Π.χ. Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE Email = ? AND Password = ?";
  db.query(sql, [email, password], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results.length === 0) return res.status(401).json({ message: "Λάθος στοιχεία" });
    res.json(results[0]);
  });
});

// Π.χ. Προφίλ
app.get("/user/:id", (req, res) => {
  const userId = req.params.id;
  const sql = "SELECT * FROM users WHERE UserID = ?";
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results[0]);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Φέρνει τις διπλωματικές ενός φοιτητή
app.get("/thesis/student/:id", (req, res) => {
  const studentId = req.params.id;
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

//Thesis details 
app.get("/thesis/:id", (req, res) => {
  const thesisId = req.params.id;
  const sql = `
    SELECT t.*, u.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.ThesisID = ?`;

  db.query(sql, [thesisId], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results.length === 0) return res.status(404).send("Not found");
    res.json(results[0]);
  });
});

app.put("/user/:id", (req, res) => {
  const userId = req.params.id;
  const { Adress, Email, Phone } = req.body;

  const sql = `
    UPDATE users
    SET Adress = ?, Email = ?, Phone = ?
    WHERE UserID = ?
  `;
  db.query(sql, [Adress, Email, Phone, userId], (err, result) => {
    if (err) 
      return res.status(500).send(err);
    res.json({ message: "Τα στοιχεία ενημερώθηκαν επιτυχώς." });
  });
});
