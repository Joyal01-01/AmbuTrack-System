require('dotenv').config();
const express = require('express');
const mysql2 = require('mysql2');
const cors = require('cors');

const app = express();

app.use(express.json());              
app.use(cors({ origin: "http://localhost:3000" }));

app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT || 4000;


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

app.put('/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    db.query(
      'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
      [name, email, role, req.paramsid],err => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'User Updated Successfully' });
      }     
    );
});

app.delete('/users/:id', (req, res) => {
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], err => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'User Deleted Successfully' });
    });
});

app.get('/ambulances', (req, res) => {
    db.query('SELECT a. *, u.name AS driver_name FROM ambulances a LEFT JOIN users u ON a.driver_id = u.id', (err, results) => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

app.post('/ambulances', (req, res) => {
    const { driver_id, ambulance_number, status,lat,lng } = req.body;
    db.query(
      'INSERT INTO ambulances (driver_id, ambulance_number, status, lat,lng) VALUES (?, ?, ?, ?, ?)',
      [driver_id || null, ambulance_number, status || 'available',lat || null,lng || null],
      (err, results) => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'Ambulance Added Successfully', id: results.insertId });
      }
    );
});

app.put('/ambulances/:id', (req, res) => {
    const{ driver_id, ambulance_number, status,lat,lng } = req.body;
    db.query(
      'UPDATE ambulances SET driver_id = ?, ambulance_number = ?, status = ?, lat = ?, lng = ? WHERE id = ?',[driver_id, ambulance_number, status,lat,lng, req.params.id],
      err => {
          if(err) return res.status(500).json({ error: 'Database error' }); 
          res.json({ message: 'Ambulance Updated Successfully' });
      }
    );
});

app.delete('/ambulances/:id', (req, res) => {
    db.query('DELETE FROM ambulances WHERE id = ?', [req.params.id], err => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Ambulance Deleted Successfully' });
    });
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
      [request_id, start_time||null, end_time||null , status||'ongoing'],
      (err, results) => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'Trip Created Successfully', id: results.insertId });
      }
    );
});

app.put('/trips/:id', (req, res) => {
    const { start_time, end_time, status } = req.body;
    db.query(
      'UPDATE trips SET start_time = ?, end_time = ?, status = ? WHERE id = ?',
      [start_time || null, end_time || null, status || 'ongoing', req.params.id],
      err => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'Trip Updated Successfully' });
      }
    );
});

app.delete('/trips/:id', (req, res) => {
    db.query('DELETE FROM trips WHERE id = ?', [req.params.id], err => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Trip Deleted Successfully' });
    });
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
    const { user_id, location, emergency_level,lat,lng } = req.body;
    if (!location) return res.status(400).json({ error: 'Location is required' });  
    db.query(
      'INSERT INTO requests (user_id, location, emergency_level, status) VALUES (?, ?, ?, ?)',
      [user_id || null, location, emergency_level || 'low', lat || null,lng || null], (err, results) => {
          if(err) return res.status(500).json({ error: 'Database error' });
          res.status(201).json({ message: 'Request Created Successfully', id: results.insertId });
      }
    );
});

app.put('/requests/:id', (req, res) => {
    const { status, ambulance_id } = req.body;
    db.query('UPDATE requests SET status = ?, ambulance_id = ? WHERE id = ?', [status, ambulance_id || null, req.params.id], err => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Request Updated Successfully' });
    });
});

app.delete('/requests/:id', (req, res) => {
    db.query('DELETE FROM requests WHERE id = ?', [req.params.id], err => {
        if(err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Request Deleted Successfully' });
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
