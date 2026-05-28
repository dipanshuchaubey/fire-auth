'use client'

import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { useState } from 'react'
import { app } from '../auth' // Initialize Firebase app

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const auth = getAuth(app)
    createUserWithEmailAndPassword(auth, email, password)
      .then(userCredential => {
        const user = userCredential.user
        console.log(user)
      })
      .catch(error => {
        const errorCode = error.code
        const errorMessage = error.message
        console.error(errorCode, errorMessage)
        setError(errorMessage)
      })
  }

  return (
    <Box
      component="form"
      sx={{
        '& .MuiTextField-root': { m: 1, width: '25ch' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        mt: 4
      }}
      autoComplete="off"
      onSubmit={handleSubmit}
    >
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div>
        <TextField
          name="email"
          required
          id="email-input"
          label="Email"
          type="email"
          variant="outlined"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div>
        <TextField
          name="password"
          required
          id="password-input"
          label="Password"
          type="password"
          autoComplete="new-password"
          variant="outlined"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      <Button type="submit" variant="contained" sx={{ mt: 2 }}>
        Sign Up
      </Button>
    </Box>
  )
}
