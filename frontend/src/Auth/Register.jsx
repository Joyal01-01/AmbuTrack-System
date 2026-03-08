import { useState } from "react";
import api from "../api";
import { useNavigate, Link } from "react-router-dom";

export default function Register(){

	const navigate = useNavigate();

	const [name,setName]=useState("");
	const [email,setEmail]=useState("");
	const [password,setPassword]=useState("");
	const [role,setRole]=useState('patient');
	const [otp,setOtp]=useState("");
	const [otpSent,setOtpSent]=useState(false);
	const [sending,setSending]=useState(false);

	async function sendOtp(){
		if(!email) return alert('Enter email');
		try{
			setSending(true);
			const res = await api.post('/send-otp',{ email });
			if(res.data){
				// Prefer server-provided message
				if(res.data.emailed) alert('OTP sent to ' + email);
				else if(res.data.otp) alert('OTP (dev): ' + res.data.otp);
				else alert('OTP requested — check your email');
				setOtpSent(true);
			}else{
				alert('Unexpected response from server');
			}
		}catch(err){
			const msg = err?.response?.data || err.message || 'Failed to send OTP';
			alert('Failed to send OTP: ' + msg);
		}finally{ setSending(false); }
	}

	const register = async ()=>{
		try{
			if(!otpSent) return alert('Send OTP first');
			const res = await api.post("/register",{ name, email, password, role, otp });
			alert(res?.data?.message || 'Registered Successfully — please login');
			navigate("/");
		}catch(err){
			const msg = err?.response?.data || err.message || 'Registration failed';
			alert('Error: ' + JSON.stringify(msg));
		}
	}

	return(
		<div style={{maxWidth:520, margin:'40px auto', padding:18}}>
			<div className="center-card">
				<div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between'}}>
					<h2 style={{margin:0}}>Create account</h2>
					<div>
						<Link to="/">Login</Link>
						<Link to="/register" style={{marginLeft:8}}>Register</Link>
					</div>
				</div>

				<input placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
				<input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
				<div style={{display:'flex',gap:8,alignItems:'center'}}>
					<input placeholder="OTP" value={otp} onChange={(e)=>setOtp(e.target.value)} style={{flex:1}} />
					<button onClick={sendOtp} disabled={sending} className="btn btn-outline">{sending ? 'Sending…' : (otpSent ? 'Resend OTP' : 'Send OTP')}</button>
				</div>
				<input placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />

				<div style={{margin:10}}>
					<label style={{marginRight:8}}>Role:</label>
					<select value={role} onChange={e=>setRole(e.target.value)}>
						<option value="patient">Patient</option>
						<option value="driver">Driver</option>
						<option value="admin">Admin</option>
					</select>
					<div style={{fontSize:12,color:'#556', marginTop:6}}>Note: role is kept locally in this demo.</div>
				</div>

				<div style={{display:'flex',gap:8}}>
					<button onClick={register} className="btn">Register</button>
					<Link to="/" className="btn btn-ghost">Back to login</Link>
				</div>
			</div>
		</div>
	)

}