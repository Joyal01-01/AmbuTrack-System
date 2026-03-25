import db from "../config/db.js";

function distance(lat1, lon1, lat2, lon2) {

const R = 6371;

const dLat = (lat2 - lat1) * Math.PI / 180;
const dLon = (lon2 - lon1) * Math.PI / 180;

const a =
Math.sin(dLat/2) * Math.sin(dLat/2) +
Math.cos(lat1*Math.PI/180) *
Math.cos(lat2*Math.PI/180) *
Math.sin(dLon/2) *
Math.sin(dLon/2);

const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

return R * c;

}

export const findNearestDrivers = (lat,lng,callback)=>{

const sql = "SELECT * FROM drivers WHERE status='online'";

db.query(sql,(err,drivers)=>{

if(err) return callback([]);

const sorted = drivers
.map(d=>{

return {
...d,
distance:distance(lat,lng,d.lat,d.lng)
};

})
.sort((a,b)=>a.distance-b.distance);

callback(sorted);

});

};
export const calculateETA = (distance)=>{

const avgSpeed = 40;

const time = distance / avgSpeed;

return Math.round(time * 60);

};