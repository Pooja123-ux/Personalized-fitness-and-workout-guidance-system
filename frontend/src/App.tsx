import { Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { ProfileProvider } from "./context/ProfileContext"

import SignUp from "./pages/SignUp"
import SignIn from "./pages/SignIn"
import Home from "./pages/Home"
import Dashboard from "./pages/Dashboard"
import IntakeForm from "./pages/IntakeForm"
import Recommendations from "./pages/Recommendations"
import Reports from "./pages/Reports"
import Trainer from "./pages/Trainer"
import Images from "./pages/Images"
import Chatbot from "./pages/Chatbot"
import Layout from "./components/Layout"

/* ===================== AUTH GUARD ===================== */
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    setToken(storedToken)
    setLoading(false)
  }, [])

  if (loading) return null // 🔥 prevents flicker

  if (!token) return <Navigate to="/signin" replace />

  return children
}

/* ===================== PUBLIC ROUTE GUARD ===================== */
function PublicRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("token")
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

/* ===================== APP ROUTES ===================== */
function App() {
  return (
    <ProfileProvider>
      <Routes>
      {/* Default */}
      <Route path="/" element={<Navigate to="/signin" replace />} />

      {/* Public routes */}
      <Route
        path="/signin"
        element={
          <PublicRoute>
            <SignIn />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignUp />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Layout>
              <Home />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/intake"
        element={
          <ProtectedRoute>
            <Layout>
              <IntakeForm />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/recommendations"
        element={
          <ProtectedRoute>
            <Layout>
              <Recommendations />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/trainer"
        element={
          <ProtectedRoute>
            <Layout>
              <Trainer />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/images"
        element={
          <ProtectedRoute>
            <Layout>
              <Images />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Layout>
              <Chatbot />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </ProfileProvider>
  )
}

export default App
