import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

export default function Register(){

const navigate = useNavigate();

const [name,setName]=useState("");
const [email,setEmail]=useState("");
const [password,setPassword]=useState("");

const register = async ()=>{

try{

await api.post("/register",{
name,
email,
password
});

alert("Registered Successfully")

navigate("/");

}catch(err){

alert("Error")

}

}


return(

<div>

<h2>Register</h2>

<input
placeholder="Name"
onChange={(e)=>setName(e.target.value)}
/>

<input
placeholder="Email"
onChange={(e)=>setEmail(e.target.value)}
/>

<input
placeholder="Password"
type="password"
onChange={(e)=>setPassword(e.target.value)}
/>

<button onClick={register}>
Register
</button>

</div>

)

}