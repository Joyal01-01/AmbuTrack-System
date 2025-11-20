const express = require('express');
const mysql2 = require('mysql2');
const cors = require('cors');
require('dotenv').config();

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
        if(err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

app.get('/users/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
        if(err) return res.status(500).json({ error: err });
        res.json(results[0]);
    });
});

app.post('/users', (req, res) => {
    const { name, email, password,role  } = req.body;
    db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', 
    [name, email, password, role], 
    (err, results) => {
        if(err) return res.status(500).json({ error: err });
        res.json({ message:'User Created Successfully', Id: results.insertId });
    });
});

app.get('ambuances', (req, res) => {
    db.query('SELECT * FROM ambuances', (err, results) => {
        if(err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

app.post('/ambuances', (req, res) => {
    const {driver_id, ambulance_number, status  } = req.body;
    db.query('INSERT INTO ambuances (driver_id, ambulance_number, status) VALUES (?, ?, ?)', 
    [driver_id, ambulance_number, status],
    (err, results) => {
        if(err) return res.status(500).json({ error: err });
        res.json({ message:'Ambulance Added Successfully', Id: results.insertId });
    });
});

app.get('/trips', (req, res) => {
    db.query('SELECT * FROM trips', (err, results) => {
        if(err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

app.post('/trips', (req, res) => {
const{request_id, start_time, end_time, status  } = req.body;
    db.query('INSERT INTO trips (request_id, start_time, end_time, status) VALUES (?, ?, ?, ?)', 
    [request_id, start_time, end_time, status],
    (err, results) => {
        if(err) return res.status(500).json({ error: err });
        res.json({ message:'Trip Created Successfully', Id: results.insertId });
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});