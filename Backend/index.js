require('dotenv').config();
const express = require('express');
const mysql2 = require('mysql2');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const db = mysql2.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

app.get('/', (req, res) => {
    res.send('AmbuTrack Backend is running');
});

app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

app.get('/users/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json(results[0] || null);
    });
});

app.post('/users', (req, res) => {
    const { name, email, password, role } = req.body;
    db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, password, role],
      (err, results) => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'User Created Successfully', id: results.insertId });
      }
    );
});

app.get('/ambulances', (req, res) => {
    db.query('SELECT * FROM ambulances', (err, results) => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

app.post('/ambulances', (req, res) => {
    const { driver_id, ambulance_number, status } = req.body;
    db.query(
      'INSERT INTO ambulances (driver_id, ambulance_number, status) VALUES (?, ?, ?)',
      [driver_id, ambulance_number, status],
      (err, results) => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'Ambulance Added Successfully', id: results.insertId });
      }
    );
});

app.get('/trips', (req, res) => {
    db.query('SELECT * FROM trips', (err, results) => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

app.post('/trips', (req, res) => {
    const { request_id, start_time, end_time, status } = req.body;
    db.query(
      'INSERT INTO trips (request_id, start_time, end_time, status) VALUES (?, ?, ?, ?)',
      [request_id, start_time, end_time, status],
      (err, results) => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'Trip Created Successfully', id: results.insertId });
      }
    );
});

app.get('/requests', (req, res) => {
    const sql = `
    SELECT r.*, u.name AS user_name, u.email AS user_email
    FROM requests r
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
    `;
    db.query(sql, (err, results) => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

app.get('/requests/:id', (req, res) => {
    db.query('SELECT * FROM requests WHERE id = ?', [req.params.id], (err, results) => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json(results[0] || null);
    });
});

app.post('/requests', (req, res) => {
    const { user_id, location, emergency_level } = req.body;
    const status = 'pending';
    db.query(
      'INSERT INTO requests (user_id, location, emergency_level, status) VALUES (?, ?, ?, ?)',
      [user_id || null, location, emergency_level || 'low', status],
      (err, results) => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'Request Created Successfully', id: results.insertId });
      }
    );
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
