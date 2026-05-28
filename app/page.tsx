'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { app } from './auth' // Initialize Firebase app

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const auth = getAuth(app)

    signInWithEmailAndPassword(auth, email, password)
      .then(userCredential => {
        const user = userCredential.user
        console.log(user)
      })
      .catch(error => {
        const errorCode = error.code
        const errorMessage = error.message
        setError(errorMessage)
        console.log(errorCode, errorMessage)
      })
  }

  return (
    <Box
      component="form"
      sx={{ '& .MuiTextField-root': { m: 1, width: '25ch' } }}
      autoComplete="off"
      onSubmit={handleSubmit}
    >
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div>
        <TextField
          name="email"
          required
          id="outlined-required"
          label="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <TextField
          name="password"
          required
          id="filled-password-input"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      <Button type="submit" variant="contained">
        Login
      </Button>
    </Box>
  )
}
