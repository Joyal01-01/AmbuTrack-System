import express from 'express';
const router = express.Router();
import db from '../config/db.js';

router.post('/sos', async (req, res) => {
  const token = req.headers['x-auth-token'];
  const { lat, lng, message } = req.body;

  if (!token) return res.status(401).send('Unauthorized');

  db.query('SELECT * FROM users WHERE token=?', [token], (err, r) => {
    if (err || !r.length) return res.status(401).send('Unauthorized');
    const user = r[0];

    console.log(`🆘 SOS ALERT from ${user.name} (${user.phone}) at ${lat}, ${lng}`);
    
    // In a real app, integrate Twilio here
    // For now, log it and possibly notify all admins via socket
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new_driver_pending', { 
        name: `🆘 SOS: ${user.name}`, 
        message: `Emergency at ${lat}, ${lng}. Phone: ${user.phone}` 
      });
    }

    // Also send a self-notification or log to a future 'emergency_logs' table
    res.send({ ok: true, message: 'Emergency contacts and nearby services alerted.' });
  });
});

export default router;
