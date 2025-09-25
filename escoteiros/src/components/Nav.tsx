import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase, useSession } from '../supabase'
import { useCallback } from 'react'
import { useMyProfile } from '../guards'

export default function Nav() {
  const { session } = useSession()
  const { profile } = useMyProfile()
  const navigate = useNavigate()
  const location = useLocation()

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

  return (
    <nav className="flex items-center justify-between p-4 border-b bg-white">
      <Link to={isCommon ? '/app/meu' : '/app/atividades'} className="font-bold">
        {profile?.group?.name || 'Aruanã'}
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        {session ? (
          <>
            {isCommon && (
              <NavLink to="/app/meu" end className={navCls}>Meu painel</NavLink>
            )}

            {isAdminView && (
              <>
                <NavLink to="/app/atividades" end className={navCls}>Atividades</NavLink>
                <NavLink to="/app/membros" end className={navCls}>Membros</NavLink>
                <NavLink to="/app/patrulhas" end className={navCls}>Patrulhas</NavLink>
                <NavLink to="/app/grupo" end className={navCls}>Grupo</NavLink>
              </>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 py-1 rounded border hover:bg-gray-50"
              title="Sair"
            >
              Sair
            </button>
          </>
        ) : (
          <Link to="/auth" className="px-3 py-1 rounded bg-black text-white">Entrar</Link>
        )}
      </div>
    </nav>
  )
}
