import { Link } from 'react-router-dom'

export default function Navbar() {
  const user = JSON.parse(localStorage.getItem('user'))

  return (
    <nav>
      <Link to="/">Dashboard</Link>
      {user?.role === 'admin' && <Link to="/admin/users">Users</Link>}
      <button onClick={() => {
        localStorage.clear()
        window.location.reload()
      }}>Logout</button>
    </nav>
  )
}