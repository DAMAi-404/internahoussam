import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BackendProvider, useSession } from '@/app/backend'
import { homeFor } from '@/app/routes'
import { ShopApp } from '@/app/ShopApp'
import { Gallery } from '@/dev/Gallery'
import { Login } from '@/features/auth/Login'
import type { Role } from '@/domain/types'

/**
 * Each device lands in its own area (ROLES.md): /shop, /owner (owner + deputy), /labo.
 * A device that is not signed in always goes to /login.
 */
export function App() {
  return (
    <BrowserRouter>
      <BackendProvider fallback={<Splash />}>
        <Routes>
          <Route path="/dev/ui" element={<Gallery />} />
          <Route path="/login" element={<Login />} />
          <Route path="/shop/*" element={<Gate roles={['shop']}><ShopApp /></Gate>} />
          <Route path="/owner/*" element={<Gate roles={['owner', 'deputy']}><Placeholder /></Gate>} />
          <Route path="/labo/*" element={<Gate roles={['labo']}><Placeholder /></Gate>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BackendProvider>
    </BrowserRouter>
  )
}

function Home() {
  const session = useSession()
  if (session.isPending) return <Splash />
  return <Navigate to={session.data ? homeFor(session.data.role) : '/login'} replace />
}

function Gate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const session = useSession()
  if (session.isPending) return <Splash />
  if (!session.data) return <Navigate to="/login" replace />
  if (!roles.includes(session.data.role)) return <Navigate to={homeFor(session.data.role)} replace />
  return <div className="fixed inset-0 flex flex-col bg-surface text-fg">{children}</div>
}

export function Splash() {
  return (
    <div className="grid h-full place-items-center bg-ink">
      <svg width="64" height="64" viewBox="0 0 512 512" aria-label="Mahroussa Pro" className="animate-pulse">
        <rect width="512" height="512" rx="120" fill="#275238" />
        <path d="M136 360V160l120 120 120-120v200" fill="none" stroke="#6BAA75" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function Placeholder() {
  return <Splash />
}
