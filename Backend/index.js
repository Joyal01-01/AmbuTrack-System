import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server,{
cors:{
origin:"*"
}
});

/* MySQL Connection */

const db = mysql.createConnection({

host:process.env.DB_HOST,
user:process.env.DB_USER,
password:process.env.DB_PASSWORD,
database:process.env.DB_NAME

});

db.connect((err)=>{

if(err){
console.log(err)
}else{
console.log("MySQL Connected")
}

});


/* Register */

app.post("/register",(req,res)=>{

const {name,email,password}=req.body;

db.query(
"INSERT INTO users(name,email,password) VALUES(?,?,?)",
[name,email,password],
(err,result)=>{

if(err) return res.send(err);

res.send("Registered")

})

})


/* Login */

app.post("/login",(req,res)=>{

const {email,password}=req.body;

db.query(
"SELECT * FROM users WHERE email=? AND password=?",
[email,password],
(err,result)=>{

if(err) return res.send(err);

if(result.length>0)
res.send(result[0])
else
res.send("Invalid")

})

})



/* Ambulance list */

app.get("/ambulances",(req,res)=>{

db.query(
"SELECT * FROM ambulances",
(err,result)=>{

res.send(result)

})

})


/* Add ambulance */

app.post("/ambulance",(req,res)=>{

const {driver,lat,lng,status}=req.body;

db.query(
"INSERT INTO ambulances(driver,lat,lng,status) VALUES(?,?,?,?)",
[driver,lat,lng,status],
(err,result)=>{

if(err) return res.send(err);

io.emit("receiveLocation",req.body)

res.send("Added")

})

})


/* Socket */

io.on("connection",(socket)=>{

console.log("User Connected")

socket.on("sendLocation",(data)=>{

io.emit("receiveLocation",data)

})

})


server.listen(process.env.PORT,()=>{

console.log("Server Running Port 5000")

})