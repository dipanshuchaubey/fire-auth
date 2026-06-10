"use client"

import { useState, useEffect } from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import Paper from "@mui/material/Paper"
import Container from "@mui/material/Container"
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "firebase/auth"
import { app } from "./auth"
import { useRouter } from "next/navigation"

export default function Home() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const auth = getAuth(app)
  const provider = new GoogleAuthProvider()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        router.push("/admin")
      }
    })
    return () => unsubscribe()
  }, [auth, router])

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)

    try {
      await signInWithPopup(auth, provider)
      router.push("/admin")
    } catch (err: any) {
      let errorMessage = err.message || "Failed to sign in"
      
      // Beautify Firebase Cloud Function errors
      if (errorMessage.includes("User is not invited") || errorMessage.includes("Only @gmail.com accounts")) {
        errorMessage = "Your email address has not been invited yet. Please contact an administrator."
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        background:
          "radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0f0c29 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            borderRadius: "24px",
            backgroundColor: "rgba(17, 12, 40, 0.75)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}
        >
          <Box
            sx={{
              width: 50,
              height: 50,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.4)"
            }}
          >
            <Typography
              variant="h5"
              sx={{ color: "white", fontWeight: "bold" }}
            >
              F
            </Typography>
          </Box>

          <Typography
            variant="h4"
            sx={{ color: "white", fontWeight: 800, mb: 1, letterSpacing: -0.5 }}
          >
            Welcome Back
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(255, 255, 255, 0.5)", mb: 3 }}
          >
            Sign in to access your tenant dashboard
          </Typography>

          {error && (
            <Box
              sx={{
                width: "100%",
                p: 1.5,
                mb: 2,
                borderRadius: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: "0.875rem",
                textAlign: "center"
              }}
            >
              {error}
            </Box>
          )}

          <Box sx={{ width: "100%", mt: 2 }}>
            <Button
              fullWidth
              variant="contained"
              disabled={loading}
              onClick={handleGoogleSignIn}
              sx={{
                py: 1.5,
                borderRadius: "12px",
                fontWeight: "bold",
                textTransform: "none",
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                boxShadow: "0 4px 15px rgba(168, 85, 247, 0.3)",
                transition: "all 0.2s",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)",
                  transform: "translateY(-1px)",
                  boxShadow: "0 6px 20px rgba(168, 85, 247, 0.4)"
                }
              }}
            >
              {loading ? "Signing in..." : "Sign in with Google"}
            </Button>
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button
                onClick={() => router.push("/signup")}
                sx={{
                  color: "rgba(255, 255, 255, 0.6)",
                  textTransform: "none",
                  fontSize: "0.85rem",
                  "&:hover": { color: "white", backgroundColor: "transparent" }
                }}
              >
                Don't have an account? Sign Up
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}
