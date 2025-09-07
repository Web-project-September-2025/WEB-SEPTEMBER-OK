// --- imports ---
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

// --- constants ---
const JWT_SECRET = "change_me_super_secret";
const PORT = 3000;

// --- app & middleware ---
const app = express();
app.use(cors()); // προσαρμόζεις αν θες origin/credentials
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static
app.use(express.static(path.join(__dirname, "public")));

// --- uploads (optional PDF) ---
const uploadRoot = path.join(__dirname, "uploads");
const pdfDir = path.join(uploadRoot, "pdfs");
fs.mkdirSync(pdfDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pdfDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + "_" + file.originalname.replace(/\s+/g, "_");
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file && file.mimetype && file.mimetype !== "application/pdf") {
      return cb(new Error("Μόνο PDF επιτρέπεται"));
    }
    cb(null, true);
  },
});

// Serve uploaded files
app.use("/uploads", express.static(uploadRoot));

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

// ---- AUTH helpers
function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { UserID, Name, Role, Email }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
function requireProfessor(req, res, next) {
  if (req.user?.Role !== "PROFESSOR") {
    return res.status(403).json({ message: "Only professors" });
  }
  next();
}

// ---- AUTH: LOGIN
app.post("/login", (req, res) => {
  let { email = "", password = "", role = "" } = req.body;
  email = String(email).trim();
  password = String(password).trim();
  const wantedRole = String(role || "").trim().toUpperCase();

  const sql = "SELECT * FROM users WHERE Email = ? AND Password = ? LIMIT 1";
  db.query(sql, [email, password], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(401).json({ message: "Λάθος στοιχεία" });

    const user = rows[0];
    if (wantedRole && user.Role !== wantedRole) {
      return res.status(403).json({ message: "Λανθασμένος ρόλος για αυτόν τον χρήστη" });
    }

    const payload = {
      UserID: user.UserID,
      Name: user.UserName,
      Role: user.Role,
      Email: user.Email,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ ...payload, token });
  });
});

app.get("/me", auth, (req, res) => res.json(req.user));

// ---- PROFESSOR TOPICS ----
// List topics of the logged-in professor
app.get("/professor/topics", auth, requireProfessor, (req, res) => {
  const onlyAssignable = String(req.query.onlyAssignable || "") === "1";
  const professorId = req.user.UserID;

  let sql = `
    SELECT ThesisID, Title, Description, Status, StartDate, EndDate,
           Progress, RepositoryLink, PdfPath, StudentID, AssignmentConfirmed
    FROM thesis
    WHERE ProfessorID = ?
  `;
  const params = [professorId];

  if (onlyAssignable) sql += ` AND Status = 'UNDER-ASSIGNMENT'`;
  sql += " ORDER BY ThesisID DESC";

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

app.post("/professor/topics", auth, requireProfessor, upload.single("pdfFile"), (req, res) => {
  const { title, summary } = req.body;
  if (!title || !summary) return res.status(400).json({ message: "title & summary required" });

  const pdfPath = req.file ? `/uploads/pdfs/${req.file.filename}` : null;

  const now = new Date();
  const start = now.toISOString().slice(0, 10);
  const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  const end = endDate.toISOString().slice(0, 10);

  const sql = `
    INSERT INTO thesis
      (Title, Description, StudentID, ProfessorID, Status, StartDate, EndDate, Progress, RepositoryLink, PdfPath, AssignmentConfirmed)
    VALUES (?, ?, NULL, ?, 'UNDER-ASSIGNMENT', ?, ?, 0, 'unknown', ?, 0)
  `;
  db.query(sql, [title, summary, req.user.UserID, start, end, pdfPath], (err, result) => {
    if (err) return res.status(500).send(err);
    res.status(201).json({
      ThesisID: result.insertId,
      Title: title,
      Description: summary,
      Status: "UNDER-ASSIGNMENT",
      StartDate: start,
      EndDate: end,
      Progress: 0,
      RepositoryLink: "unknown",
      PdfPath: pdfPath,
      StudentID: null,
      AssignmentConfirmed: 0,
    });
  });
});

app.put("/professor/topics/:id", auth, requireProfessor, upload.single("pdfFile"), (req, res) => {
  const thesisId = req.params.id;
  const { title, summary, status } = req.body;

  db.query("SELECT ProfessorID FROM thesis WHERE ThesisID = ? LIMIT 1", [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    if (rows[0].ProfessorID !== req.user.UserID) {
      return res.status(403).json({ message: "Not your thesis" });
    }

    const fields = [];
    const params = [];
    if (title)   { fields.push("Title = ?");       params.push(title); }
    if (summary) { fields.push("Description = ?"); params.push(summary); }
    if (status)  { fields.push("Status = ?");      params.push(status); }
    if (req.file){ fields.push("PdfPath = ?");     params.push(`/uploads/pdfs/${req.file.filename}`); }
    if (!fields.length) return res.status(400).json({ message: "Nothing to update" });
    params.push(thesisId);

    db.query(`UPDATE thesis SET ${fields.join(", ")} WHERE ThesisID = ?`, params, (err2) => {
      if (err2) return res.status(500).send(err2);
      db.query(`
        SELECT ThesisID, Title, Description, Status, StartDate, EndDate, Progress,
               RepositoryLink, PdfPath, StudentID, AssignmentConfirmed
        FROM thesis WHERE ThesisID = ?
      `, [thesisId], (err3, rows2) => {
        if (err3) return res.status(500).send(err3);
        res.json(rows2[0]);
      });
    });
  });
});

app.delete("/professor/topics/:id", auth, requireProfessor, (req, res) => {
  const thesisId = req.params.id;

  db.query("SELECT ProfessorID, PdfPath FROM thesis WHERE ThesisID = ? LIMIT 1", [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    if (rows[0].ProfessorID !== req.user.UserID) return res.status(403).json({ message: "Not your thesis" });

    db.query("DELETE FROM thesis WHERE ThesisID = ? LIMIT 1", [thesisId], (err2) => {
      if (err2) return res.status(500).send(err2);
      const pdfPath = rows[0].PdfPath;
      if (pdfPath) {
        const normalized = pdfPath.replace(/^\/+/, "");
        const abs = path.join(__dirname, normalized);
        fs.unlink(abs, () => {});
      }
      return res.status(204).send();
    });
  });
});

//
// ===== ΝΕΑ ENDPOINTS ΓΙΑ ΑΝΑΘΕΣΗ =====
//

// Αναζήτηση φοιτητών (ΑΜ ή Ονοματεπώνυμο)
// Αναζήτηση φοιτητών (ΑΜ ή Ονοματεπώνυμο) — ΠΡΟΤΕΡΑΙΟΤΗΤΑ στο AM
app.get("/students", auth, requireProfessor, (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    res.json([]);
    return;
  }

  // Αν δόθηκαν μόνο ψηφία, θεωρούμε ότι ψάχνουμε ΑΜ (στήλη AM)
  if (/^\d+$/.test(q)) {
    const sqlAM = `
      SELECT UserID, UserName, Email, AM
      FROM users
      WHERE Role='STUDENT' AND AM = ?
      LIMIT 20
    `;
    db.query(sqlAM, [q], (err, rows) => {
      if (err) { res.status(500).send(err); return; }
      if (rows.length > 0) { res.json(rows); return; }

      // Fallback: δοκίμασε UserID αν δεν βρέθηκε με AM
      const sqlUID = `
        SELECT UserID, UserName, Email, AM
        FROM users
        WHERE Role='STUDENT' AND UserID = ?
        LIMIT 20
      `;
      db.query(sqlUID, [Number(q)], (err2, rows2) => {
        if (err2) { res.status(500).send(err2); return; }
        res.json(rows2);
      });
    });
    return;
  }

  // Αλλιώς, αναζήτηση με ονοματεπώνυμο
  const sqlName = `
    SELECT UserID, UserName, Email, AM
    FROM users
    WHERE Role='STUDENT' AND UserName LIKE ?
    LIMIT 20
  `;
  db.query(sqlName, [`%${q}%`], (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    res.json(rows);
  });
});


// Προσωρινή ανάθεση/ακύρωση σε θέμα UNDER-ASSIGNMENT (owner only)
app.put("/thesis/:id/assign", auth, requireProfessor, (req, res) => {
  const thesisId = req.params.id;
  const { studentId } = req.body; // null => ακύρωση

  const q = `
    SELECT ThesisID, ProfessorID, Status, StudentID, AssignmentConfirmed
    FROM thesis WHERE ThesisID = ? LIMIT 1
  `;
  db.query(q, [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "Θέμα δεν βρέθηκε." });

    const t = rows[0];
    if (t.ProfessorID !== req.user.UserID) {
      return res.status(403).json({ message: "Δεν είστε ο επιβλέπων του θέματος." });
    }
    if (t.Status !== "UNDER-ASSIGNMENT") {
      return res.status(409).json({ message: "Ανάθεση επιτρέπεται μόνο σε θέματα UNDER-ASSIGNMENT." });
    }

    // Ακύρωση προσωρινής ανάθεσης
    if (studentId == null) {
      if (t.AssignmentConfirmed) {
        return res.status(409).json({ message: "Το θέμα είναι ήδη οριστικοποιημένο." });
      }
      const upd = "UPDATE thesis SET StudentID = NULL, AssignmentConfirmed = 0 WHERE ThesisID = ?";
      return db.query(upd, [thesisId], (e2) => {
        if (e2) return res.status(500).send(e2);
        return res.json({ message: "Ακυρώθηκε η προσωρινή ανάθεση." });
      });
    }

    // Έλεγχος ότι ο φοιτητής υπάρχει
    const qStu = "SELECT UserID FROM users WHERE UserID = ? AND Role='STUDENT' LIMIT 1";
    db.query(qStu, [studentId], (errS, rS) => {
      if (errS) return res.status(500).send(errS);
      if (!rS.length) return res.status(404).json({ message: "Δεν βρέθηκε φοιτητής με αυτό το ΑΜ/ID." });

      // 🚫 ΜΟΝΑΔΙΚΗ ΑΝΑΘΕΣΗ: ο φοιτητής δεν επιτρέπεται να έχει άλλη διπλωματική
      const qExists = `
        SELECT COUNT(*) AS cnt
        FROM thesis
        WHERE StudentID = ? AND ThesisID <> ?
          AND Status IN ('UNDER-ASSIGNMENT','ACTIVE','UNDER-EXAMINATION','FINISHED')
      `;
      db.query(qExists, [studentId, thesisId], (errE, rE) => {
        if (errE) return res.status(500).send(errE);
        if (rE[0].cnt > 0) {
          return res.status(409).json({
            message: "Ο φοιτητής έχει ήδη ανατεθειμένη διπλωματική."
          });
        }

        // Προχωράμε σε προσωρινή ανάθεση
        const upd = "UPDATE thesis SET StudentID = ?, AssignmentConfirmed = 0 WHERE ThesisID = ?";
        db.query(upd, [studentId, thesisId], (e3) => {
          if (e3) return res.status(500).send(e3);
          res.json({ message: "Το θέμα ανατέθηκε προσωρινά στον φοιτητή." });
        });
      });
    });
  });
});


// Λίστα καθηγητών (π.χ. για τριμελή)
app.get("/professors", auth, (req, res) => {
  const sql = "SELECT UserID, UserName, Email FROM users WHERE Role='PROFESSOR' ORDER BY UserName";
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

//
// ===== Υπόλοιπα endpoints (όπως τα είχες) =====
//

// All / filtered theses
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

// Thesis details
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

// Requests/committee (υπάρχον)
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

// Set protocol number
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

// Cancel thesis (προϋποθέτει τα cancellation πεδία)
app.put("/thesis/:id/cancel", (req, res) => {
  const thesisId = req.params.id;
  const { gsNumber, reason } = req.body;

  if (!gsNumber || !reason) {
    return res.status(400).json({ message: "Απαιτούνται ΑΠ ΓΣ και λόγος ακύρωσης." });
  }

  const checkSql = "SELECT Status FROM thesis WHERE ThesisID = ? LIMIT 1";
  db.query(checkSql, [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "Δεν βρέθηκε διπλωματική." });
    if (rows[0].Status !== "ACTIVE") {
      return res.status(409).json({ message: "Ακύρωση επιτρέπεται μόνο για ενεργές διπλωματικές." });
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

// Finishable check
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
      const hasRepositoryLink = !!repo && repo.trim() !== "" && repo.trim().toLowerCase() !== "unknown";
      res.json({ hasGrades, hasRepositoryLink, ok: hasGrades && hasRepositoryLink });
    });
  });
});

// Finalize thesis
app.post("/thesis/:id/finalize", (req, res) => {
  const thesisId = req.params.id;

  const qStatus = `SELECT Status FROM thesis WHERE ThesisID = ? LIMIT 1`;
  db.query(qStatus, [thesisId], (err, rowsS) => {
    if (err) return res.status(500).send(err);
    if (!rowsS.length) return res.status(404).json({ message: "Δεν βρέθηκε διπλωματική." });
    if (rowsS[0].Status !== "UNDER-EXAMINATION") {
      return res.status(409).json({ message: "Περάτωση επιτρέπεται μόνο για διπλωματικές Υπό Εξέταση." });
    }

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

// Import users
app.post("/import-users", (req, res) => {
  const users = req.body;
  if (!Array.isArray(users)) {
    return res.status(400).json({ message: "Το αρχείο δεν περιέχει έγκυρο array JSON." });
  }
  const sql = `
    INSERT INTO users (Password, UserName, Role, Adress, Phone, Email)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const tasks = users.map(
    (u) =>
      new Promise((resolve, reject) => {
        db.query(sql, [u.Password, u.UserName, u.Role, u.Adress, u.Phone || null, u.Email],
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

// ---- START
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
