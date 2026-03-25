// Backend/routes/ride.js
import express from "express";
const router = express.Router();

// In-memory ride requests
let rideRequests = [
  // Example: { id: 1, name: "Patient 1", lat: 27.7172, lng: 85.3240 }
];

// Get all pending ride requests
router.get("/ride-requests", (req, res) => {
  res.json(rideRequests);
});

// Accept ride request
router.post("/ride-request/:id/accept", (req, res) => {
  const { id } = req.params;
  rideRequests = rideRequests.filter((r) => r.id != id);
  res.json({ success: true });
});

export default router;