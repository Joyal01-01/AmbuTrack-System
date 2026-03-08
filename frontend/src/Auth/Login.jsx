import { useState } from "react";
import api from "../api";
import { useNavigate, Link } from "react-router-dom";
import { socket } from "../socket";

export default function Login(){

	const navigate = useNavigate();

	const [email,setEmail]=useState("");
	const [password,setPassword]=useState("");
	const [role,setRole]=useState('patient');
	const [twofa, setTwofa] = useState(false);
	const [otp, setOtp] = useState('');
	const [pendingEmail, setPendingEmail] = useState(null);
	const [twofaMessage, setTwofaMessage] = useState('');

	const login = async ()=>{
		try{
			const res = await api.post("/login",{ email, password });

			if(res.data && res.data.twofa){
				// server requires two-factor verification
				setTwofa(true);
				setPendingEmail(email);
				setTwofaMessage(res.data.message || 'Enter the OTP sent to your email');
				return;
			}

			if(res.data && typeof res.data === 'object'){
				const user = { ...res.data, role: res.data.role || role };
				localStorage.setItem("user",JSON.stringify(user));

				try{ socket.emit('identify', { name: user.name, role: user.role, token: user.token }) }catch(e){}

				navigate("/dashboard");
			}else{
				alert("Invalid Login")
			}

		}catch(err){
			const msg = err?.response?.data || err.message || 'Server Error';
			alert('Login failed: ' + JSON.stringify(msg));
		}
	}

	const verifyOtp = async ()=>{
		try{
			if(!pendingEmail) return;
			const res = await api.post('/login-verify', { email: pendingEmail, otp });
			if(res.data && typeof res.data === 'object'){
				const user = { ...res.data };
				localStorage.setItem('user', JSON.stringify(user));
				try{ socket.emit('identify', { name: user.name, role: user.role, token: user.token }) }catch(e){}
				navigate('/dashboard');
			}else{
				alert('Invalid OTP');
			}
		}catch(e){ alert('OTP verify failed') }
	}

	return(
		<div style={{maxWidth:520, margin:'48px auto', padding:18}}>
			<div className="center-card">
				<div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between'}}>
					<h2 style={{margin:0}}>Login</h2>
					<div>
						<Link to="/" style={{marginRight:8}}>Login</Link>
						<Link to="/register">Register</Link>
					</div>
				</div>

				<input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
				<input placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />

				<div style={{margin:10}}>
					<label style={{marginRight:8}}>Role:</label>
					<select value={role} onChange={e=>setRole(e.target.value)}>
						<option value="patient">Patient</option>
						<option value="driver">Driver</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<div style={{display:'flex',gap:8}}>
					{!twofa ? (
						<>
							<button className="btn" onClick={login}>Login</button>
							<Link to="/register" className="btn btn-outline" style={{alignSelf:'center'}}>Create account</Link>
						</>
					) : (
						<>
							<div style={{display:'flex',flexDirection:'column',gap:8}}>
								<div style={{color:'#a00'}}>{twofaMessage}</div>
								<input placeholder="OTP" value={otp} onChange={e=>setOtp(e.target.value)} />
								<div style={{display:'flex',gap:8}}>
									<button className="btn" onClick={verifyOtp}>Verify OTP</button>
									<button className="btn btn-ghost" onClick={()=>{ setTwofa(false); setOtp(''); setPendingEmail(null); }}>Cancel</button>
								</div>
							</div>
						</>
					)}
				</div>

			</div>
		</div>
	)

}