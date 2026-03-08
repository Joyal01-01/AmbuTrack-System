import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

export default function Login(){

const navigate = useNavigate();

const [email,setEmail]=useState("");
const [password,setPassword]=useState("");

const login = async ()=>{

try{

const res = await api.post("/login",{
email,
password
});

if(res.data){

localStorage.setItem("user",JSON.stringify(res.data));

navigate("/dashboard");

}else{

alert("Invalid Login")

}

}catch(err){

alert("Server Error")

}

}


return(

<div>

<h2>Login</h2>

<input
placeholder="Email"
onChange={(e)=>setEmail(e.target.value)}
/>

<input
placeholder="Password"
type="password"
onChange={(e)=>setPassword(e.target.value)}
/>

<button onClick={login}>
Login
</button>

</div>

)

}