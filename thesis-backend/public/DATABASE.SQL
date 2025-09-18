DATABASE IN SQL


DROP DATABASE IF EXISTS thesisdetails;
CREATE DATABASE thesisdetails CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE thesisdetails;

CREATE TABLE users (
  UserID   INT NOT NULL AUTO_INCREMENT,
  Password VARCHAR(255) NOT NULL DEFAULT 'unknown',
  UserName VARCHAR(100) NOT NULL DEFAULT 'unknown',
  Role     ENUM('STUDENT','PROFESSOR','SECRETARY') NOT NULL,
  Adress   VARCHAR(150) NOT NULL DEFAULT 'unknown',
  Phone    VARCHAR(20) NULL,
  Email    VARCHAR(100) NOT NULL,
  AM       VARCHAR(20) NULL,
  PRIMARY KEY (UserID),
  UNIQUE KEY uq_users_email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_users_role_name ON users (Role, UserName);
CREATE INDEX idx_users_role_am   ON users (Role, AM);

CREATE TABLE thesis (
  ThesisID              INT NOT NULL AUTO_INCREMENT,
  Title                 VARCHAR(200) NOT NULL DEFAULT 'unknown',
  Description           TEXT NOT NULL,
  StudentID             INT NULL,
  ProfessorID           INT NULL,
  Status                ENUM('UNDER-ASSIGNMENT','PROVISIONAL','ACTIVE','UNDER-EXAMINATION','FINISHED','CANCELLED') NOT NULL,
  StartDate             DATE NOT NULL,
  ActiveSince           DATE NULL,
  EndDate               DATE NOT NULL,
  Progress              INT DEFAULT 0,
  RepositoryLink        VARCHAR(255) NOT NULL DEFAULT 'unknown',
  PdfPath               VARCHAR(255) NULL,
  ProtocolNumber        VARCHAR(50) NULL,
  CancellationGSNumber  VARCHAR(50) NULL,
  CancellationYear      INT NULL,
  CancellationReason    TEXT NULL,
  IsCancelled           TINYINT(1) NOT NULL DEFAULT 0,
  AssignmentConfirmed   TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (ThesisID),
  CONSTRAINT FK_THESIS_STUDENT  FOREIGN KEY (StudentID)  REFERENCES users(UserID) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_THESIS_PROF     FOREIGN KEY (ProfessorID) REFERENCES users(UserID) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_thesis_status      ON thesis (Status);
CREATE INDEX idx_thesis_professor   ON thesis (ProfessorID);
CREATE INDEX idx_thesis_student     ON thesis (StudentID);
CREATE INDEX idx_thesis_prof_status ON thesis (ProfessorID, Status);

CREATE TABLE requests (
  ReqID       INT NOT NULL AUTO_INCREMENT,
  ThesisID    INT NOT NULL,
  ProfessorID INT NOT NULL,
  ReqStatus   ENUM('QUEUED','ACCEPTED','REJECTED') NOT NULL,
  CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  AcceptedAt  DATETIME NULL,
  RejectedAt  DATETIME NULL,
  PRIMARY KEY (ReqID),
  CONSTRAINT FK_REQ_THESIS  FOREIGN KEY (ThesisID)    REFERENCES thesis(ThesisID) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_REQ_PROF    FOREIGN KEY (ProfessorID) REFERENCES users(UserID)    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_requests_thesis       ON requests (ThesisID);
CREATE INDEX idx_requests_prof         ON requests (ProfessorID);
CREATE INDEX idx_requests_prof_status  ON requests (ProfessorID, ReqStatus);

CREATE TABLE submissions (
  SubID        INT NOT NULL AUTO_INCREMENT,
  ThesisID     INT NOT NULL,
  FileURL      VARCHAR(255) NOT NULL DEFAULT 'unknown',
  LinkURL      VARCHAR(255) NOT NULL DEFAULT 'unknown',
  DateUploaded DATETIME NOT NULL,
  PRIMARY KEY (SubID),
  CONSTRAINT FK_SUB_THESIS FOREIGN KEY (ThesisID) REFERENCES thesis(ThesisID) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE exam (
  ExamID      INT NOT NULL AUTO_INCREMENT,
  ThesisID    INT NOT NULL,
  ExamDate    DATE NOT NULL,
  ExamMethod  ENUM('IN-PERSON','ONLINE') NOT NULL,
  Location    VARCHAR(250) NOT NULL DEFAULT 'unknown',
  ExamGrade   DECIMAL(4,2) NULL,
  GradingOpen TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (ExamID),
  CONSTRAINT FK_EXAM_THESIS FOREIGN KEY (ThesisID) REFERENCES thesis(ThesisID) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uq_exam_thesis (ThesisID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE grade (
  GradeID            INT NOT NULL AUTO_INCREMENT,
  ExamID             INT NOT NULL,
  ProfessorID        INT NOT NULL,
  ScoreWorkQuality   DECIMAL(4,2) NOT NULL,  -- 0..10 (60%)
  ScoreDuration      DECIMAL(4,2) NOT NULL,  -- 0..10 (15%)
  ScoreTextQuality   DECIMAL(4,2) NOT NULL,  -- 0..10 (15%)
  ScorePresentation  DECIMAL(4,2) NOT NULL,  -- 0..10 (10%)
  Grade              DECIMAL(4,2) NULL,      
  CreatedAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (GradeID),
  UNIQUE KEY uq_exam_prof (ExamID, ProfessorID),
  INDEX idx_grade_exam (ExamID),
  CONSTRAINT FK_GRADE_EXAM  FOREIGN KEY (ExamID)      REFERENCES exam(ExamID)   ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_GRADE_PROF  FOREIGN KEY (ProfessorID) REFERENCES users(UserID)  ON UPDATE CASCADE ON DELETE CASCADE,
  CHECK (ScoreWorkQuality BETWEEN 0 AND 10),
  CHECK (ScoreDuration     BETWEEN 0 AND 10),
  CHECK (ScoreTextQuality  BETWEEN 0 AND 10),
  CHECK (ScorePresentation BETWEEN 0 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE announcements (
  AnnouncementID   INT NOT NULL AUTO_INCREMENT,
  ThesisID         INT NOT NULL,
  PresentationDate DATE NOT NULL,
  Description      TEXT NOT NULL,
  PRIMARY KEY (AnnouncementID),
  CONSTRAINT FK_ANN_THESIS FOREIGN KEY (ThesisID) REFERENCES thesis(ThesisID) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE thesis_notes (
  NoteID      INT NOT NULL AUTO_INCREMENT,
  ThesisID    INT NOT NULL,
  ProfessorID INT NOT NULL,
  Body        VARCHAR(300) NOT NULL,
  CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (NoteID),
  CONSTRAINT FK_TN_THESIS    FOREIGN KEY (ThesisID)    REFERENCES thesis(ThesisID) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT FK_TN_PROFESSOR FOREIGN KEY (ProfessorID) REFERENCES users(UserID)    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_tn_owner (ProfessorID, ThesisID, CreatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Professors
INSERT INTO users (UserID, Password, UserName, Role, Adress, Phone, Email, AM) VALUES
(2001,'2002','Stef','PROFESSOR','Yfestou 4',NULL,'Stef@ceid.com',NULL),
(3001,'3001','John','PROFESSOR','Yfestou 1',NULL,'John@ceid.com',NULL),
(3002,'3002','Mike','PROFESSOR','Spiti Tou',NULL,'Mike@ceid.com',NULL),
(3003,'3003','Chris','PROFESSOR','Ritsou 2',NULL,'Chris@ceid.com',NULL),
(3004,'3004','Stefania','PROFESSOR','Seferi 1',NULL,'Stefania@ceid.com',NULL),
(3005,'3005','Stefos','PROFESSOR','Eliti 5',NULL,'Stefos@ceid.com',NULL),
(3006,'3006','Jim','PROFESSOR','Pouthena 5',NULL,'Jim@ceid.com',NULL);

-- Students
INSERT INTO users (UserID, Password, UserName, Role, Adress, Phone, Email, AM) VALUES
(1001,'2004','Dim','STUDENT','Riga Fereou 45',NULL,'Dim@gmail.com','1001'),
(1002,'2005','George','STUDENT','Epameinonda 2','6900000001','George@gmail.com','1002'),
(1003,'2009','Maria','STUDENT','AG Andreou 3','6900000004','maria@gmail.com','1009'),
(1004,'2010','Nikos','STUDENT','Gounari 15','6900000005','nikos@gmail.com','1010'),
(1005,'2011','Eleni','STUDENT','Maniati 20','6900000006','eleni@gmail.com','1011'),
(1006,'2006','Anjela','STUDENT','Notara 56','6900000002','Anjela@gmail.com','1006'),
(1007,'2007','Marios','STUDENT','Riga Fereou 4',NULL,'Marios@gmail.com','1007'),
(1008,'2008','Paul','STUDENT','Australias 12','6900000003','Paul@gmail.com','1008'),
(1009,'2012','Petros','STUDENT','Othonos 25','6900000007','petros@gmail.com','1012'),
(1010,'2013','Anna','STUDENT','Panepistimiou 40','6900000008','anna@gmail.com','1013'),
(1011,'2014','Pete','STUDENT','Othonos 2','6910000007','pete@gmail.com','1014');

-- Secretary
INSERT INTO users (UserID, Password, UserName, Role, Adress, Phone, Email, AM) VALUES
(9001,'1234','Sec','SECRETARY','Admin Office',NULL,'secretary@uni.gr',NULL);

-- Theses
INSERT INTO thesis
  (ThesisID, Title, Description, StudentID, ProfessorID, Status, StartDate, ActiveSince, EndDate, Progress, RepositoryLink, PdfPath, ProtocolNumber, CancellationGSNumber, CancellationYear, CancellationReason, IsCancelled, AssignmentConfirmed)
VALUES
  (1,'First title','Demo active',        1008,2001,'ACTIVE',            '2025-06-20','2025-06-20','2026-05-20',40,'unknown',NULL,NULL,NULL,NULL,NULL,0,1),
  (2,'Second title','No student yet',    NULL,2001,'UNDER-ASSIGNMENT',  '2025-05-25',NULL,'2026-06-15',10,'unknown',NULL,NULL,NULL,NULL,NULL,0,0),
  (3,'Third title','Under examination',  1001,2001,'UNDER-EXAMINATION', '2025-03-22','2025-03-22','2026-01-10',98,'unknown',NULL,NULL,NULL,NULL,NULL,0,1),
  (4,'Provisional sample','Needs 2 acc', 1007,2001,'PROVISIONAL',       '2025-04-10',NULL,'2026-04-09',50,'unknown',NULL,NULL,NULL,NULL,NULL,0,0);

-- Requests for #4
INSERT INTO requests (ReqID, ThesisID, ProfessorID, ReqStatus, CreatedAt, AcceptedAt, RejectedAt) VALUES
  (1,4,3003,'ACCEPTED','2025-04-12 10:00:00','2025-04-13 11:00:00',NULL),
  (2,4,3002,'REJECTED','2025-04-12 10:05:00',NULL,'2025-04-12 18:00:00'),
  (3,4,3001,'QUEUED',  '2025-04-13 09:00:00',NULL,NULL);

-- Exam for #3
INSERT INTO exam (ExamID, ThesisID, ExamDate, ExamMethod, Location, ExamGrade, GradingOpen) VALUES
  (1,3,'2025-12-15','IN-PERSON','Room A',NULL,0);

-- Notes sample
INSERT INTO thesis_notes (ThesisID, ProfessorID, Body) VALUES
  (1,2001,'Initial progress note.'),
  (1,2001,'Chapter 2 review next week.');

-- Extra Theses (5..10)
INSERT INTO thesis
  (ThesisID, Title, Description, StudentID, ProfessorID, Status, StartDate, ActiveSince, EndDate, Progress, RepositoryLink, PdfPath, AssignmentConfirmed)
VALUES
(5,'Development of a Task Management System with Web Technologies',
'Implementation of a web application with Node.js, Express and React for organizing and monitoring tasks.',
 1002,3001,'ACTIVE','2025-02-01','2025-02-15','2025-10-01',65,'http://repo.uni/thesis5',NULL,1),

(6,'Evaluation of Machine Learning Algorithms for Malware Detection',
'Comparison of Random Forest, SVM and Deep Learning for classifying executable files into malicious/clean.',
 1006,3002,'CANCELLED','2025-01-10','2025-01-25','2025-05-30',15,'http://repo.uni/thesis6',NULL,0),

(7,'Database Design for a University Examination System',
'Creation and optimization of a database schema to support subjects, examinations and assessment.',
 1009,3003,'UNDER-EXAMINATION','2025-03-01','2025-03-20','2025-12-20',95,'http://repo.uni/thesis7',NULL,1),

(8,'Mobile Application Development for Smart City',
'Android application connected to IoT sensors to provide traffic and pollution information.',
 1010,3004,'UNDER-EXAMINATION','2025-02-10','2025-02-25','2025-12-22',90,'http://repo.uni/thesis8',NULL,1),

(9,'Automatic Face Recognition System Using Neural Networks',
'Using CNN for face detection/recognition.',
 1005,3005,'FINISHED','2024-10-01','2024-11-01','2024-12-10',100,'http://repo.uni/thesis9','/uploads/thesis9.pdf',1),

(10,'Developing a RESTful API for File Sharing',
'REST API with Node.js/Express for secure sharing with JWT.',
 NULL,3006,'UNDER-ASSIGNMENT','2025-05-01',NULL,'2026-05-01',0,'http://repo.uni/thesis10',NULL,0);

-- Submissions sample
INSERT INTO submissions (ThesisID, FileURL, LinkURL, DateUploaded) VALUES
(5,'/uploads/thesis5.pdf','http://repo.uni/thesis5','2025-04-10 14:00:00'),
(6,'/uploads/thesis6.pdf','http://repo.uni/thesis6','2025-02-20 12:30:00'),
(7,'/uploads/thesis7.pdf','http://repo.uni/thesis7','2025-05-15 09:20:00'),
(8,'/uploads/thesis8.pdf','http://repo.uni/thesis8','2025-05-22 16:45:00'),
(9,'/uploads/thesis9.pdf','http://repo.uni/thesis9','2024-11-20 18:00:00');

-- Exams 7,8,9
INSERT INTO exam (ExamID, ThesisID, ExamDate, ExamMethod, Location, ExamGrade, GradingOpen) VALUES
(2,7,'2025-12-20','ONLINE','Zoom Meeting',NULL,0),
(3,8,'2025-12-22','IN-PERSON','Room B',NULL,0),
(4,9,'2024-12-10','IN-PERSON','Room C',8.5,0);

-- Grades sample (το Grade υπολογίζεται και στο SELECT αν μείνει NULL)
INSERT INTO grade (ExamID, ProfessorID, ScoreWorkQuality, ScoreDuration, ScoreTextQuality, ScorePresentation) VALUES
(4,3002,8.8,8.5,8.2,8.5),
(4,3005,9.2,9.0,8.9,8.8),
(4,3006,8.7,8.6,8.5,8.6);

-- Announcements sample
INSERT INTO announcements (ThesisID, PresentationDate, Description) VALUES
(7,'2025-12-20','Presentation: "Database Design for Examination System" — Room/Zoom'),
(8,'2025-12-22','Presentation: "Smart City" — Room B'),
(9,'2024-12-10','Presentation: "Facial Recognition" — Room C');
