import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Landing from './routes/Landing'
import AuthPage from './routes/AuthPage'
import AppLayout from './routes/AppLayout'
import Atividades from './routes/Atividades'
import Membros from './routes/Membros'
import Patrulhas from './routes/Patrulhas'
import MeuPainel from './pages/MeuPainel'
import { SessionProvider } from './supabase'
import { RequireRole } from './guards'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/auth', element: <AuthPage /> },
  {
    path: '/app', element: <AppLayout />,
    children: [
      // comum: só lobinhos/escoteiros/seniors
      {
        path: 'meu',
        element: (
          <RequireRole allow={['lobinhos','escoteiros','seniors']} to="/app/atividades">
            <MeuPainel />
          </RequireRole>
        )
      },
      // admin-view: chefes + pioneiros
      {
        path: 'atividades',
        element: (
          <RequireRole allow={['chefe','pioneiros']} to="/app/meu">
            <Atividades />
          </RequireRole>
        )
      },
      {
        path: 'membros',
        element: (
          <RequireRole allow={['chefe','pioneiros']} to="/app/meu">
            <Membros />
          </RequireRole>
        )
      },
      {
        path: 'patrulhas',
        element: (
          <RequireRole allow={['chefe','pioneiros']} to="/app/meu">
            <Patrulhas />
          </RequireRole>
        )
      },
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </React.StrictMode>
)
