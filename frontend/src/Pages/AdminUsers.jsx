import { useEffect, useState } from 'react'
import api from '../api'
import Navbar from '../component/Navbar'

export default function AdminUsers() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    api.get('/admin/users').then(res => setUsers(res.data))
  }, [])

  return (
    <>
      <Navbar />
      <h2>All Users</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Name</th><th>Email</th><th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}