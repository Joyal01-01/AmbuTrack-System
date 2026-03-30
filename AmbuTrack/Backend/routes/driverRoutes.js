import express from "express";
import db from "../config/db.js";
import { sendSMS } from "../services/twilio.js";

const router = express.Router();

router.post('/online', (req, res) => {
  const token = req.headers['x-auth-token'] || req.body.token;
  const { driverId, lat, lng, name } = req.body;

  if (token) {
    db.query('SELECT * FROM users WHERE token=?', [token], (err, rows) => {
      if (err) return res.status(500).send(err);
      if (!rows.length) return res.status(401).send('Unauthorized');
      const user = rows[0];
      db.query('SELECT id FROM drivers WHERE user_id=?', [user.id], (e, dr) => {
        if (e) return res.status(500).send(e);
        if (dr && dr.length) {
          db.query('UPDATE drivers SET status=?, lat=?, lng=?, online_since=NOW() WHERE user_id=?', ['online', lat || null, lng || null, user.id]);
          return res.json({ message: 'Driver Online', driverId: dr[0].id });
        }
        db.query('INSERT INTO drivers(user_id, name, lat, lng, status, online_since) VALUES(?,?,?,?,?,NOW())', [user.id, user.name || name || null, lat || null, lng || null, 'online'], (ie, ir) => {
          if (ie) return res.status(500).send(ie);
          return res.json({ message: 'Driver Online', driverId: ir.insertId });
        });
      });
    });
    return;
  }

  if (!driverId) return res.status(400).send('Missing driverId');
  db.query('UPDATE drivers SET status=?, lat=?, lng=? WHERE id=?', ['online', lat || null, lng || null, driverId], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: 'Driver Online' });
  });
});

router.post('/offline', (req, res) => {
  const token = req.headers['x-auth-token'] || req.body.token;
  const { driverId } = req.body;

  if (token) {
    db.query('SELECT * FROM users WHERE token=?', [token], (err, rows) => {
      if (err) return res.status(500).send(err);
      if (!rows.length) return res.status(401).send('Unauthorized');
      const user = rows[0];
      db.query('UPDATE drivers SET status=?, online_since=NULL WHERE user_id=?', ['offline', user.id], (e) => {
        if (e) return res.status(500).send(e);
        res.json({ message: 'Driver Offline' });
      });
    });
    return;
  }

  if (!driverId) return res.status(400).send('Missing driverId');
  db.query('UPDATE drivers SET status=?, online_since=NULL WHERE id=?', ['offline', driverId], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: 'Driver Offline' });
  });
});

function authDriver(req, res, cb) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  db.query('SELECT * FROM users WHERE token=?', [token], (err, rows) => {
    if (err) return res.status(500).send(err);
    if (!rows.length) return res.status(401).json({ error: 'Unauthorized' });
    const user = rows[0];
    if (user.role !== 'driver') return res.status(403).json({ error: 'Forbidden' });
    
    if (user.approval_status === 'pending') return res.status(403).json({ error: 'Pending Admin Approval', approval_status: 'pending' });
    if (user.approval_status === 'rejected') return res.status(403).json({ error: 'Application Rejected', approval_status: 'rejected' });

    db.query('SELECT * FROM drivers WHERE user_id=?', [user.id], (e, dr) => {
      if (e) return res.status(500).send(e);
      cb(user, dr && dr.length ? dr[0] : null);
    });
  });
}

// POST /api/driver/vehicle
router.post('/vehicle', (req, res) => {
  authDriver(req, res, (user, driver) => {
    const { vehicle_name, vehicle_type, base_fare, per_km_rate } = req.body;
    db.query(
      "UPDATE users SET vehicle_name=?, vehicle_type=?, base_fare=?, per_km_rate=? WHERE id=?",
      [vehicle_name, vehicle_type, base_fare, per_km_rate, user.id],
      (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Vehicle profile updated" });
      }
    );
  });
});

// GET /api/driver/vehicle
router.get('/vehicle', (req, res) => {
  authDriver(req, res, (user, driver) => {
    db.query(
      "SELECT vehicle_name, vehicle_type, base_fare, per_km_rate FROM users WHERE id=?",
      [user.id],
      (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows[0] || {});
      }
    );
  });
});

// GET /api/driver/stats — dashboard statistics
router.get('/stats', (req, res) => {
  authDriver(req, res, (user, driver) => {
    const driverId = driver ? driver.id : null;
    const userId = user.id;
    db.query("SELECT COUNT(*) AS total FROM trips WHERE driver_id=? AND status='completed'", [driverId], (e1, r1) => {
      const totalTrips = (!e1 && r1 && r1[0]) ? r1[0].total : 0;
      db.query("SELECT COUNT(*) AS today FROM trips WHERE driver_id=? AND status='completed' AND DATE(completed_at)=CURDATE()", [driverId], (e2, r2) => {
        const todayTrips = (!e2 && r2 && r2[0]) ? r2[0].today : 0;
        db.query("SELECT COALESCE(SUM(fare),0) AS earnings FROM trips WHERE driver_id=? AND status='completed' AND DATE(completed_at)=CURDATE()", [driverId], (e3, r3) => {
          const todayEarnings = (!e3 && r3 && r3[0]) ? r3[0].earnings : 0;
          const totalEarnings = driver ? (driver.total_earnings || 0) : 0;
          const rating = driver ? (driver.rating || 5.0) : 5.0;
          const completedTrips = driver ? (driver.completed_trips || 0) : 0;
          const onlineSince = driver ? driver.online_since : null;
          const status = driver ? driver.status : 'offline';
          res.json({
            totalTrips: completedTrips || totalTrips,
            todayTrips,
            todayEarnings: parseFloat(todayEarnings),
            totalEarnings: parseFloat(totalEarnings),
            rating: parseFloat(rating),
            status,
            onlineSince,
            driverName: user.name,
            driverEmail: user.email,
          });
        });
      });
    });
  });
});

// GET /api/driver/trip-history — recent completed trips
router.get('/trip-history', (req, res) => {
  authDriver(req, res, (user, driver) => {
    const driverId = driver ? driver.id : null;
    db.query(
      `SELECT t.id, t.status, t.patient_lat, t.patient_lng, t.distance_km, t.fare, t.created_at, t.started_at, t.completed_at,
              u.name AS patient_name
       FROM trips t
       LEFT JOIN users u ON u.id = t.patient_id
       WHERE t.driver_id=?
       ORDER BY t.created_at DESC LIMIT 20`,
      [driverId],
      (err, rows) => {
        if (err) return res.status(500).send(err);
        res.json(rows || []);
      }
    );
  });
});

// GET /api/driver/active-trip — current active trip or ride request
router.get('/active-trip', (req, res) => {
  authDriver(req, res, (user, driver) => {
    const driverId = driver ? driver.id : null;
    const userId = user.id;
    db.query(
      `SELECT rr.*, u.name AS patient_name, u.phone AS patient_phone FROM ride_requests rr LEFT JOIN users u ON u.id=rr.user_id
       WHERE rr.accepted_by=? AND rr.status IN ('accepted', 'arrived', 'started') LIMIT 1`,
      [userId],
      (e2, r2) => {
        if (e2) { console.error("Active trip ride_requests query error:", e2); return res.status(500).json({ error: e2.message || e2 }); }
        if (r2 && r2.length) return res.json({ type: 'ride_request', ...r2[0] });
        
        db.query(
          `SELECT t.*, u.name AS patient_name, u.phone AS patient_phone FROM trips t LEFT JOIN users u ON u.id=t.patient_id
           WHERE t.driver_id=? AND t.status IN ('requesting','accepted','arrived','started') LIMIT 1`,
          [driverId],
          (err, rows) => {
            if (!err && rows && rows.length) return res.json({ type: 'trip', ...rows[0] });
            res.json(null);
          }
        );
      }
    );
  });
});

// POST /api/driver/trip/:id/arrived
router.post('/trip/:id/arrived', (req, res) => {
  authDriver(req, res, (user, driver) => {
    const tripId = req.params.id;
    // try trips table
    db.query("UPDATE trips SET status='arrived' WHERE id=? AND driver_id=?", [tripId, driver?.id], (err, result) => {
      if (err) console.error("Ignored Trips Error:", err.message);
      if (result && result.affectedRows > 0) return res.json({ ok: true, message: 'Marked as arrived' });
      // try ride_requests table
      db.query("UPDATE ride_requests SET status='arrived' WHERE id=? AND accepted_by=?", [tripId, user.id], (e2, r2) => {
        if (e2) return res.status(500).send(e2);

        db.query("SELECT u.phone, u.name, rr.otp, rr.user_id FROM ride_requests rr JOIN users u ON rr.user_id = u.id WHERE rr.id=?", [tripId], (pe, pr) => {
           if (pr && pr.length) {
             if (pr[0].phone) {
               sendSMS(pr[0].phone, `AmbuTrack Alert: Your ambulance has arrived at your location. Your OTP is ${pr[0].otp || 'N/A'}. Please board safely.`);
             }
             if (global.io && pr[0].user_id) {
               const registry = global.io.registry || {};
               Object.keys(registry).forEach(sid => {
                 if (registry[sid] && registry[sid].userId === pr[0].user_id) {
                   global.io.to(sid).emit('trip_updated', { status: 'arrived', otp: pr[0].otp });
                 }
               });
             }
           }
        });

        res.json({ ok: true, message: 'Marked as arrived' });
      });
    });
  });
});

// POST /api/driver/trip/:id/start
router.post('/trip/:id/start', (req, res) => {
  authDriver(req, res, (user, driver) => {
    const tripId = req.params.id;
    db.query("UPDATE trips SET status='started', started_at=NOW() WHERE id=? AND driver_id=?", [tripId, driver?.id], (err, result) => {
      if (err) console.error("Ignored Trips Error:", err.message);
      if (result && result.affectedRows > 0) return res.json({ ok: true, message: 'Trip started' });
      db.query("UPDATE ride_requests SET status='started' WHERE id=? AND accepted_by=?", [tripId, user.id], (e2) => {
        if (e2) return res.status(500).send(e2);
        res.json({ ok: true, message: 'Trip started' });
      });
    });
  });
});

// POST /api/driver/trip/:id/cancel
router.post('/trip/:id/cancel', (req, res) => {
  authDriver(req, res, (user, driver) => {
    const tripId = req.params.id;
    
    db.query("UPDATE trips SET status='cancelled' WHERE id=? AND driver_id=? AND status IN ('requesting', 'accepted', 'arrived')", [tripId, driver?.id], (err) => {
      if (err) console.error("Ignored Trips Error:", err.message);
      
      db.query("UPDATE ride_requests SET status='cancelled' WHERE id=? AND accepted_by=? AND status IN ('accepted', 'arrived')", [tripId, user.id], (e2) => {
        if (e2) return res.status(500).send(e2);
        
        if (driver) {
          db.query("UPDATE drivers SET status='online' WHERE id=?", [driver.id]);
        }
        
        db.query("SELECT patient_id FROM trips WHERE id=? UNION SELECT user_id FROM ride_requests WHERE id=?", [tripId, tripId], (se, sr) => {
          if (sr && sr.length && global.io) {
            const registry = global.io.registry || {};
            const patientId = sr[0].patient_id;
            Object.keys(registry).forEach(sid => {
              if (registry[sid] && registry[sid].userId === patientId) {
                global.io.to(sid).emit('ride_cancelled', { id: tripId });
              }
            });
          }
        });
        
        res.json({ ok: true, message: 'Trip cancelled' });
      });
    });
  });
});

// POST /api/driver/trip/:id/complete
router.post('/trip/:id/complete', (req, res) => {
  authDriver(req, res, (user, driver) => {
    const tripId = req.params.id;
    const distanceKm = parseFloat(req.body.distance_km || 0);
    const baseFare = parseFloat(user.base_fare || 100);
    const perKmRate = parseFloat(user.per_km_rate || 30);
    const fare = baseFare + (distanceKm * perKmRate);

    db.query(
      "UPDATE trips SET status='completed', completed_at=NOW(), distance_km=?, fare=? WHERE id=? AND driver_id=?",
      [distanceKm, fare, tripId, driver?.id],
      (err, result) => {
        if (err) console.error("Ignored Trips Error:", err.message);
        const wasTrip = result && result.affectedRows > 0;
        db.query("UPDATE ride_requests SET status='completed' WHERE id=? AND accepted_by=?", [tripId, user.id], () => {});

        // Notify patient via socket
        db.query("SELECT patient_id FROM trips WHERE id=?", [tripId], (se, sr) => {
          let patientUserId = sr && sr.length ? sr[0].patient_id : null;
          if (!patientUserId) {
            db.query("SELECT user_id FROM ride_requests WHERE id=?", [tripId], (re, rr) => {
              patientUserId = rr && rr.length ? rr[0].user_id : null;
              if (patientUserId && global.io) {
                const registry = global.io.registry || {};
                Object.keys(registry).forEach(sid => {
                  if (registry[sid] && registry[sid].userId === patientUserId) {
                    global.io.to(sid).emit('trip_completed', { id: tripId, fare: fare.toFixed(2), distance: distanceKm });
                  }
                });
              }
              if (patientUserId) {
                db.query("SELECT phone FROM users WHERE id=?", [patientUserId], (phe, phr) => {
                  if (phr && phr.length && phr[0].phone) {
                    sendSMS(phr[0].phone, `AmbuTrack: Your trip is completed. Total Fare: NPR ${fare.toFixed(2)}. Please complete your payment.`);
                  }
                });
              }
            });
          } else if (global.io) {
            const registry = global.io.registry || {};
            Object.keys(registry).forEach(sid => {
              if (registry[sid] && registry[sid].userId === patientUserId) {
                global.io.to(sid).emit('trip_completed', { id: tripId, fare: fare.toFixed(2), distance: distanceKm });
              }
            });
            db.query("SELECT phone FROM users WHERE id=?", [patientUserId], (phe, phr) => {
              if (phr && phr.length && phr[0].phone) {
                sendSMS(phr[0].phone, `AmbuTrack: Your trip is completed. Total Fare: NPR ${fare.toFixed(2)}. Please complete your payment.`);
              }
            });
          }
        });

        if (driver) {
          db.query(
            "UPDATE drivers SET status='online', completed_trips=completed_trips+1, total_earnings=total_earnings+? WHERE id=?",
            [fare, driver.id]
          );
        }
        res.json({ ok: true, message: 'Trip completed', fare: fare.toFixed(2), baseFare, perKmRate, distanceKm });
      }
    );
  });
});


// POST /api/driver/rate
router.post('/rate', (req, res) => {
  const token = req.headers['x-auth-token'];
  const { driverId, rating } = req.body;
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  if (!driverId || !rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Invalid rating' });

  db.query("SELECT rating, completed_trips FROM drivers WHERE id=?", [driverId], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (!rows.length) return res.status(404).json({ error: 'Driver not found' });
    
    let currentRating = parseFloat(rows[0].rating || 5.0);
    let trips = parseInt(rows[0].completed_trips || 1);
    let newRating = ((currentRating * trips) + parseFloat(rating)) / (trips + 1);
    newRating = Math.min(Math.max(newRating, 0), 5.0).toFixed(1);

    db.query("UPDATE drivers SET rating=? WHERE id=?", [newRating, driverId], (e2) => {
      if (e2) return res.status(500).json(e2);
      res.json({ message: 'Rated successfully', newRating });
    });
  });
});

export default router;