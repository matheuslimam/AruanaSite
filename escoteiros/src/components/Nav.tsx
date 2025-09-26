import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase, useSession } from '../supabase'
import { useCallback, useEffect, useState } from 'react'
import { useMyProfile } from '../guards'

export default function Nav() {
  const { session } = useSession()
  const { profile } = useMyProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(()=>{ setOpen(false) }, [location])

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      navigate('/auth', { replace: true, state: { from: location } })
    } catch (err) {
      console.error('Erro ao sair:', err)
    }
  }, [navigate, location])

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `px-2 py-1 rounded ${isActive ? 'bg-black text-white' : 'text-gray-700 hover:text-black'}`

  const role = profile?.role
  const isCommon = role === 'lobinhos' || role === 'escoteiros' || role === 'seniors'
  const isAdminView = role === 'chefe' || role === 'pioneiros'

  const HomeLink = (
    <Link to={isCommon ? '/app/meu' : '/app/atividades'} className="font-bold truncate">
      {profile?.group?.name || 'Aruanã'}
    </Link>
  )

  const AdminLinks = () => (
    <>
      <NavLink to="/app/atividades" end className={navCls}>Atividades</NavLink>
      <NavLink to="/app/membros" end className={navCls}>Membros</NavLink>
      <NavLink to="/app/patrulhas" end className={navCls}>Patrulhas</NavLink>
      <NavLink to="/app/grupo" end className={navCls}>Grupo</NavLink>
    </>
  )

  return (
    <nav className="relative z-40 border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        {HomeLink}

        {/* DESKTOP */}
        <div className="hidden md:flex items-center gap-2">
          {session ? (
            <>
              {/* Calendário para todos os logados */}
              <NavLink to="/app/calendario" end className={navCls}>Calendário</NavLink>

              {isCommon && <NavLink to="/app/meu" end className={navCls}>Meu painel</NavLink>}
              {isAdminView && <AdminLinks />}

              <button
                type="button"
                onClick={handleSignOut}
                className="ml-1 px-3 py-1 rounded border hover:bg-gray-50"
                title="Sair"
              >
                Sair
              </button>
            </>
          ) : (
            <Link to="/auth" className="px-3 py-1 rounded bg-black text-white">Entrar</Link>
          )}
        </div>

        {/* MOBILE button */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 border text-gray-700 hover:bg-gray-50"
          aria-label="Abrir menu"
          aria-expanded={open}
          onClick={()=>setOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="pointer-events-none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* OVERLAY */}
      <div
        className={`md:hidden fixed inset-0 bg-black/30 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={()=>setOpen(false)}
        aria-hidden="true"
      />
      {/* DRAWER */}
      <div
        className={`md:hidden fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white shadow-xl transition-transform ${open ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}
        role="dialog"
        aria-label="Menu"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          {HomeLink}
          <button
            type="button"
            className="p-2 rounded-md border hover:bg-gray-50"
            onClick={()=>setOpen(false)}
            aria-label="Fechar menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-3 flex-1 overflow-auto">
          {session ? (
            <div className="flex flex-col gap-1">
              {/* Calendário para todos */}
              <NavLink to="/app/calendario" end className={navCls}>Calendário</NavLink>

              {isCommon && (
                <NavLink to="/app/meu" end className={navCls}>
                  Meu painel
                </NavLink>
              )}

              {isAdminView && (
                <div className="mt-2 flex flex-col gap-1">
                  <AdminLinks />
                </div>
              )}

              <hr className="my-3" />
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full px-3 py-2 rounded border text-left hover:bg-gray-50"
                title="Sair"
              >
                Sair
              </button>
            </div>
          ) : (
            <Link to="/auth" className="block px-3 py-2 rounded bg-black text-white text-center">
              Entrar
            </Link>
          )}
        </div>

        {session && (
          <div className="border-t p-3 text-xs text-gray-500">
            Logado como <span className="font-medium">{profile?.display_name || 'Usuário'}</span>
          </div>
        )}
      </div>
    </nav>
  )
}
