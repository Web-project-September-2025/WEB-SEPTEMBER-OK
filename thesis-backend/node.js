// imports 
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const path = require("path");

// Δήλωση φακέλου public (ή όπως λέγεται ο δικός σου)
app.use(express.static(path.join(__dirname, "public")));

// constants  
const JWT_SECRET = "change_me_super_secret";
const PORT = 3000;

// app & middleware 
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static
app.use(express.static(path.join(__dirname, "public")));

// uploads (optional PDF) 
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

// DB
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "2004",
  database: "thesisdetails",
  dateStrings: true,
});
db.connect((err) => {
  if (err) throw err;
  console.log("Συνδέθηκε με τη βάση!");
});

// AUTH helpers
function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET); 
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

// AUTH: LOGIN
app.post("/login", (req, res) => {
  let { email = "", password = "", role = "" } = req.body;
  email = String(email).trim();
  password = String(password).trim();
  const wantedRole = String(role || "").trim().toUpperCase();

  const sql = "SELECT * FROM users WHERE Email = ? AND Password = ? LIMIT 1";
  db.query(sql, [email, password], (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    if (!rows.length) { res.status(401).json({ message: "Λάθος στοιχεία" }); return; }

    const user = rows[0];
    if (wantedRole && user.Role !== wantedRole) {
      res.status(403).json({ message: "Λανθασμένος ρόλος για αυτόν τον χρήστη" }); return;
    }

    const payload = {
      UserID: user.UserID,
      Name: user.UserName,
      Role: user.Role,
      Email: user.Email,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
    res.json({ ...payload, token });
  });
});

app.get("/me", auth, (req, res) => res.json(req.user));

// PROFESSOR TOPICS  
app.get("/professor/topics", auth, requireProfessor, (req, res) => {
  const onlyAssignable = String(req.query.onlyAssignable || "") === "1";
  const professorId = req.user.UserID;

  let sql = `
    SELECT ThesisID, Title, Description, Status, StartDate, EndDate,
           Progress, RepositoryLink, PdfPath, StudentID, AssignmentConfirmed, ProfessorID
    FROM thesis
    WHERE ProfessorID = ?
  `;
  const params = [professorId];

  if (onlyAssignable) {
    sql += ` AND Status = 'UNDER-ASSIGNMENT' AND StudentID IS NULL`;
  }
  sql += " ORDER BY ThesisID DESC";

  db.query(sql, params, (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    res.json(rows);
  });
});

app.post("/professor/topics", auth, requireProfessor, upload.single("pdfFile"), (req, res) => {
  const { title, summary } = req.body;
  if (!title || !summary) { res.status(400).json({ message: "title & summary required" }); return; }

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
    if (err) { res.status(500).send(err); return; }
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
    if (err) { res.status(500).send(err); return; }
    if (!rows.length) { res.status(404).json({ message: "Not found" }); return; }
    if (rows[0].ProfessorID !== req.user.UserID) {
      res.status(403).json({ message: "Not your thesis" }); return;
    }

    const fields = [];
    const params = [];
    if (status === 'UNDER-ASSIGNMENT') {
      fields.push("StudentID = NULL");
      fields.push("AssignmentConfirmed = 0");
    }
    if (title)   { fields.push("Title = ?");       params.push(title); }
    if (summary) { fields.push("Description = ?"); params.push(summary); }
    if (status)  { fields.push("Status = ?");      params.push(status); }
    if (req.file){ fields.push("PdfPath = ?");     params.push(`/uploads/pdfs/${req.file.filename}`); }
    if (!fields.length) { res.status(400).json({ message: "Nothing to update" }); return; }
    params.push(thesisId);

    db.query(`UPDATE thesis SET ${fields.join(", ")} WHERE ThesisID = ?`, params, (err2) => {
      if (err2) { res.status(500).send(err2); return; }
      db.query(`
        SELECT ThesisID, Title, Description, Status, StartDate, EndDate, Progress,
               RepositoryLink, PdfPath, StudentID, AssignmentConfirmed, ProfessorID
        FROM thesis WHERE ThesisID = ?
      `, [thesisId], (err3, rows2) => {
        if (err3) { res.status(500).send(err3); return; }
        res.json(rows2[0]);
      });
    });
  });
});

app.delete("/professor/topics/:id", auth, requireProfessor, (req, res) => {
  const thesisId = req.params.id;

  db.query("SELECT ProfessorID, PdfPath FROM thesis WHERE ThesisID = ? LIMIT 1", [thesisId], (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    if (!rows.length) { res.status(404).json({ message: "Not found" }); return; }
    if (rows[0].ProfessorID !== req.user.UserID) { res.status(403).json({ message: "Not your thesis" }); return; }

    db.query("DELETE FROM thesis WHERE ThesisID = ? LIMIT 1", [thesisId], (err2) => {
      if (err2) { res.status(500).send(err2); return; }
      const pdfPath = rows[0].PdfPath;
      if (pdfPath) {
        const normalized = pdfPath.replace(/^\/+/, "");
        const abs = path.join(__dirname, normalized);
        fs.unlink(abs, () => {});
      }
      res.status(204).send();
    });
  });
});

// ΑΝΑΖΗΤΗΣΗ ΦΟΙΤΗΤΩΝ (AM > UserID > Όνομα) 
app.get("/students", auth, requireProfessor, (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) { res.json([]); return; }

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


// Προσωρινή ανάθεση / Ακύρωση 
app.put("/thesis/:id/assign", auth, requireProfessor, (req, res) => {
  const thesisId = Number(req.params.id);
  const { studentId } = req.body; // null => ακύρωση

  const q = `
    SELECT ThesisID, ProfessorID, Status, StudentID, AssignmentConfirmed
    FROM thesis WHERE ThesisID = ? LIMIT 1
  `;
  db.query(q, [thesisId], (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    if (!rows.length) { res.status(404).json({ message: "Θέμα δεν βρέθηκε." }); return; }

    const t = rows[0];
    if (t.ProfessorID !== req.user.UserID) {
      res.status(403).json({ message: "Δεν είστε ο επιβλέπων του θέματος." }); return;
    }

    // ΑΚΥΡΩΣΗ ΠΡΟΣΩΡΙΝΗΣ ΑΝΑΘΕΣΗΣ 
    if (studentId == null) {
      if (t.Status !== 'PROVISIONAL' || Number(t.AssignmentConfirmed) === 1) {
        res.status(409).json({ message: "Ακύρωση επιτρέπεται μόνο σε προσωρινά (PROVISIONAL) θέματα χωρίς οριστικοποίηση." });
        return;
      }
      const upd = `
        UPDATE thesis
        SET StudentID = NULL,
            Status = 'UNDER-ASSIGNMENT',
            AssignmentConfirmed = 0
        WHERE ThesisID = ?
      `;
      db.query(upd, [thesisId], (e2) => {
        if (e2) { res.status(500).send(e2); return; }
        db.query(`DELETE FROM requests WHERE ThesisID=?`, [thesisId], () => {
          res.json({ message: "Ακυρώθηκε η προσωρινή ανάθεση και διαγράφηκαν οι προσκλήσεις τριμελούς." });
        });
      });
      return;
    }

    // ΠΡΟΣΩΡΙΝΗ ΑΝΑΘΕΣΗ ΣΕ ΦΟΙΤΗΤΗ 
    if (t.Status !== 'UNDER-ASSIGNMENT' || t.StudentID != null) {
      res.status(409).json({ message: "Ανάθεση επιτρέπεται μόνο σε διαθέσιμα (UNDER-ASSIGNMENT) θέματα χωρίς φοιτητή." });
      return;
    }

    // Επαλήθευση φοιτητή
    const qStu = "SELECT UserID FROM users WHERE UserID = ? AND Role='STUDENT' LIMIT 1";
    db.query(qStu, [studentId], (errS, rS) => {
      if (errS) { res.status(500).send(errS); return; }
      if (!rS.length) { res.status(404).json({ message: "Δεν βρέθηκε φοιτητής με αυτό το ΑΜ/ID." }); return; }

      // Ο φοιτητής να μην έχει άλλη (PROVISIONAL/ACTIVE/UNDER-EXAMINATION/FINISHED)
      const qExists = `
        SELECT COUNT(*) AS cnt
        FROM thesis
        WHERE StudentID = ?
          AND ThesisID <> ?
          AND Status IN ('PROVISIONAL','ACTIVE','UNDER-EXAMINATION','FINISHED')
      `;
      db.query(qExists, [studentId, thesisId], (errE, rE) => {
        if (errE) { res.status(500).send(errE); return; }
        if ((rE[0]?.cnt || 0) > 0) {
          res.status(409).json({ message: "Ο φοιτητής έχει ήδη διπλωματική (προσωρινή ή οριστική)." }); return;
        }

        const upd = `
          UPDATE thesis
          SET StudentID = ?,
              Status = 'PROVISIONAL',
              AssignmentConfirmed = 0
          WHERE ThesisID = ?
        `;
        db.query(upd, [studentId, thesisId], (e3) => {
          if (e3) { res.status(500).send(e3); return; }
          db.query(`DELETE FROM requests WHERE ThesisID=?`, [thesisId], () => {
            res.json({ message: "Το θέμα ανατέθηκε προσωρινά (PROVISIONAL) στον φοιτητή." });
          });
        });
      });
    });
  });
});

app.get("/theses", (req, res) => {
  const statuses = (req.query.statuses || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  if (statuses.length === 0) {
    const sql = `
      SELECT t.*, u.UserName AS ProfessorName
      FROM thesis t
      LEFT JOIN users u ON t.ProfessorID = u.UserID
      ORDER BY t.ThesisID ASC
    `;
    db.query(sql, (err, rows) => {
      if (err) { res.status(500).send(err); return; }
      res.json(rows);
    });
    return;
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
    if (err) { res.status(500).send(err); return; }
    res.json(rows);
  });
});

app.get("/thesis/:id", (req, res) => {
  const thesisId = req.params.id;
  const sql = `
    SELECT t.*, u.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users u ON t.ProfessorID = u.UserID
    WHERE t.ThesisID = ?
  `;
  db.query(sql, [thesisId], (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    if (!rows.length) { res.status(404).send("Not found"); return; }
    res.json(rows[0]);
  });
});

app.get("/thesis/:id/requests", auth, requireProfessor, (req, res) => {
  const thesisId = Number(req.params.id);
  const sql = `
    SELECT
      r.ReqID, r.ProfessorID, r.ReqStatus, r.CreatedAt, r.AcceptedAt, r.RejectedAt,
      u.UserName AS ProfessorName, u.Email
    FROM requests r
    JOIN users u ON u.UserID = r.ProfessorID
    WHERE r.ThesisID = ?
    ORDER BY r.ReqID DESC
  `;
  db.query(sql, [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

app.post("/thesis/:id/protocol", (req, res) => {
  const thesisId = req.params.id;
  const { protocol } = req.body;
  if (!protocol) { res.status(400).json({ message: "Λείπει protocol" }); return; }
  const sql = `UPDATE thesis SET ProtocolNumber = ? WHERE ThesisID = ?`;
  db.query(sql, [protocol, thesisId], (err) => {
    if (err) { res.status(500).send(err); return; }
    res.json({ message: "OK" });
  });
});

// Ακύρωση ΔΕ από τον επιβλέποντα (μόνο σε ACTIVE και μόνο μετά από 2 έτη από ActiveSince)
app.put("/thesis/:id/cancel", auth, requireProfessor, (req, res) => {
  const thesisId = Number(req.params.id);
  const me = req.user.UserID;
  const { gsNumber } = req.body;

  if (!gsNumber) return res.status(400).json({ message: "Απαιτείται Αριθμός Πρωτοκόλλου ΓΣ." });

  const q = `
    SELECT ThesisID, ProfessorID, Status, ActiveSince, StartDate
    FROM thesis WHERE ThesisID=? LIMIT 1
  `;
  db.query(q, [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "Δεν βρέθηκε διπλωματική." });

    const t = rows[0];
    if (t.ProfessorID !== me) return res.status(403).json({ message: "Μόνο ο επιβλέπων μπορεί να ακυρώσει." });
    if (t.Status !== "ACTIVE") return res.status(409).json({ message: "Ακύρωση επιτρέπεται μόνο για ενεργές (ACTIVE) διπλωματικές." });

    // Υπολογισμός 2 ετών από ActiveSince 
    const baseDate = t.ActiveSince || t.StartDate;
    if (!baseDate) return res.status(409).json({ message: "Δεν υπάρχει διαθέσιμη ημερομηνία οριστικής ανάθεσης." });

    db.query(`SELECT DATEDIFF(CURDATE(), ?) AS daysDiff`, [baseDate], (e2, dRows) => {
      if (e2) return res.status(500).send(e2);
      const days = Number(dRows?.[0]?.daysDiff || 0);
      if (days < 730) return res.status(409).json({ message: "Δεν έχουν συμπληρωθεί 2 έτη από την οριστική ανάθεση." });

      const sql = `
        UPDATE thesis
        SET Status='CANCELLED',
            CancellationGSNumber=?,
            CancellationYear=YEAR(CURDATE()),
            CancellationReason='από Διδάσκοντα',
            IsCancelled=1,
            EndDate=CURDATE()
        WHERE ThesisID=?
      `;
      db.query(sql, [gsNumber, thesisId], (e3) => {
        if (e3) return res.status(500).send(e3);
        res.json({ message: "Η ΔΕ ακυρώθηκε επιτυχώς." });
      });
    });
  });
});


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
    if (err) { res.status(500).send(err); return; }
    const hasGrades = (rowsG?.[0]?.cnt || 0) > 0;

    db.query(qRepo, [thesisId], (err2, rowsR) => {
      if (err2) { res.status(500).send(err2); return; }
      const repo = rowsR?.[0]?.RepositoryLink || "";
      const hasRepositoryLink = !!repo && repo.trim() !== "" && repo.trim().toLowerCase() !== "unknown";
      res.json({ hasGrades, hasRepositoryLink, ok: hasGrades && hasRepositoryLink });
    });
  });
});

app.post("/thesis/:id/finalize", (req, res) => {
  const thesisId = req.params.id;
  const qStatus = `SELECT Status FROM thesis WHERE ThesisID = ? LIMIT 1`;
  db.query(qStatus, [thesisId], (err, rowsS) => {
    if (err) { res.status(500).send(err); return; }
    if (!rowsS.length) { res.status(404).json({ message: "Δεν βρέθηκε διπλωματική." }); return; }
    if (rowsS[0].Status !== "UNDER-EXAMINATION") {
      res.status(409).json({ message: "Περάτωση επιτρέπεται μόνο για διπλωματικές Υπό Εξέταση." }); return;
    }

    const qGrades = `
      SELECT COUNT(*) AS cnt
      FROM exam e
      JOIN grade g ON g.ExamID = e.ExamID
      WHERE e.ThesisID = ?
    `;
    const qRepo = `SELECT RepositoryLink FROM thesis WHERE ThesisID = ? LIMIT 1`;

    db.query(qGrades, [thesisId], (errG, rowsG) => {
      if (errG) { res.status(500).send(errG); return; }
      const hasGrades = (rowsG?.[0]?.cnt || 0) > 0;

      db.query(qRepo, [thesisId], (errR, rowsR) => {
        if (errR) { res.status(500).send(errR); return; }
        const repo = rowsR?.[0]?.RepositoryLink || "";
        const hasRepositoryLink = !!repo && repo.trim() !== "" && repo.trim().toLowerCase() !== "unknown";

        if (!hasGrades || !hasRepositoryLink) {
          res.status(422).json({ message: "Απαιτούνται βαθμοί και σύνδεσμος Νημερτής/αποθετηρίου." }); return;
        }

        const qUpdate = `
          UPDATE thesis
          SET Status = 'FINISHED',
              EndDate = CURDATE()
          WHERE ThesisID = ?
        `;
        db.query(qUpdate, [thesisId], (errU) => {
          if (errU) { res.status(500).send(errU); return; }
          res.json({ message: " Η διπλωματική περατώθηκε." });
        });
      });
    });
  });
});

app.post("/import-users", (req, res) => {
  const users = req.body;
  if (!Array.isArray(users)) {
    res.status(400).json({ message: "Το αρχείο δεν περιέχει έγκυρο array JSON." }); return;
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
    .then(() => res.json({ message: "Οι χρήστες καταχωρήθηκαν με επιτυχία." }))
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Σφάλμα κατά την εισαγωγή χρηστών." });
    });
});

// Λίστα/Export για καθηγητή 
app.get("/professor/theses", auth, requireProfessor, (req, res) => {
  const me = req.user.UserID;
  const role = String(req.query.role || "all").toLowerCase();
  const statuses = (req.query.statuses || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const q = String(req.query.q || "").trim();

  // SELECT με student/professor names
  let sql = `
    SELECT DISTINCT
      t.ThesisID, t.Title, t.Description, t.Status, t.StartDate, t.EndDate,
      t.Progress, t.RepositoryLink, t.PdfPath, t.ProtocolNumber,
      t.StudentID, t.ProfessorID,
      s.UserName AS StudentName, s.AM AS StudentAM,
      p.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users s ON s.UserID = t.StudentID
    LEFT JOIN users p ON p.UserID = t.ProfessorID
    LEFT JOIN requests r ON r.ThesisID = t.ThesisID AND r.ReqStatus='ACCEPTED'
    WHERE 1=1
  `;
  const params = [];

  if (role === "supervisor") {
    sql += " AND t.ProfessorID = ? ";
    params.push(me);
  } else if (role === "committee") {
    sql += " AND r.ProfessorID = ? ";
    params.push(me);
  } else {
    sql += " AND (t.ProfessorID = ? OR r.ProfessorID = ?) ";
    params.push(me, me);
  }

  if (statuses.length) {
    sql += ` AND t.Status IN (${statuses.map(() => "?").join(",")}) `;
    params.push(...statuses);
  }

  if (q) {
    sql += " AND (t.Title LIKE ? OR s.UserName LIKE ?) ";
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += " ORDER BY t.ThesisID DESC ";

  db.query(sql, params, (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    res.json(rows);
  });
});

/*
  GET /thesis/:id/full
  Επιστρέφει:
    - thesis (βασικά πεδία + student/professor names)
    - committee[]: τα μέλη της τριμελούς (από requests με ReqStatus='ACCEPTED')
    - timeline[]: ό,τι μπορούμε να συναγάγουμε από StartDate/Exam/End/Status
    - finalGrade: μέσος όρος βαθμών (αν υπάρχει)
    - latestSubmission: τελευταίο submission (αν υπάρχει)
*/
app.get("/thesis/:id/full", auth, requireProfessor, (req, res) => {
  const id = Number(req.params.id);

  const qThesis = `
    SELECT t.*,
           s.UserName AS StudentName, s.AM AS StudentAM,
           p.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users s ON s.UserID = t.StudentID
    LEFT JOIN users p ON p.UserID = t.ProfessorID
    WHERE t.ThesisID = ?
  `;
  db.query(qThesis, [id], (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    if (!rows.length) { res.status(404).json({ message: "Not found" }); return; }
    const t = rows[0];

    const qCommittee = `
      SELECT u.UserID, u.UserName, u.Email
      FROM requests r
      JOIN users u ON u.UserID = r.ProfessorID
      WHERE r.ThesisID = ? AND r.ReqStatus='ACCEPTED'
      ORDER BY u.UserName
    `;
    db.query(qCommittee, [id], (e2, committee) => {
      if (e2) { res.status(500).send(e2); return; }

      const qExam = `
        SELECT ExamDate
        FROM exam
        WHERE ThesisID = ?
        ORDER BY ExamDate ASC
      `;
      db.query(qExam, [id], (e3, exams) => {
        if (e3) { res.status(500).send(e3); return; }

        const qGrade = `
          SELECT AVG(g.Grade) AS FinalGrade
          FROM grade g
          JOIN exam e ON e.ExamID = g.ExamID
          WHERE e.ThesisID = ?
        `;
        db.query(qGrade, [id], (e4, gRes) => {
          if (e4) { res.status(500).send(e4); return; }
          const finalGrade = gRes?.[0]?.FinalGrade ?? null;

        const qSub = `
            SELECT *
            FROM submissions
            WHERE ThesisID = ?
            ORDER BY DateUploaded DESC
            LIMIT 1
          `;
          db.query(qSub, [id], (e5, subs) => {
            if (e5) { res.status(500).send(e5); return; }
            const latestSubmission = subs?.[0] || null;

            const timeline = [];
            if (t.StartDate) timeline.push({ date: t.StartDate, label: "Δημιουργία/Έναρξη" });
            if (t.Status === "UNDER-EXAMINATION" || t.Status === "FINISHED") {
              if (exams?.length) {
                timeline.push({ date: exams[0].ExamDate, label: "Ορίστηκε/έγινε εξέταση" });
              } else {
                timeline.push({ date: null, label: "Υπό εξέταση (ημ/νία άγνωστη)" });
              }
            }
            if (t.EndDate && (t.Status === "FINISHED" || t.Status === "CANCELLED")) {
              timeline.push({
                date: t.EndDate,
                label: t.Status === "FINISHED" ? "Περάτωση" : "Ακύρωση"
              });
            }
            timeline.push({ date: null, label: `Τρέχουσα κατάσταση: ${t.Status}` });

            res.json({ thesis: t, committee, timeline, finalGrade, latestSubmission });
          });
        });
      });
    });
  });
});

/*
  GET /professor/theses/export
    role=all|supervisor|committee
    statuses=...
    q=...
    format=csv|json   (default: json)
*/
app.get("/professor/theses/export", auth, requireProfessor, (req, res) => {
  const role = String(req.query.role || "all").toLowerCase();
  const statuses = (req.query.statuses || "");
  const q = String(req.query.q || "").trim();

  const me = req.user.UserID;

  let sql = `
    SELECT DISTINCT
      t.ThesisID, t.Title, t.Status, t.StartDate, t.EndDate,
      t.Progress, t.RepositoryLink,
      s.UserName AS StudentName, s.AM AS StudentAM,
      p.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users s ON s.UserID = t.StudentID
    LEFT JOIN users p ON p.UserID = t.ProfessorID
    LEFT JOIN requests r ON r.ThesisID = t.ThesisID AND r.ReqStatus='ACCEPTED'
    WHERE 1=1
  `;
  const params = [];
  if (role === "supervisor") {
    sql += " AND t.ProfessorID = ? ";
    params.push(me);
  } else if (role === "committee") {
    sql += " AND r.ProfessorID = ? ";
    params.push(me);
  } else {
    sql += " AND (t.ProfessorID = ? OR r.ProfessorID = ?) ";
    params.push(me, me);
  }

  const statusList = statuses.split(",").map(s => s.trim()).filter(Boolean);
  if (statusList.length) {
    sql += ` AND t.Status IN (${statusList.map(() => "?").join(",")}) `;
    params.push(...statusList);
  }
  if (q) {
    sql += " AND (t.Title LIKE ? OR s.UserName LIKE ?) ";
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY t.ThesisID DESC ";

  db.query(sql, params, (err, rows) => {
    if (err) { res.status(500).send(err); return; }

    const format = String(req.query.format || "json").toLowerCase();
    if (format === "csv") {
      const headers = [
        "ThesisID","Title","Status","StartDate","EndDate","Progress",
        "StudentName","StudentAM","ProfessorName","RepositoryLink"
      ];
      const lines = [headers.join(",")];
      rows.forEach(r => {
        const vals = [
          r.ThesisID,
          (r.Title || "").replaceAll('"','""'),
          r.Status,
          r.StartDate || "",
          r.EndDate || "",
          r.Progress ?? "",
          (r.StudentName || "").replaceAll('"','""'),
          r.StudentAM || "",
          (r.ProfessorName || "").replaceAll('"','""'),
          (r.RepositoryLink || "").replaceAll('"','""')
        ].map(v => typeof v === "string" ? `"${v}"` : v);
        lines.push(vals.join(","));
      });
      const csv = lines.join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"theses.csv\"");
      res.send(csv);
    } else {
      res.json(rows);
    }
  });
});

// Προσκλήσεις Τριμελούς για Διδάσκοντες 

// Λίστα ενεργών προσκλήσεων για τον συνδεδεμένο καθηγητή
app.get("/professor/invitations", auth, requireProfessor, (req, res) => {
  const me = req.user.UserID;
  const sql = `
    SELECT 
      r.ReqID,
      r.ThesisID,
      r.ReqStatus,
      t.Title,
      t.Status AS ThesisStatus,
      t.StartDate, t.EndDate,
      s.UserName AS StudentName, s.AM AS StudentAM,
      p.UserName AS SupervisorName
    FROM requests r
    JOIN thesis t ON t.ThesisID = r.ThesisID
    LEFT JOIN users s ON s.UserID = t.StudentID
    LEFT JOIN users p ON p.UserID = t.ProfessorID
    WHERE r.ProfessorID = ? AND r.ReqStatus = 'QUEUED'
    ORDER BY r.ReqID DESC
  `;
  db.query(sql, [me], (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    res.json(rows);
  });
});

// ΑΠΟΔΟΧΗ πρόσκλησης & προαγωγή σε ACTIVE
app.put("/requests/:id/accept", auth, requireProfessor, (req, res) => {
  const id = Number(req.params.id);
  const me = req.user.UserID;

  const qReq = `SELECT ReqID, ProfessorID, ReqStatus, ThesisID FROM requests WHERE ReqID=? LIMIT 1`;
  db.query(qReq, [id], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "Η πρόσκληση δεν βρέθηκε." });

    const r = rows[0];
    if (r.ProfessorID !== me) return res.status(403).json({ message: "Δεν είναι δική σας πρόσκληση." });
    if (r.ReqStatus !== 'QUEUED') return res.status(409).json({ message: "Η πρόσκληση δεν είναι πλέον ενεργή." });

    db.query(`UPDATE requests SET ReqStatus='ACCEPTED', AcceptedAt=NOW() WHERE ReqID=?`, [id], (e1) => {
      if (e1) return res.status(500).send(e1);

      db.query(`SELECT COUNT(*) AS cnt FROM requests WHERE ThesisID=? AND ReqStatus='ACCEPTED'`, [r.ThesisID], (e2, cRows) => {
        if (e2) return res.status(500).send(e2);
        const accepted = Number(cRows?.[0]?.cnt || 0);

        if (accepted >= 2) {
          // Πλέον ACTIVE (όχι UNDER-EXAMINATION) 
          const up = `UPDATE thesis SET Status='ACTIVE', ActiveSince=IFNULL(ActiveSince, CURDATE()) WHERE ThesisID=? AND Status='PROVISIONAL'`;
          db.query(up, [r.ThesisID], () => {
            // κλείσε ό,τι QUEUED έμεινε
            db.query(
              `UPDATE requests SET ReqStatus='REJECTED', RejectedAt=NOW() WHERE ThesisID=? AND ReqStatus='QUEUED'`,
              [r.ThesisID],
              () => res.json({ message: "Αποδοχή. Συμπληρώθηκε η τριμελής και η ΔΕ πέρασε σε ACTIVE." })
            );
          });
        } else {
          res.json({ message: "Η πρόσκληση έγινε αποδεκτή." });
        }
      });
    });
  });
});


// ΑΠΟΡΡΙΨΗ πρόσκλησης 
app.put("/requests/:id/reject", auth, requireProfessor, (req, res) => {
  const id = Number(req.params.id);
  const me = req.user.UserID;

  const q = `SELECT ReqID, ProfessorID, ReqStatus FROM requests WHERE ReqID=? LIMIT 1`;
  db.query(q, [id], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "Η πρόσκληση δεν βρέθηκε." });

    const r = rows[0];
    if (r.ProfessorID !== me) return res.status(403).json({ message: "Δεν είναι δική σας πρόσκληση." });
    if (r.ReqStatus !== 'QUEUED') return res.status(409).json({ message: "Η πρόσκληση δεν είναι πλέον ενεργή." });

    db.query(`UPDATE requests SET ReqStatus='REJECTED', RejectedAt=NOW() WHERE ReqID=?`, [id], (e2) => {
      if (e2) return res.status(500).send(e2);
      res.json({ message: "Η πρόσκληση απορρίφθηκε." });
    });
  });
});

// Αποστολή πρόσκλησης σε καθηγητή για τριμελή (μόνο ο επιβλέπων)
app.post("/thesis/:id/invite", auth, requireProfessor, (req, res) => {
  const thesisId = Number(req.params.id);
  const toProfessorId = Number(req.body.professorId);
  const me = req.user.UserID;

  if (!toProfessorId) { res.status(400).json({ message: "Λείπει professorId." }); return; }
  if (toProfessorId === me) { res.status(400).json({ message: "Δεν μπορείτε να προσκαλέσετε τον εαυτό σας." }); return; }

  const qThesis = `SELECT ThesisID, ProfessorID, Status FROM thesis WHERE ThesisID=? LIMIT 1`;
  db.query(qThesis, [thesisId], (err, tRows) => {
    if (err) { res.status(500).send(err); return; }
    if (!tRows.length) { res.status(404).json({ message: "Δεν βρέθηκε διπλωματική." }); return; }
    const t = tRows[0];

    if (t.ProfessorID !== me) { res.status(403).json({ message: "Μόνο ο επιβλέπων μπορεί να στείλει προσκλήσεις." }); return; }
    if (t.Status !== 'PROVISIONAL') { res.status(409).json({ message: "Προσκλήσεις επιτρέπονται μόνο όταν η ΔΕ είναι PROVISIONAL." }); return; }

    const qAccepted = `SELECT COUNT(*) AS cnt FROM requests WHERE ThesisID=? AND ReqStatus='ACCEPTED'`;
    db.query(qAccepted, [thesisId], (e2, aRows) => {
      if (e2) { res.status(500).send(e2); return; }
      if (Number(aRows?.[0]?.cnt || 0) >= 2) {
        res.status(409).json({ message: "Η τριμελής είναι ήδη πλήρης (2 αποδοχές)." }); return;
      }

      db.query(`SELECT UserID FROM users WHERE UserID=? AND Role='PROFESSOR' LIMIT 1`, [toProfessorId], (e3, pRows) => {
        if (e3) { res.status(500).send(e3); return; }
        if (!pRows.length) { res.status(404).json({ message: "Ο παραλήπτης δεν είναι έγκυρος Καθηγητής." }); return; }

        const qExists = `
          SELECT ReqID, ReqStatus FROM requests
          WHERE ThesisID=? AND ProfessorID=? LIMIT 1
        `;
        db.query(qExists, [thesisId, toProfessorId], (e4, exRows) => {
          if (e4) { res.status(500).send(e4); return; }

          if (!exRows.length) {
            db.query(
              `INSERT INTO requests (ThesisID, ProfessorID, ReqStatus, CreatedAt) VALUES (?, ?, 'QUEUED', NOW())`,
              [thesisId, toProfessorId],
              (e5) => {
                if (e5) { res.status(500).send(e5); return; }
                res.status(201).json({ message: "Η πρόσκληση στάλθηκε." });
              }
            );
            return;
          }

          const ex = exRows[0];
          if (ex.ReqStatus === 'REJECTED') {
            db.query(
              `UPDATE requests SET ReqStatus='QUEUED', CreatedAt=NOW(), AcceptedAt=NULL, RejectedAt=NULL WHERE ReqID=?`,
              [ex.ReqID],
              (e6) => {
                if (e6) { res.status(500).send(e6); return; }
                res.json({ message: "Η πρόσκληση επαναστάλθηκε." });
              }
            );
          } else {
            res.status(409).json({ message: "Υπάρχει ήδη ενεργή πρόσκληση ή έχει γίνει αποδοχή." });
          }
        });
      });
    });
  });
});

// Λίστα PROVISIONAL διπλωματικών του τρέχοντος καθηγητή για αποστολή προσκλήσεων
app.get("/professor/provisional-theses", auth, requireProfessor, (req, res) => {
  const me = req.user.UserID;
  const sql = `
    SELECT t.ThesisID, t.Title, t.Status, t.StartDate, t.EndDate,
           t.StudentID, s.UserName AS StudentName, s.AM AS StudentAM
    FROM thesis t
    LEFT JOIN users s ON s.UserID = t.StudentID
    WHERE t.ProfessorID = ? AND t.Status = 'PROVISIONAL'
    ORDER BY t.ThesisID DESC
  `;
  db.query(sql, [me], (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    res.json(rows);
  });
});

// Λίστα καθηγητών 
app.get("/professors", auth, (req, res) => {
  const q = String(req.query.q || "").trim();
  const excludeMe = String(req.query.excludeMe || "") === "1";
  const excludeThesisId = Number(req.query.excludeThesisId || 0) || null;

  let sql = `
    SELECT u.UserID, u.UserName, u.Email
    FROM users u
    WHERE u.Role='PROFESSOR'
  `;
  const params = [];

  if (excludeMe) {
    sql += " AND u.UserID <> ? ";
    params.push(req.user.UserID);
  }
  if (q) {
    sql += " AND u.UserName LIKE ? ";
    params.push(`%${q}%`);
  }
  if (excludeThesisId) {
    sql += `
      AND u.UserID NOT IN (
        SELECT r.ProfessorID
        FROM requests r
        WHERE r.ThesisID = ? AND r.ReqStatus IN ('QUEUED','ACCEPTED')
      )
    `;
    params.push(excludeThesisId);
  }

  sql += " ORDER BY u.UserName ASC ";

  db.query(sql, params, (err, rows) => {
    if (err) { res.status(500).send(err); return; }
    res.json(rows);
  });
});

app.get("/professor/stats", auth, requireProfessor, async (req, res) => {
  const me = req.user.UserID;
  const p = (sql, params=[]) => new Promise((resolve, reject) =>
    db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
  );

  try {
    const qSupTotal = `SELECT COUNT(*) AS cnt FROM thesis WHERE ProfessorID=?`;
    const qComTotal = `
      SELECT COUNT(DISTINCT t.ThesisID) AS cnt
      FROM thesis t
      JOIN requests r ON r.ThesisID=t.ThesisID AND r.ReqStatus='ACCEPTED'
      WHERE r.ProfessorID=?
    `;
    const qSupAvgDays = `
      SELECT AVG(DATEDIFF(t.EndDate, t.StartDate)) AS avgDays
      FROM thesis t
      WHERE t.ProfessorID=? AND t.Status='FINISHED'
    `;
    const qComAvgDays = `
      SELECT AVG(DATEDIFF(t.EndDate, t.StartDate)) AS avgDays
      FROM thesis t
      JOIN requests r ON r.ThesisID=t.ThesisID AND r.ReqStatus='ACCEPTED'
      WHERE r.ProfessorID=? AND t.Status='FINISHED'
    `;
    const qSupMeanGrade = `
      SELECT AVG(x.thesis_avg) AS meanFinalGrade
      FROM (
        SELECT e.ThesisID, AVG(g.Grade) AS thesis_avg
        FROM exam e
        JOIN grade g ON g.ExamID = e.ExamID
        JOIN thesis t ON t.ThesisID = e.ThesisID
        WHERE t.ProfessorID = ? AND t.Status='FINISHED'
        GROUP BY e.ThesisID
      ) x
    `;
    const qComMeanGrade = `
      SELECT AVG(x.thesis_avg) AS meanFinalGrade
      FROM (
        SELECT e.ThesisID, AVG(g.Grade) AS thesis_avg
        FROM exam e
        JOIN grade g ON g.ExamID = e.ExamID
        JOIN thesis t ON t.ThesisID = e.ThesisID
        JOIN requests r ON r.ThesisID = t.ThesisID AND r.ReqStatus='ACCEPTED'
        WHERE r.ProfessorID = ? AND t.Status='FINISHED'
        GROUP BY e.ThesisID
      ) x
    `;

    const [
      supTotal, comTotal,
      supAvgDays, comAvgDays,
      supMeanGrade, comMeanGrade
    ] = await Promise.all([
      p(qSupTotal, [me]),
      p(qComTotal, [me]),
      p(qSupAvgDays, [me]),
      p(qComAvgDays, [me]),
      p(qSupMeanGrade, [me]),
      p(qComMeanGrade, [me]),
    ]);

    const safeNum = (v, d=0) => (v==null || Number.isNaN(Number(v)) ? d : Number(v));

    const out = {
      supervisor: {
        total: safeNum(supTotal[0]?.cnt),
        meanCompletionDays: safeNum(supAvgDays[0]?.avgDays, 0),
        meanGrade: safeNum(supMeanGrade[0]?.meanFinalGrade, 0),
      },
      committee: {
        total: safeNum(comTotal[0]?.cnt),
        meanCompletionDays: safeNum(comAvgDays[0]?.avgDays, 0),
        meanGrade: safeNum(comMeanGrade[0]?.meanFinalGrade, 0),
      }
    };

    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Σφάλμα υπολογισμού στατιστικών." });
  }
});

// ACTIVE -> UNDER-EXAMINATION (μόνο ο επιβλέπων)
app.put("/thesis/:id/mark-under-examination", auth, requireProfessor, (req, res) => {
  const thesisId = Number(req.params.id);
  const me = req.user.UserID;

  const q = `SELECT ThesisID, ProfessorID, Status FROM thesis WHERE ThesisID=? LIMIT 1`;
  db.query(q, [thesisId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "Δεν βρέθηκε διπλωματική." });

    const t = rows[0];
    if (t.ProfessorID !== me) return res.status(403).json({ message: "Μόνο ο επιβλέπων μπορεί να αλλάξει την κατάσταση." });
    if (t.Status !== 'ACTIVE') return res.status(409).json({ message: "Η μετάβαση επιτρέπεται μόνο από ACTIVE σε UNDER-EXAMINATION." });

    db.query(`UPDATE thesis SET Status='UNDER-EXAMINATION' WHERE ThesisID=?`, [thesisId], (e2) => {
      if (e2) return res.status(500).send(e2);
      res.json({ message: "Η διπλωματική πέρασε σε UNDER-EXAMINATION." });
    });
  });
});

// Οι σημειώσεις ΜΟΝΟ του συνδεδεμένου διδάσκοντα για τη συγκεκριμένη ΔΕ
app.get("/thesis/:id/notes", auth, requireProfessor, (req, res) => {
  const thesisId = Number(req.params.id);
  const me = req.user.UserID;

  // Επιτρέπεται σε επιβλέποντα ή σε μέλος τριμελούς (ACCEPTED) και μόνο αν είναι ACTIVE
  const qAuth = `
    SELECT t.ThesisID
    FROM thesis t
    LEFT JOIN requests r ON r.ThesisID=t.ThesisID AND r.ProfessorID=? AND r.ReqStatus='ACCEPTED'
    WHERE t.ThesisID=? AND t.Status='ACTIVE' AND (t.ProfessorID=? OR r.ReqID IS NOT NULL)
    LIMIT 1
  `;
  db.query(qAuth, [me, thesisId, me], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(403).json({ message: "Δεν έχετε πρόσβαση ή η ΔΕ δεν είναι ACTIVE." });

    const qNotes = `
      SELECT NoteID, Body, CreatedAt
      FROM thesis_notes
      WHERE ThesisID=? AND ProfessorID=?
      ORDER BY NoteID DESC
    `;
    db.query(qNotes, [thesisId, me], (e2, notes) => {
      if (e2) return res.status(500).send(e2);
      res.json(notes);
    });
  });
});

// Καταχώριση νέας σημείωσης 
app.post("/thesis/:id/notes", auth, requireProfessor, (req, res) => {
  const thesisId = Number(req.params.id);
  const me = req.user.UserID;
  const text = String(req.body.text || "").trim();

  if (!text) return res.status(400).json({ message: "Κείμενο σημείωσης απαιτείται." });
  if (text.length > 300) return res.status(413).json({ message: "Μέγιστο μήκος 300 χαρακτήρες." });

  const qAuth = `
    SELECT t.ThesisID
    FROM thesis t
    LEFT JOIN requests r ON r.ThesisID=t.ThesisID AND r.ProfessorID=? AND r.ReqStatus='ACCEPTED'
    WHERE t.ThesisID=? AND t.Status='ACTIVE' AND (t.ProfessorID=? OR r.ReqID IS NOT NULL)
    LIMIT 1
  `;
  db.query(qAuth, [me, thesisId, me], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(403).json({ message: "Δεν έχετε πρόσβαση ή η ΔΕ δεν είναι ACTIVE." });

    db.query(
      `INSERT INTO thesis_notes (ThesisID, ProfessorID, Body) VALUES (?, ?, ?)`,
      [thesisId, me, text],
      (e2, result) => {
        if (e2) return res.status(500).send(e2);
        res.status(201).json({ NoteID: result.insertId, Body: text, CreatedAt: new Date().toISOString().slice(0,19).replace('T',' ') });
      }
    );
  });
});

// STUDENT ENDPOINTS 
// Λίστα διπλωματικών του φοιτητή
app.get("/thesis/student/:id", (req, res) => {
  const studentId = Number(req.params.id);
  const sql = `
    SELECT t.ThesisID, t.Title, t.Description, t.Status, t.StartDate, t.EndDate,
           t.Progress, t.RepositoryLink, t.PdfPath,
           p.UserName AS ProfessorName
    FROM thesis t
    LEFT JOIN users p ON p.UserID = t.ProfessorID
    WHERE t.StudentID = ?
    ORDER BY t.ThesisID DESC
  `;
  db.query(sql, [studentId], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// Βασικά στοιχεία χρήστη 
app.get("/user/:id", (req, res) => {
  const userId = Number(req.params.id);
  const sql = `
    SELECT UserID, UserName, Adress, Phone, Email, Role, AM
    FROM users
    WHERE UserID = ?
    LIMIT 1
  `;
  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  });
});

// Πάρε υπάρχουσα εξέταση για ThesisID ή δημιούργησε μία
function getOrCreateExam(thesisId, { examDate, method, location }, cb) {
  db.query(`SELECT * FROM exam WHERE ThesisID=? LIMIT 1`, [thesisId], (e1, rows) => {
    if (e1) return cb(e1);
    if (rows.length) return cb(null, rows[0]);

    // Αν δεν υπάρχει φτιάξε μία 
    const dateToUse = examDate || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const methodToUse = method || 'IN-PERSON';
    const locToUse = location || 'unknown';
    const ins = `
      INSERT INTO exam (ThesisID, ExamDate, ExamMethod, Location, ExamGrade)
      VALUES (?, ?, ?, ?, NULL)
    `;
    db.query(ins, [thesisId, dateToUse, methodToUse, locToUse], (e2, r) => {
      if (e2) return cb(e2);
      db.query(`SELECT * FROM exam WHERE ExamID=?`, [r.insertId], (e3, r2) => {
        if (e3) return cb(e3);
        cb(null, r2[0]);
      });
    });
  });
}

// Καταχώριση στοιχείων "Υπό Εξέταση" από φοιτητή
app.post("/examination", (req, res) => {
  const {
    ThesisID,
    FileURL,     
    LinkURL,
    ExamDate,    
    ExamMethod,  
    Location
  } = req.body;

  const thesisId = Number(ThesisID);
  if (!thesisId) return res.status(400).json({ message: "Λείπει ThesisID" });
  if (!ExamDate || !ExamMethod || !Location) {
    return res.status(400).json({ message: "ExamDate, ExamMethod και Location είναι υποχρεωτικά." });
  }

  // 1) Submission (πρόχειρο κείμενο/σύνδεσμος)
  const insSub = `
    INSERT INTO submissions (ThesisID, FileURL, LinkURL, DateUploaded)
    VALUES (?, ?, ?, NOW())
  `;
  db.query(insSub, [thesisId, FileURL || 'unknown', LinkURL || 'unknown'], (e1) => {
    if (e1) return res.status(500).send(e1);

    // 2) Exam 
    getOrCreateExam(
      thesisId,
      { examDate: ExamDate.slice(0,10), method: ExamMethod, location: Location },
      (e2, examRow) => {
        if (e2) return res.status(500).send(e2);

        db.query(
          `UPDATE exam SET ExamDate=?, ExamMethod=?, Location=? WHERE ExamID=?`,
          [ExamDate.slice(0,10), ExamMethod, Location, examRow.ExamID],
          (e3) => {
            if (e3) return res.status(500).send(e3);
            return res.json({ message: "OK" });
          }
        );
      }
    );
  });
});

// Ενημέρωση προφίλ χρήστη (διεύθυνση, email, τηλέφωνο)
app.put("/user/:id", (req, res) => {
  const userId = Number(req.params.id);
  let { Adress = "unknown", Email = "", Phone = null } = req.body;

  Adress = String(Adress || "unknown").trim();
  Email  = String(Email || "").trim();
  Phone  = Phone != null ? String(Phone).trim() : null;

  if (!Email) {
    return res.status(400).json({ message: "Το email είναι υποχρεωτικό." });
  }

  const sql = `
    UPDATE users
    SET Adress = ?, Email = ?, Phone = ?
    WHERE UserID = ?
    LIMIT 1
  `;
  db.query(sql, [Adress, Email, Phone, userId], (err) => {
    if (err) {
      // μοναδικότητα email
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Το email χρησιμοποιείται ήδη από άλλον χρήστη." });
      }
      return res.status(500).json({ message: "Σφάλμα βάσης.", detail: err });
    }

    // επιστρέφουμε τα ενημερωμένα στοιχεία ως JSON
    db.query(
      `SELECT UserID, UserName, Role, Adress, Phone, Email, AM
       FROM users WHERE UserID = ? LIMIT 1`,
      [userId],
      (e2, rows) => {
        if (e2) return res.status(500).json({ message: "Σφάλμα ανάγνωσης." });
        if (!rows.length) return res.status(404).json({ message: "Ο χρήστης δεν βρέθηκε." });
        res.json(rows[0]);
      }
    );
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});