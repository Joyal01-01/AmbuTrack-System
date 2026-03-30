import express from "express";
import db from "../config/db.js";
import { findNearestDrivers } from "../services/matchingService.js";

const router = express.Router();

router.post("/request",(req,res)=>{

const {patientId,lat,lng}=req.body;

findNearestDrivers(lat,lng,(drivers)=>{

if(drivers.length===0)
return res.json({message:"No Ambulance Available"});

let index = 0;

function tryDriver(){

if(index>=drivers.length){
return res.json({message:"No driver accepted"});
}

const driver = drivers[index];

const sql = `
INSERT INTO trips
(patient_id,driver_id,status,patient_lat,patient_lng)
VALUES (?,?, 'requesting',?,?)
`;

db.query(sql,[patientId,driver.id,lat,lng],(err,result)=>{

const tripId = result.insertId;

setTimeout(()=>{

db.query(
"SELECT status FROM trips WHERE id=?",
[tripId],
(err,row)=>{

if(row[0].status==="requesting"){

index++;

tryDriver();

}

});

},10000);

});

// notify the selected driver via socket (if connected)
try{
	const reg = global.io && global.io.registry ? global.io.registry : {};
	Object.keys(reg).forEach(sid=>{
		if(reg[sid] && reg[sid].userId === driver.id){
			// emit a ride offer and include tripId and patient location
			global.io.to(sid).emit('ride_offer', { tripId, patientId, lat, lng });
		}
	});
}catch(e){ }

}

tryDriver();

});

});

// Accept a trip: only the assigned driver may accept. Mark driver on-trip and notify patient socket.
router.post('/accept',(req,res)=>{
	const { tripId, driverId } = req.body;
	if(!tripId || !driverId) return res.status(400).json({ message: 'Missing' });

	// Prevent driver from accepting if they already have an active trip
	db.query("SELECT COUNT(*) AS cnt FROM trips WHERE driver_id=? AND status!='completed'", [driverId], (err, rows)=>{
		if(err) return res.status(500).send(err);
		if(rows && rows[0] && rows[0].cnt > 0) return res.status(409).json({ message: 'Driver already has an active trip' });

		// Try to atomically set trip to accepted only if still requesting
		// Perform acceptance in a DB transaction to ensure atomicity and enforce one-active-trip
		db.getConnection((cErr, conn) => {
			if(cErr) return res.status(500).send(cErr);
			conn.beginTransaction(txErr => {
				if(txErr){ conn.release(); return res.status(500).send(txErr); }
				conn.query("SELECT COUNT(*) AS cnt FROM trips WHERE driver_id=? AND status!='completed'", [driverId], (er, rowsCnt) => {
					if(er) return conn.rollback(()=>{ conn.release(); res.status(500).send(er); });
					if(rowsCnt && rowsCnt[0] && rowsCnt[0].cnt > 0) return conn.rollback(()=>{ conn.release(); res.status(409).json({ message: 'Driver already has an active trip' }); });

					conn.query("UPDATE trips SET status='accepted' WHERE id=? AND driver_id=? AND status='requesting'", [tripId, driverId], (uErr, uRes) => {
						if(uErr) return conn.rollback(()=>{ conn.release(); res.status(500).send(uErr); });
						if(!uRes || uRes.affectedRows === 0) return conn.rollback(()=>{ conn.release(); res.status(409).json({ message: 'Unable to accept (already accepted or invalid)' }); });

						conn.query("UPDATE drivers SET status='ontrip' WHERE id=?", [driverId], (dErr) => {
							if(dErr) return conn.rollback(()=>{ conn.release(); res.status(500).send(dErr); });

							conn.query('SELECT patient_id FROM trips WHERE id=?',[tripId], (e, rows)=>{
								if(e) return conn.rollback(()=>{ conn.release(); res.status(500).send(e); });
								const patientId = rows[0].patient_id;
								conn.commit(cmErr => {
									if(cmErr) return conn.rollback(()=>{ conn.release(); res.status(500).send(cmErr); });
									conn.release();
									try{
										const reg = global.io && global.io.registry ? global.io.registry : {};
										Object.keys(reg).forEach(sid=>{
											if(reg[sid] && reg[sid].userId === patientId){
												global.io.to(sid).emit('ride_accepted', { tripId, driverId });
											}
										});
									}catch(e){}
									res.json({ message: 'Trip Accepted' });
								});
							});
						});
					});
				});
			});
		});
	});

});

router.post("/arrived",(req,res)=>{

const {tripId}=req.body;

db.query(
"UPDATE trips SET status='arrived' WHERE id=?",
[tripId]
);

res.json({message:"Driver Arrived"});

});

router.post("/start",(req,res)=>{

const {tripId}=req.body;

db.query(
"UPDATE trips SET status='started' WHERE id=?",
[tripId]
);

res.json({message:"Trip Started"});

});

router.post("/complete", (req, res) => {
  const { tripId, driverId } = req.body;

  // 1. Fetch trip and driver details to calculate fare
  db.query(
    `SELECT t.*, u.base_fare, u.per_km_rate 
     FROM trips t 
     JOIN drivers d ON t.driver_id = d.id 
     JOIN users u ON d.user_id = u.id 
     WHERE t.id = ?`,
    [tripId],
    (err, rows) => {
      if (err || !rows.length) return res.status(500).json({ error: "Trip not found" });
      const trip = rows[0];
      const base = trip.base_fare || 500;
      const rate = trip.per_km_rate || 50;
      
      // Mock distance for now if not tracked (e.g. 5km default or use logic)
      const distance = trip.distance_km || (Math.random() * 10 + 2).toFixed(1); 
      const fare = base + (distance * rate);

      // 2. Update trip with fare and status
      db.query(
        "UPDATE trips SET status='completed', fare=?, distance_km=?, completed_at=NOW() WHERE id=?",
        [fare, distance, tripId],
        (err2) => {
          if (err2) console.error(err2);
          
          // 3. Update driver status
          db.query(
            "UPDATE drivers SET status='online', completed_trips = completed_trips + 1 WHERE id=?",
            [driverId]
          );

          // 4. Update the ride_requests table if it was used
          db.query("UPDATE ride_requests SET status='completed', fare=?, distance_km=? WHERE accepted_by=(SELECT user_id FROM drivers WHERE id=?) AND status='started'", [fare, distance, driverId]);

          res.json({ message: "Trip Completed", fare, distance });
        }
      );
    }
  );
});

export default router;