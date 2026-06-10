'use client'

import { useEffect, useState } from 'react'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { app as firebaseApp } from '../auth'
import { useRouter } from 'next/navigation'
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
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'

const API_URL = 'http://localhost:8000/api'

interface UserProfile {
  uid: string
  email: string
  role: string
  tenant_id: string
  blocked_features: string[]
  tenant_features: string[]
  tenant_name: string
}

interface UserListItem {
  uid: string
  email: string
  role: string
  tenant_id: string
  blocked_features: string[]
  disabled: boolean
}

interface Tenant {
  id: string
  name: string
  features: string[]
}

interface Resource {
  id: string
  name: string
  tenant_id: string
  owner_id: string
  is_public: boolean
}

interface LogEntry {
  timestamp: string
  action: string
  endpoint: string
  status: number | string
  details: string
  error: boolean
}

const AVAILABLE_FEATURES = [
  {
    id: 'read_resource',
    name: 'Read Resources',
    desc: 'Allows viewing tenant resources'
  },
  {
    id: 'create_resource',
    name: 'Create Resource',
    desc: 'Allows creating new resources'
  },
  {
    id: 'delete_resource',
    name: 'Delete Resource',
    desc: 'Allows removing resources'
  },
  {
    id: 'premium_analytics',
    name: 'Premium Analytics',
    desc: 'Enterprise chart metrics'
  },
  { id: 'export_data', name: 'Export Data', desc: 'CSV download capabilities' }
]

export default function AdminDashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [users, setUsers] = useState<UserListItem[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  // Sandbox inputs
  const [newResName, setNewResName] = useState('')
  const [newResPublic, setNewResPublic] = useState(false)

  // Invite user inputs
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [inviteBlocked, setInviteBlocked] = useState<string[]>([])
  const [lastInviteSuccess, setLastInviteSuccess] = useState<boolean>(false)

  const auth = getAuth(firebaseApp)
  const router = useRouter()

  const logAction = (
    action: string,
    endpoint: string,
    status: number | string,
    details: any,
    error = false
  ) => {
    const stringDetails = typeof details === 'string' ? details : JSON.stringify(details);
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      action,
      endpoint,
      status,
      details: stringDetails,
      error
    }
    setLogs(prev => [entry, ...prev].slice(0, 30))
  }

  const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  const fetchProfileAndData = async () => {
    try {
      setLoading(true)
      const headers = await getHeaders()

      // 1. Fetch current profile
      const profileRes = await fetch(`${API_URL}/users/me/profile`, { headers })
      if (!profileRes.ok) {
        logAction(
          'Fetch Profile',
          '/users/me/profile',
          profileRes.status,
          'Failed to fetch active profile',
          true
        )
        throw new Error('Failed to load profile context.')
      }
      const profileData = await profileRes.json()
      setProfile(profileData)
      logAction(
        'Fetch Profile',
        '/users/me/profile',
        200,
        `Loaded profile. Role: ${profileData.role}, Tenant: ${profileData.tenant_id}`
      )

      // 2. Fetch tenants list
      const tenantsRes = await fetch(`${API_URL}/users/tenants`, { headers })
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json()
        setTenants(tenantsData.tenants)
      }

      // 3. Fetch resources (if allowed)
      await fetchResources(headers)

      // 4. Fetch users list (admin only)
      if (profileData.role === 'admin') {
        await fetchUsers(headers)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchResources = async (headers: any) => {
    try {
      const res = await fetch(`${API_URL}/resources`, { headers })
      if (res.ok) {
        const data = await res.json()
        setResources(data.resources)
        logAction(
          'Fetch Resources',
          '/resources',
          200,
          `Loaded ${data.resources.length} resources`
        )
      } else {
        const errData = await res.json().catch(() => ({}))
        logAction(
          'Fetch Resources',
          '/resources',
          res.status,
          errData.detail || 'Could not fetch resources',
          true
        )
        setResources([])
      }
    } catch (err) {
      logAction(
        'Fetch Resources',
        '/resources',
        'Network Error',
        'Network failure',
        true
      )
    }
  }

  const fetchUsers = async (headers: any) => {
    try {
      const res = await fetch(`${API_URL}/users`, { headers })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        logAction(
          'Fetch Users',
          '/users',
          200,
          `Loaded ${data.users.length} users`
        )
      } else {
        const errData = await res.json().catch(() => ({}))
        logAction(
          'Fetch Users',
          '/users',
          res.status,
          errData.detail || 'Could not load users directory',
          true
        )
      }
    } catch (err) {
      logAction(
        'Fetch Users',
        '/users',
        'Network Error',
        'Network failure',
        true
      )
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        fetchProfileAndData()
      } else {
        router.push('/')
      }
    })
    return () => unsubscribe()
  }, [])

  // ABAC Client Evaluation
  const hasLocalAccess = (
    action: string,
    resourceOwnerId?: string,
    isPublic = false
  ) => {
    if (!profile) return false

    // 1. Blocklist check
    if (profile.blocked_features.includes(action)) return false

    // 2. Tenant features check
    const mappedFeatures: Record<string, string> = {
      read_resource: 'read_resources',
      create_resource: 'read_resources',
      delete_resource: 'read_resources',
      premium_analytics: 'premium_analytics',
      export_data: 'export_data'
    }
    const reqFeature = mappedFeatures[action]
    if (reqFeature && !profile.tenant_features.includes(reqFeature))
      return false

    // 3. Invite check
    if (action === 'invite_user' || action === 'manage_tenant') {
      return profile.role === 'admin'
    }

    // 4. Resource ownership check
    if (resourceOwnerId) {
      if (isPublic && action === 'read_resource') return true
      if (profile.role === 'admin') return true
      if (action === 'delete_resource') {
        return profile.role === 'editor' && resourceOwnerId === profile.uid
      }
      if (action === 'read_resource') {
        return (
          profile.role === 'editor' ||
          (profile.role === 'user' && resourceOwnerId === profile.uid)
        )
      }
      if (action === 'export_data') {
        return profile.role === 'editor'
      }
    }

    return true
  }

  // Handle Resource Creation
  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newResName) return
    setError(null)

    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/resources`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newResName, is_public: newResPublic })
      })

      const data = await res.json()
      if (res.ok) {
        logAction(
          'Create Resource',
          '/resources',
          200,
          `Created resource: ${newResName} (ID: ${data.resource_id})`
        )
        setNewResName('')
        setNewResPublic(false)
        fetchResources(headers)
      } else {
        logAction(
          'Create Resource',
          '/resources',
          res.status,
          data.detail || 'Authorization Failed',
          true
        )
        setError(data.detail)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Handle Resource Deletion
  const handleDeleteResource = async (resId: string) => {
    setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/resources/${resId}`, {
        method: 'DELETE',
        headers
      })

      const data = await res.json()
      if (res.ok) {
        logAction(
          'Delete Resource',
          `/resources/${resId}`,
          200,
          `Deleted resource: ${resId}`
        )
        fetchResources(headers)
      } else {
        logAction(
          'Delete Resource',
          `/resources/${resId}`,
          res.status,
          data.detail || 'Deletion Failed',
          true
        )
        setError(data.detail)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Handle Resource Export
  const handleExportResource = async (resId: string) => {
    setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/resources/${resId}/export`, {
        headers
      })

      const data = await res.json()
      if (res.ok) {
        logAction(
          'Export Data',
          `/resources/${resId}/export`,
          200,
          `Export success! Data:\n${data.csv}`
        )
        alert(
          `Export success! File: ${data.filename}\n\nCSV Content:\n${data.csv}`
        )
      } else {
        logAction(
          'Export Data',
          `/resources/${resId}/export`,
          res.status,
          data.detail || 'Export Failed',
          true
        )
        setError(data.detail)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Handle Premium Analytics Load
  const handleLoadAnalytics = async () => {
    setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/resources/analytics`, { headers })

      const data = await res.json()
      if (res.ok) {
        logAction(
          'Load Premium Analytics',
          `/resources/analytics`,
          200,
          'Loaded analytics database values.'
        )
        alert('Premium Chart Loaded Successfully! check logs for details.')
      } else {
        logAction(
          'Load Premium Analytics',
          `/resources/analytics`,
          res.status,
          data.detail || 'Analytics Access Denied',
          true
        )
        setError(data.detail)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Handle Invite User
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLastInviteSuccess(false)
    setError(null)

    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/users/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          blocked_features: inviteBlocked
        })
      })

      const data = await res.json()
      if (res.ok) {
        logAction(
          'Invite User',
          '/users/invite',
          200,
          `Invited ${inviteEmail}`
        )
        setLastInviteSuccess(true)
        setInviteEmail('')
        setInviteBlocked([])
        fetchUsers(headers)
      } else {
        logAction(
          'Invite User',
          '/users/invite',
          res.status,
          data.detail || 'Invite failed',
          true
        )
        setError(data.detail)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Handle Update User Attributes
  const handleUpdateUserClaims = async (
    uid: string,
    role: string,
    tenantId: string,
    blocked: string[]
  ) => {
    setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/users/${uid}/claims`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          role,
          tenant_id: tenantId,
          blocked_features: blocked
        })
      })

      const data = await res.json()
      if (res.ok) {
        logAction(
          'Update User Claims',
          `/users/${uid}/claims`,
          200,
          `Claims/DB updated for user ${uid}.`
        )
        fetchUsers(headers)
        if (uid === profile?.uid) {
          // If updating current user, refresh profile
          fetchProfileAndData()
        }
      } else {
        logAction(
          'Update User Claims',
          `/users/${uid}/claims`,
          res.status,
          data.detail || 'Claims update failed',
          true
        )
        setError(data.detail)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Toggle user blocked feature
  const handleToggleUserBlock = (user: UserListItem, featureId: string) => {
    const isCurrentlyBlocked = user.blocked_features.includes(featureId)
    const newBlocked = isCurrentlyBlocked
      ? user.blocked_features.filter(f => f !== featureId)
      : [...user.blocked_features, featureId]

    handleUpdateUserClaims(user.uid, user.role, user.tenant_id, newBlocked)
  }

  // Toggle tenant features
  const handleToggleTenantFeature = async (
    tenant: Tenant,
    featureId: string
  ) => {
    setError(null)
    const hasFeature = tenant.features.includes(featureId)
    const newFeatures = hasFeature
      ? tenant.features.filter(f => f !== featureId)
      : [...tenant.features, featureId]

    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/users/tenants/${tenant.id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: tenant.name, features: newFeatures })
      })

      const data = await res.json()
      if (res.ok) {
        logAction(
          'Update Tenant Plan',
          `/users/tenants/${tenant.id}`,
          200,
          `Updated plan ${tenant.id} features to: [${newFeatures.join(', ')}]`
        )
        // Refresh tenants list
        const tenantsRes = await fetch(`${API_URL}/users/tenants`, { headers })
        if (tenantsRes.ok) {
          const tenantsData = await tenantsRes.json()
          setTenants(tenantsData.tenants)
        }
        // Refresh current profile to fetch new active features
        const profileRes = await fetch(`${API_URL}/users/me/profile`, {
          headers
        })
        if (profileRes.ok) {
          setProfile(await profileRes.json())
        }
      } else {
        logAction(
          'Update Tenant Plan',
          `/users/tenants/${tenant.id}`,
          res.status,
          data.detail || 'Tenant settings update denied',
          true
        )
        setError(data.detail)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/')
  }

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0b081e',
          color: 'white'
        }}
      >
        <Typography variant="h6">Configuring secure environment...</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{ bgcolor: '#0b081e', minHeight: '100vh', color: '#e0e0e6', pb: 8 }}
    >
      {/* Top Navbar */}
      <Box
        sx={{
          backdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(11, 8, 30, 0.75)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          px: 4,
          py: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: '#a855f7',
              boxShadow: '0 0 10px #a855f7'
            }}
          />
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, letterSpacing: -0.5 }}
          >
            Antigravity ABAC Console
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {profile && (
            <Chip
              label={`${profile.email} (${profile.role.toUpperCase()})`}
              sx={{
                bgcolor: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                fontWeight: 600
              }}
            />
          )}
          <Button
            onClick={handleLogout}
            variant="outlined"
            color="secondary"
            size="small"
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* Hero Header */}
      <Box
        sx={{
          p: 4,
          background:
            'linear-gradient(180deg, rgba(124, 58, 237, 0.05) 0%, rgba(11, 8, 30, 0) 100%)'
        }}
      >
        <Grid container spacing={3} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                mb: 1,
                background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Multi-Tenant ABAC Sandbox
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
            >
              Test attribute-level overrides, role restrictions, and tenant
              flags in real-time. See the live developer console capture backend
              DB validations.
            </Typography>
          </Grid>

          {/* Active Profile Info */}
          {profile && (
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px'
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: '#a855f7',
                      fontWeight: 700,
                      mb: 1,
                      textTransform: 'uppercase'
                    }}
                  >
                    Active User Claims (JWT)
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ color: 'white', fontWeight: 700 }}
                  >
                    {profile.tenant_name}
                  </Typography>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 2 }}
                  >
                    Tenant ID:{' '}
                    <code style={{ color: '#818cf8' }}>
                      {profile.tenant_id}
                    </code>{' '}
                    | Role:{' '}
                    <Chip
                      label={profile.role}
                      size="small"
                      sx={{
                        height: 20,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  </Typography>
                  <Divider
                    sx={{ my: 1.5, borderColor: 'rgba(255, 255, 255, 0.08)' }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.4)',
                      display: 'block',
                      mb: 0.5
                    }}
                  >
                    Tenant Plan Features (DB-backed):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {profile.tenant_features.map(f => (
                      <Chip
                        key={f}
                        label={f}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.7rem',
                          bgcolor: 'rgba(34, 197, 94, 0.1)',
                          color: '#4ade80',
                          border: '1px solid rgba(34, 197, 94, 0.2)'
                        }}
                      />
                    ))}
                  </Box>
                  {profile.blocked_features.length > 0 && (
                    <>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'rgba(255, 255, 255, 0.4)',
                          display: 'block',
                          mt: 1.5,
                          mb: 0.5
                        }}
                      >
                        Explicit User Blocks (DB-backed):
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {profile.blocked_features.map(f => (
                          <Chip
                            key={f}
                            label={f}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.7rem',
                              bgcolor: 'rgba(239, 68, 68, 0.1)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}
                          />
                        ))}
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Tabs Layout */}
      <Box sx={{ px: 4, mt: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            mb: 4,
            '& .MuiTabs-indicator': { bgcolor: '#a855f7' },
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              '&.Mui-selected': { color: '#a855f7' }
            }
          }}
        >
          <Tab label="ABAC Sandbox" />
          <Tab label="User Directory" disabled={profile?.role !== 'admin'} />
          <Tab
            label="Tenant Plans (Admin)"
            disabled={profile?.role !== 'admin'}
          />
        </Tabs>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 4,
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
            onClose={() => setError(null)}
          >
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </Alert>
        )}

        <Grid container spacing={4}>
          {/* Main content pane */}
          <Grid size={{ xs: 12, md: 8.5 }}>
            {/* TAB 0: ABAC SANDBOX */}
            {activeTab === 0 && (
              <Box>
                <Grid container spacing={3}>
                  {/* Create Artifact */}
                  <Grid size={{ xs: 12 }}>
                    <Card
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '16px'
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Typography
                          variant="h6"
                          sx={{ color: 'white', fontWeight: 700, mb: 2 }}
                        >
                          Create Resource Artifact
                        </Typography>

                        {/* Check if local ABAC says allowed */}
                        {!hasLocalAccess('create_resource') && (
                          <Alert
                            severity="warning"
                            sx={{
                              mb: 2,
                              bgcolor: 'rgba(217, 119, 6, 0.1)',
                              color: '#fbbf24',
                              border: '1px solid rgba(217, 119, 6, 0.2)'
                            }}
                          >
                            ABAC Rules: Your tenant plan or user blocks do not
                            permit resource creation. The button below is
                            locked.
                          </Alert>
                        )}

                        <Box
                          component="form"
                          onSubmit={handleCreateResource}
                          sx={{ display: 'flex', gap: 2, alignItems: 'center' }}
                        >
                          <TextField
                            required
                            label="Artifact Name"
                            value={newResName}
                            onChange={e => setNewResName(e.target.value)}
                            size="small"
                            disabled={!hasLocalAccess('create_resource')}
                            slotProps={{
                              input: { style: { color: 'white' } },
                              inputLabel: {
                                style: { color: 'rgba(255, 255, 255, 0.4)' }
                              }
                            }}
                            sx={{
                              flexGrow: 1,
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                '& fieldset': {
                                  borderColor: 'rgba(255, 255, 255, 0.1)'
                                }
                              }
                            }}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={newResPublic}
                                onChange={e =>
                                  setNewResPublic(e.target.checked)
                                }
                                disabled={!hasLocalAccess('create_resource')}
                                sx={{
                                  color: 'rgba(255,255,255,0.2)',
                                  '&.Mui-checked': { color: '#a855f7' }
                                }}
                              />
                            }
                            label="Publicly Readable"
                            sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
                          />
                          <Button
                            type="submit"
                            variant="contained"
                            disabled={!hasLocalAccess('create_resource')}
                            sx={{
                              borderRadius: '10px',
                              textTransform: 'none',
                              background:
                                'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                              fontWeight: 'bold'
                            }}
                          >
                            Save Artifact
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Artifacts list */}
                  <Grid size={{ xs: 12 }}>
                    <Card
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '16px'
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Typography
                          variant="h6"
                          sx={{ color: 'white', fontWeight: 700, mb: 2 }}
                        >
                          Tenant Resource Artifacts ({resources.length})
                        </Typography>

                        {resources.length === 0 ? (
                          <Typography
                            sx={{
                              color: 'rgba(255, 255, 255, 0.4)',
                              py: 4,
                              textAlign: 'center'
                            }}
                          >
                            No artifacts visible. (Either you have no resources,
                            or read access is blocked).
                          </Typography>
                        ) : (
                          <TableContainer
                            component={Paper}
                            sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                          >
                            <Table size="small">
                              <TableHead>
                                <TableRow
                                  sx={{
                                    '& th': {
                                      borderBottom:
                                        '1px solid rgba(255,255,255,0.08)',
                                      color: 'rgba(255,255,255,0.4)',
                                      fontWeight: 600
                                    }
                                  }}
                                >
                                  <TableCell>Artifact Name</TableCell>
                                  <TableCell>Resource ID</TableCell>
                                  <TableCell>Owner UID</TableCell>
                                  <TableCell>Access Mode</TableCell>
                                  <TableCell align="right">
                                    ABAC Operations
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {resources.map(res => {
                                  const canDelete = hasLocalAccess(
                                    'delete_resource',
                                    res.owner_id,
                                    res.is_public
                                  )
                                  const canExport = hasLocalAccess(
                                    'export_data',
                                    res.owner_id,
                                    res.is_public
                                  )
                                  return (
                                    <TableRow
                                      key={res.id}
                                      sx={{
                                        '& td': {
                                          borderBottom:
                                            '1px solid rgba(255,255,255,0.05)',
                                          color: 'rgba(255,255,255,0.8)'
                                        }
                                      }}
                                    >
                                      <TableCell sx={{ fontWeight: 'bold' }}>
                                        {res.name}
                                      </TableCell>
                                      <TableCell>
                                        <code>{res.id}</code>
                                      </TableCell>
                                      <TableCell
                                        sx={{
                                          color: 'rgba(255,255,255,0.5)',
                                          fontSize: '0.8rem'
                                        }}
                                      >
                                        {res.owner_id}
                                      </TableCell>
                                      <TableCell>
                                        <Chip
                                          label={
                                            res.is_public
                                              ? 'Public'
                                              : 'Tenant Private'
                                          }
                                          size="small"
                                          sx={{
                                            bgcolor: res.is_public
                                              ? 'rgba(59, 130, 246, 0.1)'
                                              : 'rgba(168, 85, 247, 0.1)',
                                            color: res.is_public
                                              ? '#60a5fa'
                                              : '#c084fc',
                                            border: `1px solid ${
                                              res.is_public
                                                ? 'rgba(59, 130, 246, 0.2)'
                                                : 'rgba(168, 85, 247, 0.2)'
                                            }`
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell align="right">
                                        <Box
                                          sx={{
                                            display: 'flex',
                                            gap: 1,
                                            justifyContent: 'flex-end'
                                          }}
                                        >
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={!canExport}
                                            onClick={() =>
                                              handleExportResource(res.id)
                                            }
                                            sx={{
                                              textTransform: 'none',
                                              borderRadius: '6px'
                                            }}
                                          >
                                            Export
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            disabled={!canDelete}
                                            onClick={() =>
                                              handleDeleteResource(res.id)
                                            }
                                            sx={{
                                              textTransform: 'none',
                                              borderRadius: '6px'
                                            }}
                                          >
                                            Delete
                                          </Button>
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Premium Feature Playground */}
                  <Grid size={{ xs: 12 }}>
                    <Card
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '16px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Lock Screen if Analytics Blocked */}
                      {!hasLocalAccess('premium_analytics') && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: 'rgba(11, 8, 30, 0.85)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 4,
                            textAlign: 'center'
                          }}
                        >
                          <Box
                            sx={{
                              width: 50,
                              height: 50,
                              borderRadius: '50%',
                              bgcolor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyItems: 'center',
                              justifyContent: 'center',
                              mb: 2
                            }}
                          >
                            <Typography
                              sx={{
                                color: '#f87171',
                                fontWeight: 'bold',
                                fontSize: '1.5rem'
                              }}
                            >
                              🔒
                            </Typography>
                          </Box>
                          <Typography
                            variant="h6"
                            sx={{ color: 'white', fontWeight: 800, mb: 1 }}
                          >
                            Premium Feature Locked
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'rgba(255, 255, 255, 0.5)',
                              maxWidth: 400,
                              mb: 2
                            }}
                          >
                            Evaluating ABAC attributes: Either your tenant is
                            not Enterprise level, or your specific account is
                            blocked from viewing charts.
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={handleLoadAnalytics}
                            sx={{ textTransform: 'none', borderRadius: '8px' }}
                          >
                            Force Fetch API anyway (Test 403)
                          </Button>
                        </Box>
                      )}

                      <CardContent sx={{ p: 4 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 3
                          }}
                        >
                          <Typography
                            variant="h6"
                            sx={{ color: 'white', fontWeight: 700 }}
                          >
                            Enterprise Sales Analytics
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={handleLoadAnalytics}
                            sx={{ textTransform: 'none', borderRadius: '8px' }}
                          >
                            Refresh Analytics
                          </Button>
                        </Box>

                        {/* Mock SVG Graph */}
                        <Box
                          sx={{
                            height: 160,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'space-around',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            pb: 1,
                            mb: 2
                          }}
                        >
                          {[
                            { m: 'Jan', val: 50, h: '50px', c: '#818cf8' },
                            { m: 'Feb', val: 80, h: '80px', c: '#a78bfa' },
                            { m: 'Mar', val: 120, h: '120px', c: '#c084fc' },
                            { m: 'Apr', val: 150, h: '150px', c: '#f472b6' }
                          ].map(item => (
                            <Box
                              key={item.m}
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 1
                              }}
                            >
                              <Box
                                sx={{
                                  width: 40,
                                  height: item.h,
                                  bgcolor: item.c,
                                  borderRadius: '6px 6px 0 0',
                                  boxShadow: `0 0 15px ${item.c}55`,
                                  transition: 'height 0.3s'
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{ color: 'rgba(255, 255, 255, 0.4)' }}
                              >
                                {item.m}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255,255,255,0.4)',
                            textAlign: 'center',
                            display: 'block'
                          }}
                        >
                          Simulated Enterprise KPI charts populated dynamically
                          using mock server responses.
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* TAB 1: USER POLICY DIRECTORY */}
            {activeTab === 1 && profile?.role === 'admin' && (
              <Box>
                {/* Invite User Card */}
                <Card
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    mb: 4
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Typography
                      variant="h6"
                      sx={{ color: 'white', fontWeight: 700, mb: 2 }}
                    >
                      Invite New User (Set Tenant & Role)
                    </Typography>

                    <Box component="form" onSubmit={handleInvite}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            required
                            fullWidth
                            label="Email Address"
                            type="email"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            size="small"
                            slotProps={{
                              input: { style: { color: 'white' } },
                              inputLabel: {
                                style: { color: 'rgba(255, 255, 255, 0.4)' }
                              }
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                '& fieldset': {
                                  borderColor: 'rgba(255, 255, 255, 0.1)'
                                }
                              }
                            }}
                          />
                        </Grid>

                        {/* Tenant ID is now automatically assigned from the admin's profile */}

                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel
                              sx={{ color: 'rgba(255, 255, 255, 0.4)' }}
                            >
                              User Role
                            </InputLabel>
                            <Select
                              value={inviteRole}
                              label="User Role"
                              onChange={e => setInviteRole(e.target.value)}
                              sx={{
                                color: 'white',
                                borderRadius: '10px',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: 'rgba(255,255,255,0.1)'
                                }
                              }}
                            >
                              <MenuItem value="admin">Admin</MenuItem>
                              <MenuItem value="editor">Editor</MenuItem>
                              <MenuItem value="user">User</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        {/* Block features checkboxes */}
                        <Grid size={{ xs: 12 }}>
                          <Typography
                            variant="body2"
                            sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}
                          >
                            Database User Blocks (Features to disable
                            immediately):
                          </Typography>
                          <Box
                            sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}
                          >
                            {AVAILABLE_FEATURES.map(feat => {
                              const isChecked = inviteBlocked.includes(feat.id)
                              return (
                                <FormControlLabel
                                  key={feat.id}
                                  control={
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={e => {
                                        setInviteBlocked(
                                          e.target.checked
                                            ? [...inviteBlocked, feat.id]
                                            : inviteBlocked.filter(
                                                f => f !== feat.id
                                              )
                                        )
                                      }}
                                      sx={{
                                        color: 'rgba(255,255,255,0.2)',
                                        '&.Mui-checked': { color: '#a855f7' }
                                      }}
                                    />
                                  }
                                  label={`${feat.name}`}
                                  sx={{ color: 'rgba(255,255,255,0.8)' }}
                                />
                              )
                            })}
                          </Box>
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                          <Button
                            type="submit"
                            variant="contained"
                            sx={{
                              borderRadius: '10px',
                              textTransform: 'none',
                              background:
                                'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                              fontWeight: 'bold',
                              py: 1
                            }}
                          >
                            Send Invite
                          </Button>
                        </Grid>
                      </Grid>
                    </Box>

                    {lastInviteSuccess && (
                      <Box
                        sx={{
                          p: 2.5,
                          mt: 3,
                          bgcolor: 'rgba(34, 197, 94, 0.08)',
                          border: '1px solid rgba(34, 197, 94, 0.2)',
                          borderRadius: '10px'
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ color: '#4ade80', fontWeight: 700, mb: 1 }}
                        >
                          User Successfully Invited!
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: 'rgba(255,255,255,0.8)' }}
                        >
                          The invitation has been securely saved. The user can now log in using Google Sign-In, and their account will automatically be linked to your tenant with the assigned role.
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>

                {/* Manage User DB Overrides list */}
                <Card
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Typography
                      variant="h6"
                      sx={{ color: 'white', fontWeight: 700, mb: 3 }}
                    >
                      User Policy Directory & Custom Claim Overrides
                    </Typography>

                    <TableContainer
                      component={Paper}
                      sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow
                            sx={{
                              '& th': {
                                borderBottom:
                                  '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.4)',
                                fontWeight: 600
                              }
                            }}
                          >
                            <TableCell>User Email</TableCell>
                            <TableCell>Claims Tenant ID</TableCell>
                            <TableCell>Claims Role</TableCell>
                            <TableCell>DB Blocked Features</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {users.map(u => (
                            <TableRow
                              key={u.uid}
                              sx={{
                                '& td': {
                                  borderBottom:
                                    '1px solid rgba(255,255,255,0.05)',
                                  color: 'rgba(255,255,255,0.8)',
                                  py: 2
                                }
                              }}
                            >
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                {u.email}
                                {u.uid === profile?.uid && (
                                  <Chip
                                    label="You"
                                    size="small"
                                    sx={{
                                      ml: 1,
                                      height: 18,
                                      bgcolor: 'rgba(168, 85, 247, 0.2)',
                                      color: '#c084fc'
                                    }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={u.tenant_id}
                                  onChange={e =>
                                    handleUpdateUserClaims(
                                      u.uid,
                                      u.role,
                                      e.target.value as string,
                                      u.blocked_features
                                    )
                                  }
                                  size="small"
                                  sx={{
                                    color: 'white',
                                    height: 30,
                                    fontSize: '0.85rem',
                                    borderRadius: '6px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'rgba(255,255,255,0.1)'
                                    }
                                  }}
                                >
                                  <MenuItem value="tenant-starter">
                                    tenant-starter
                                  </MenuItem>
                                  <MenuItem value="tenant-enterprise">
                                    tenant-enterprise
                                  </MenuItem>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={u.role}
                                  onChange={e =>
                                    handleUpdateUserClaims(
                                      u.uid,
                                      e.target.value as string,
                                      u.tenant_id,
                                      u.blocked_features
                                    )
                                  }
                                  size="small"
                                  sx={{
                                    color: 'white',
                                    height: 30,
                                    fontSize: '0.85rem',
                                    borderRadius: '6px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'rgba(255,255,255,0.1)'
                                    }
                                  }}
                                >
                                  <MenuItem value="admin">admin</MenuItem>
                                  <MenuItem value="editor">editor</MenuItem>
                                  <MenuItem value="user">user</MenuItem>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.5
                                  }}
                                >
                                  {AVAILABLE_FEATURES.map(feat => {
                                    const isBlocked =
                                      u.blocked_features.includes(feat.id)
                                    return (
                                      <FormControlLabel
                                        key={feat.id}
                                        control={
                                          <Checkbox
                                            checked={isBlocked}
                                            onChange={() =>
                                              handleToggleUserBlock(u, feat.id)
                                            }
                                            size="small"
                                            sx={{
                                              p: 0.5,
                                              color: 'rgba(255,255,255,0.2)',
                                              '&.Mui-checked': {
                                                color: '#f43f5e'
                                              }
                                            }}
                                          />
                                        }
                                        label={
                                          <span
                                            style={{
                                              fontSize: '0.75rem',
                                              color: isBlocked
                                                ? '#f43f5e'
                                                : 'rgba(255,255,255,0.6)'
                                            }}
                                          >
                                            Block {feat.name}
                                          </span>
                                        }
                                      />
                                    )
                                  })}
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* TAB 2: TENANT PLANS MANAGER */}
            {activeTab === 2 && profile?.role === 'admin' && (
              <Box>
                <Card
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Typography
                      variant="h6"
                      sx={{ color: 'white', fontWeight: 700, mb: 3 }}
                    >
                      Tenant Feature Plan Capabilities (Global DB Store)
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{ color: 'rgba(255,255,255,0.5)', mb: 3 }}
                    >
                      Enable or disable features globally for tenant plans.
                      Modifying these immediately affects all users in those
                      tenants.
                    </Typography>

                    {tenants.map(ten => (
                      <Box
                        key={ten.id}
                        sx={{
                          p: 3,
                          mb: 3,
                          borderRadius: '12px',
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)'
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ color: '#818cf8', fontWeight: 700, mb: 1 }}
                        >
                          {ten.name} (<code>{ten.id}</code>)
                        </Typography>
                        <Divider
                          sx={{
                            my: 1.5,
                            borderColor: 'rgba(255,255,255,0.08)'
                          }}
                        />
                        <Grid container spacing={2}>
                          {AVAILABLE_FEATURES.map(feat => {
                            // Map local action to database key
                            const mappedFeatures: Record<string, string> = {
                              read_resource: 'read_resources',
                              create_resource: 'read_resources',
                              delete_resource: 'read_resources',
                              premium_analytics: 'premium_analytics',
                              export_data: 'export_data'
                            }
                            const dbKey = mappedFeatures[feat.id]
                            const isEnabled = ten.features.includes(dbKey)

                            return (
                              <Grid size={{ xs: 12, sm: 4 }} key={feat.id}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={isEnabled}
                                      onChange={() =>
                                        handleToggleTenantFeature(ten, dbKey)
                                      }
                                      sx={{
                                        color: 'rgba(255,255,255,0.2)',
                                        '&.Mui-checked': { color: '#22c55e' }
                                      }}
                                    />
                                  }
                                  label={
                                    <Box>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          color: isEnabled
                                            ? '#4ade80'
                                            : 'rgba(255,255,255,0.5)',
                                          fontWeight: isEnabled ? 600 : 400
                                        }}
                                      >
                                        {feat.name}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: 'rgba(255,255,255,0.3)',
                                          display: 'block'
                                        }}
                                      >
                                        Requires: {dbKey}
                                      </Typography>
                                    </Box>
                                  }
                                />
                              </Grid>
                            )
                          })}
                        </Grid>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Box>
            )}
          </Grid>

          {/* RIGHT COLUMN: LIVE DEV CONSOLE LOGS */}
          <Grid size={{ xs: 12, md: 3.5 }}>
            <Card
              sx={{
                bgcolor: '#02000c',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                borderRadius: '16px',
                height: '100%',
                minHeight: 400
              }}
            >
              <CardContent
                sx={{
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  minHeight: 400
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyItems: 'center',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: '#4ade80',
                      animation: 'pulse 2s infinite'
                    }}
                  />
                  <Typography
                    variant="subtitle1"
                    sx={{
                      color: '#4ade80',
                      fontWeight: 800,
                      fontFamily: 'monospace'
                    }}
                  >
                    LIVE DEV CONSOLE
                  </Typography>
                </Box>
                <Divider
                  sx={{ borderColor: 'rgba(74, 222, 128, 0.2)', mb: 2 }}
                />

                <Box
                  sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    maxHeight: 500,
                    fontFamily: 'monospace',
                    fontSize: '0.75rem'
                  }}
                >
                  {logs.length === 0 ? (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(74, 222, 128, 0.4)',
                        display: 'block',
                        textAlign: 'center',
                        py: 4
                      }}
                    >
                      Waiting for API interactions...
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {logs.map((log, idx) => (
                        <ListItem
                          key={idx}
                          disableGutters
                          sx={{
                            alignItems: 'flex-start',
                            flexDirection: 'column',
                            mb: 1.5
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              width: '100%',
                              mb: 0.5
                            }}
                          >
                            <span
                              style={{
                                color: log.error ? '#f87171' : '#4ade80',
                                fontWeight: 'bold'
                              }}
                            >
                              [{log.status}] {log.action}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {log.timestamp}
                            </span>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255,255,255,0.5)',
                              wordBreak: 'break-all'
                            }}
                          >
                            Endpoint: <code>{log.endpoint}</code>
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: log.error ? '#fca5a5' : '#a5b4fc',
                              mt: 0.5,
                              whiteSpace: 'pre-wrap'
                            }}
                          >
                            Details: {log.details}
                          </Typography>
                          {idx < logs.length - 1 && (
                            <Divider
                              sx={{
                                borderColor: 'rgba(255,255,255,0.05)',
                                width: '100%',
                                mt: 1.5
                              }}
                            />
                          )}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}
