const express = require("express");
const mysql = require("mysql2");
const path = require("path");

const app = express();
const PORT = 3000;

// Change these values to match your local MySQL setup.
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "YOUR_MYSQL_PASSWORD",
    database: "college_event_db"
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

db.connect((err) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }
    console.log("MySQL connected successfully!");
});

// Home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// GET all events, optionally searching/filtering by name, branch, category.
app.get("/api/events", (req, res) => {
    const search = `%${req.query.search || ""}%`;
    const branch = req.query.branch || "";
    const category = req.query.category || "";

    const sql = `
        SELECT event_id, event_name, branch, category, event_date, venue, description
        FROM events
        WHERE event_name LIKE ?
          AND (? = '' OR branch = ? OR branch = 'All Branches')
          AND (? = '' OR category = ?)
        ORDER BY event_date IS NULL, event_date ASC, event_id DESC
    `;

    db.query(sql, [search, branch, branch, category, category], (err, rows) => {
        if (err) return res.status(500).json({ error: "Could not load events." });
        res.json(rows);
    });
});

// GET one event
app.get("/api/events/:id", (req, res) => {
    db.query("SELECT * FROM events WHERE event_id = ?", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Could not load event." });
        if (!rows.length) return res.status(404).json({ error: "Event not found." });
        res.json(rows[0]);
    });
});

// ADD event
app.post("/api/events", (req, res) => {
    const { event_name, branch, category, event_date, venue, description } = req.body;
    if (!event_name || !branch) {
        return res.status(400).json({ error: "Event name and branch are required." });
    }

    const sql = `INSERT INTO events
        (event_name, branch, category, event_date, venue, description)
        VALUES (?, ?, ?, ?, ?, ?)`;

    db.query(sql, [
        event_name.trim(), branch, category || null,
        event_date || null, venue || null, description || null
    ], (err, result) => {
        if (err) return res.status(500).json({ error: "Could not add event." });
        res.status(201).json({ message: "Event added successfully.", event_id: result.insertId });
    });
});

// UPDATE event
app.put("/api/events/:id", (req, res) => {
    const { event_name, branch, category, event_date, venue, description } = req.body;
    if (!event_name || !branch) {
        return res.status(400).json({ error: "Event name and branch are required." });
    }

    const sql = `UPDATE events
        SET event_name = ?, branch = ?, category = ?, event_date = ?, venue = ?, description = ?
        WHERE event_id = ?`;

    db.query(sql, [
        event_name.trim(), branch, category || null,
        event_date || null, venue || null, description || null, req.params.id
    ], (err, result) => {
        if (err) return res.status(500).json({ error: "Could not update event." });
        if (!result.affectedRows) return res.status(404).json({ error: "Event not found." });
        res.json({ message: "Event updated successfully." });
    });
});

// DELETE event. A registered event cannot be deleted until its registrations are removed.
app.delete("/api/events/:id", (req, res) => {
    db.query("DELETE FROM events WHERE event_id = ?", [req.params.id], (err, result) => {
        if (err) {
            if (err.code === "ER_ROW_IS_REFERENCED_2") {
                return res.status(409).json({
                    error: "Students are registered for this event. Remove its registrations first."
                });
            }
            return res.status(500).json({ error: "Could not delete event." });
        }
        if (!result.affectedRows) return res.status(404).json({ error: "Event not found." });
        res.json({ message: "Event deleted successfully." });
    });
});

// Register a student for an event
app.post("/api/register", (req, res) => {
    const { student_name, roll_number, branch, year_of_study, email, phone, event_id } = req.body;

    if (!student_name || !roll_number || !branch || !email || !event_id) {
        return res.status(400).json({ error: "Please complete all required fields." });
    }

    db.query(
        `INSERT INTO students (student_name, roll_number, branch, year_of_study, email, phone)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            student_name = VALUES(student_name),
            branch = VALUES(branch),
            year_of_study = VALUES(year_of_study),
            email = VALUES(email),
            phone = VALUES(phone)`,
        [student_name.trim(), roll_number.trim(), branch, year_of_study || null, email.trim(), phone || null],
        (studentErr, studentResult) => {
            if (studentErr) return res.status(500).json({ error: "Could not save student details." });

            db.query("SELECT student_id FROM students WHERE roll_number = ?", [roll_number.trim()], (lookupErr, studentRows) => {
                if (lookupErr || !studentRows.length) {
                    return res.status(500).json({ error: "Could not find saved student record." });
                }

                const studentId = studentRows[0].student_id;
                db.query(
                    "INSERT INTO registrations (student_id, event_id) VALUES (?, ?)",
                    [studentId, event_id],
                    (regErr) => {
                        if (regErr && regErr.code === "ER_DUP_ENTRY") {
                            return res.status(409).json({ error: "This student is already registered for this event." });
                        }
                        if (regErr && regErr.code === "ER_NO_REFERENCED_ROW_2") {
                            return res.status(400).json({ error: "Please select a valid event." });
                        }
                        if (regErr) return res.status(500).json({ error: "Could not complete registration." });
                        res.status(201).json({ message: "Registration successful!" });
                    }
                );
            });
        }
    );
});

// List registrations for the manage page
app.get("/api/registrations", (req, res) => {
    const sql = `
        SELECT r.registration_id, r.registration_date,
               s.student_name, s.roll_number, s.branch AS student_branch, s.email,
               e.event_name, e.event_id
        FROM registrations r
        JOIN students s ON r.student_id = s.student_id
        JOIN events e ON r.event_id = e.event_id
        ORDER BY r.registration_date DESC
    `;
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: "Could not load registrations." });
        res.json(rows);
    });
});

// Contact form
app.post("/api/contact", (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: "Please complete every field." });
    }

    db.query(
        "INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)",
        [name.trim(), email.trim(), message.trim()],
        (err) => {
            if (err) return res.status(500).json({ error: "Could not save your message." });
            res.status(201).json({ message: "Your message has been sent successfully!" });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
