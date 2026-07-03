import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  clearAdminSession,
  isAdminAuthenticated,
  isAdminProtectionEnabled,
  verifyAdminPassword,
} from '../lib/adminAuth'

interface AdminGuardProps {
  children: ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (!isAdminProtectionEnabled() && import.meta.env.PROD) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Admin unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">
            Set <code className="rounded bg-gray-100 px-1">VITE_ADMIN_PASSWORD</code> before building
            for production.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Back to site
          </Link>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    function handleSubmit(e: FormEvent) {
      e.preventDefault()
      if (verifyAdminPassword(password)) {
        setAuthenticated(true)
        setError('')
        setPassword('')
        return
      }
      setError('Incorrect password.')
      setPassword('')
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-lg font-semibold text-gray-900">Admin sign-in</h1>
          <p className="mt-1 text-sm text-gray-500">Enter the editor password to continue.</p>
          <label className="mt-4 block">
            <span className="sr-only">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <>
      {children}
      {isAdminProtectionEnabled() && (
        <button
          type="button"
          onClick={() => {
            clearAdminSession()
            setAuthenticated(false)
          }}
          className="fixed bottom-4 left-4 rounded-full bg-gray-800/80 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-gray-800 hover:text-white"
        >
          Sign out
        </button>
      )}
    </>
  )
}
