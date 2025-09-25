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
import Onboarding from './routes/Onboarding'
import Grupo from './routes/Grupo'

import { SessionProvider } from './supabase'
import { RequireRole, RequireNoGroup, IndexRedirect } from './guards'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/auth', element: <AuthPage /> },
  {
    path: '/app',
    element: <AppLayout />, // exige usuário logado
    children: [
      { index: true, element: <IndexRedirect /> }, // /app -> correto por role/grupo
      { path: 'onboarding', element: <RequireNoGroup><Onboarding /></RequireNoGroup> },

      // comuns
      {
        path: 'meu',
        element: (
          <RequireRole allow={['lobinhos','escoteiros','seniors']} to="/app/atividades">
            <MeuPainel />
          </RequireRole>
        ),
      },

      // admins
      {
        path: 'grupo',
        element: (
          <RequireRole allow={['chefe','pioneiros']} to="/app/meu">
            <Grupo />
          </RequireRole>
        ),
      },
      {
        path: 'atividades',
        element: (
          <RequireRole allow={['chefe','pioneiros']} to="/app/meu">
            <Atividades />
          </RequireRole>
        ),
      },
      {
        path: 'membros',
        element: (
          <RequireRole allow={['chefe','pioneiros']} to="/app/meu">
            <Membros />
          </RequireRole>
        ),
      },
      {
        path: 'patrulhas',
        element: (
          <RequireRole allow={['chefe','pioneiros']} to="/app/meu">
            <Patrulhas />
          </RequireRole>
        ),
      },
    ],
  },
  { path: '*', element: <Landing /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </React.StrictMode>
)
