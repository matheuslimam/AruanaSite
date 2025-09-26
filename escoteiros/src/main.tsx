// src/main.tsx
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
import Checkin from './routes/Checkin'
import Calendario from './routes/Calendario' // 👈 NOVO

import { SessionProvider } from './supabase'
import { RequireRole, RequireNoGroup, IndexRedirect } from './guards'

const BASENAME = import.meta.env.BASE_URL || '/'

const router = createBrowserRouter(
  [
    { path: '/', element: <Landing /> },
    { path: '/auth', element: <AuthPage /> },

    {
      path: '/app',
      element: <AppLayout />,
      children: [
        { index: true, element: <IndexRedirect /> },

        { path: 'onboarding', element: <RequireNoGroup><Onboarding /></RequireNoGroup> },

        // aberto a usuário autenticado (dentro de /app)
        { path: 'checkin', element: <Checkin /> },

        // Calendário: todos os papéis autenticados
        { path: 'calendario', element: <Calendario /> },

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
  ],
  { basename: BASENAME }
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </React.StrictMode>
)
