import { Routes,Route } from "react-router-dom";

import Login from "./Auth/Login";
import Register from "./Auth/Register";
import Dashboard from "./Pages/Dashboard";
import Map from "./Pages/Map";

function App(){

return(

<Routes>

<Route path="/" element={<Login/>}/>
<Route path="/register" element={<Register/>}/>
<Route path="/dashboard" element={<Dashboard/>}/>
<Route path="/map" element={<Map/>}/>

</Routes>

)

}

export default App