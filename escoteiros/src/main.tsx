import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from 'react-router-dom'
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

import { SessionProvider } from './supabase'
import { RequireRole, RequireNoGroup, IndexRedirect } from './guards'

// ------------------ Rotas (compartilhadas) ------------------
const routes = [
  { path: '/', element: <Landing /> },
  { path: '/auth', element: <AuthPage /> },

  {
    path: '/app',
    element: <AppLayout />, // exige usuário logado
    children: [
      { index: true, element: <IndexRedirect /> }, // /app -> redireciona conforme role/grupo

      // onboarding (somente quem ainda NÃO tem group_id)
      { path: 'onboarding', element: <RequireNoGroup><Onboarding /></RequireNoGroup> },

      // rota aberta a QUALQUER usuário autenticado (para ler QR e confirmar presença)
      { path: 'checkin', element: <Checkin /> },

      // comuns (lobinhos/escoteiros/seniors)
      {
        path: 'meu',
        element: (
          <RequireRole allow={['lobinhos','escoteiros','seniors']} to="/app/atividades">
            <MeuPainel />
          </RequireRole>
        ),
      },

      // admins (chefes + pioneiros)
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

  // fallback
  { path: '*', element: <Landing /> },
]

// ------------------ Escolha do Router ------------------
const usingGhPages = import.meta.env.VITE_GH_PAGES === 'true'

// No GH Pages usamos HashRouter para evitar problemas de 404.
// Em produção “normal”, usamos BrowserRouter com basename do Vite.
const router = usingGhPages
  ? createHashRouter(routes)
  : createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </React.StrictMode>
)
