Create database thesisDetails;
Use thesisDetails;

Create table users(
UserID INT(11) NOT NULL AUTO_INCREMENT,
Password VARCHAR(255) DEFAULT 'unknown' NOT NULL,
UserName VARCHAR(100) DEFAULT 'unknown' NOT NULL,
Role ENUM('STUDENT','PROFESSOR') NOT NULL,
Adress VARCHAR(150) DEFAULT 'unknown' NOT NULL,
Phone VARCHAR(20),
Email VARCHAR(100) NOT NULL,
PRIMARY KEY(UserID)
);

Create table thesis(
ThesisID INT(11) NOT NULL AUTO_INCREMENT,
Title VARCHAR(200) DEFAULT 'unknown' NOT NULL,
Description TEXT NOT NULL,
StudentID INT(11),
ProfessorID INT(11),
Status ENUM('UNDER-ASSIGNMENT','ACTIVE','UNDER-EXAMINATION','FINISHED') NOT NULL,
StartDate DATE NOT NULL,
EndDate DATE NOT NULL,
Progress INT(11),
RepositoryLink VARCHAR(255) DEFAULT 'unknown' NOT NULL,
PRIMARY KEY(ThesisID),
CONSTRAINT STDTHESIS FOREIGN KEY(StudentID) REFERENCES users(UserID)
ON UPDATE CASCADE ON DELETE CASCADE,
CONSTRAINT PROFTHESIS FOREIGN KEY(ProfessorID) REFERENCES users(UserID)
ON UPDATE CASCADE ON DELETE CASCADE 
);

Create table requests(
ReqID INT(11) NOT NULL AUTO_INCREMENT,
ThesisID INT(11),
ProfessorID INT(11),
ReqStatus ENUM('QUEUED','ACCEPTED','REJECTED') NOT NULL,
PRIMARY KEY(ReqID),
CONSTRAINT THESISREQ FOREIGN KEY(ThesisID) REFERENCES thesis(ThesisID)
ON UPDATE CASCADE ON DELETE CASCADE,
CONSTRAINT PROFREQ FOREIGN KEY(ProfessorID) REFERENCES users(UserID)
ON UPDATE CASCADE ON DELETE CASCADE 
);

Create table submissions(
SubID INT(11) NOT NULL AUTO_INCREMENT,
ThesisID INT(11),
FileURL VARCHAR(255) DEFAULT 'unknown' NOT NULL,
LinkURL VARCHAR(255) DEFAULT 'unknown' NOT NULL,
DateUploaded DATETIME NOT NULL,
PRIMARY KEY(SubID),
CONSTRAINT SUBTHESIS FOREIGN KEY(ThesisID) REFERENCES thesis(ThesisID)
ON UPDATE CASCADE ON DELETE CASCADE
);

Create table exam(
ExamID INT(11) NOT NULL AUTO_INCREMENT,
ThesisID INT(11),
ExamDate DATE NOT NULL,
ExamMethod ENUM('IN-PERSON','ONLINE') NOT NULL,
Location VARCHAR(250) DEFAULT 'unknown' NOT NULL,
ExamGrade DECIMAL(4,2),
PRIMARY KEY(ExamID),
CONSTRAINT THESISEXAM FOREIGN KEY(ThesisID) REFERENCES thesis(ThesisID)
ON UPDATE CASCADE ON DELETE CASCADE
);

Create table grade(
GradeID INT(11) NOT NULL AUTO_INCREMENT,
ExamID INT(11),
ProfessorID INT(11),
Grade DECIMAL(4,2),
PRIMARY KEY(GradeID),
CONSTRAINT EXAMGRADE FOREIGN KEY(ExamID) REFERENCES exam(ExamID)
ON UPDATE CASCADE ON DELETE CASCADE,
CONSTRAINT PROFGRADE FOREIGN KEY(ProfessorID) REFERENCES users(UserID)
ON UPDATE CASCADE ON DELETE CASCADE 
);

Create table announcements(
AnnouncementID INT(11) NOT NULL AUTO_INCREMENT,
ThesisID INT(11),
PresentationDate DATE NOT NULL,
Description TEXT NOT NULL,
PRIMARY KEY(AnnouncementID),
CONSTRAINT THESISANNOYNCE FOREIGN KEY(ThesisID) REFERENCES thesis(ThesisID)
ON UPDATE CASCADE ON DELETE CASCADE
);

INSERT INTO users (UserID, Password, UserName, Role, Adress, Phone, Email) VALUES
(1, '2004', 'Dim', 'STUDENT', 'Riga Fereou 45', NULL, 'Dim@gmail.com'),
(2, '2005', 'Geo', 'STUDENT', 'Epameinonda 23', '6977972769', 'Geo@gmail.com'),
(3, '2002', 'Stef', 'PROFESSOR', 'Yfestou 4', NULL, 'Stef@ceid.com');


INSERT INTO thesis (ThesisID, Title, Description, StudentID, ProfessorID, Status, StartDate, EndDate, Progress, RepositoryLink) VALUES
(1,'This is the first tittle', 'This is the description', 1, 3, 'ACTIVE', '2025-06-20', '2026-05-20', '40', 'This is a link'),
(2,'This is the second tittle', 'This is the Description', 2, NULL, 'ACTIVE', '2025-05-25', '2026-06-15', '90', 'This is a Link'),
(3,'This is the third tittle', 'This is the Description', 1, 3, 'UNDER-ASSIGNMENT', '2025-01-20', '2026-02-19', '10', 'This is a Link');
================================================================================================

/*ΣΥΝΔΕΣΗ ΜΕ ΤΗ ΒΑΣΗ
mkdir thesis-backend
cd thesis-backend
npm init -y
npm install express mysql2 cors body-parser

node index.js
*/

