'use client'

import { useEffect, useState } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { app as firebaseApp } from '../auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'

// API host
const API_URL = 'http://localhost:8000/api'

interface User {
  uid: string
  email: string
  role: string
  disabled: boolean
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null)

  const auth = getAuth(firebaseApp)

  const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/users`, { headers })

      if (!res.ok) {
        if (res.status === 403)
          throw new Error(
            'Forbidden: You need admin rights to view this dashboard.'
          )
        throw new Error('Failed to fetch users')
      }

      const data = await res.json()
      setUsers(data.users)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        fetchUsers()
      } else {
        setLoading(false)
        setError('You are not logged in.')
      }
    })

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLastInviteLink(null)
    setError(null)

    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/users/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      })

      if (!res.ok) throw new Error('Failed to invite user')

      const data = await res.json()
      setLastInviteLink(data.invite_link)
      setInviteEmail('')
      fetchUsers() // Refresh user list
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    }
  }

  const handleRoleChange = async (uid: string, newRole: string) => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/users/${uid}/role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role: newRole })
      })

      if (!res.ok) throw new Error('Failed to update role')

      // Update local state instead of doing a full fetch to be faster
      setUsers(users.map(u => (u.uid === uid ? { ...u, role: newRole } : u)))
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    }
  }

  if (loading)
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading...</Typography>
      </Box>
    )
  if (error && users.length === 0)
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    )

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Admin Dashboard
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {/* Invite Section */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Invite New User
        </Typography>
        <Box
          component="form"
          onSubmit={handleInvite}
          sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}
        >
          <TextField
            required
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            size="small"
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={inviteRole}
              label="Role"
              onChange={e => setInviteRole(e.target.value)}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </Select>
          </FormControl>
          <Button type="submit" variant="contained">
            Send Invite
          </Button>
        </Box>

        {lastInviteLink && (
          <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="success.main">
              User Created!
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              <strong>Setup Password Link:</strong>{' '}
              <a href={lastInviteLink} target="_blank">
                {lastInviteLink}
              </a>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (In a real app, this link would be automatically emailed to the
              user.)
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Users Table */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Manage Users
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>User ID</TableCell>
              <TableCell>Role</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.uid}>
                <TableCell>{user.email}</TableCell>
                <TableCell
                  sx={{ color: 'text.secondary', fontSize: '0.85rem' }}
                >
                  {user.uid}
                </TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={user.role}
                      onChange={e => handleRoleChange(user.uid, e.target.value)}
                      disabled={user.disabled}
                    >
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="editor">Editor</MenuItem>
                      <MenuItem value="user">User</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
