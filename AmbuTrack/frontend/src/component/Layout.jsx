import {Link} from "react-router-dom"

export default function Layout({children}){

return(

<div>

<nav className="navbar">

<h2>AmbuTrack</h2>

<div>

<Link to="/dashboard">Dashboard</Link>
<Link to="/profile">Profile</Link>
<Link to="/settings">Settings</Link>

</div>

</nav>

<div className="content">
{children}
</div>

</div>

)

}