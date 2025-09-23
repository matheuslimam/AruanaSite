import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase, useSession } from '../supabase'
import { useCallback } from 'react'

export default function Nav() {
  const { session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      // Redireciona imediatamente para a tela de login
      navigate('/auth', { replace: true, state: { from: location } })
      // Se preferir “forçar” a atualização de tudo:
      // window.location.replace('/auth')
    } catch (err) {
      console.error('Erro ao sair:', err)
    }
  }, [navigate, location])

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `px-2 py-1 rounded ${
      isActive ? 'bg-black text-white' : 'text-gray-700 hover:text-black'
    }`

  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <Link to="/" className="font-bold">Aruanã</Link>
      <div className="flex gap-2 sm:gap-4">
        {session ? (
          <>
            <NavLink to="/app/atividades" end className={navCls}>Atividades</NavLink>
            <NavLink to="/app/membros" end className={navCls}>Membros</NavLink>
            <NavLink to="/app/patrulhas" end className={navCls}>Patrulhas</NavLink>
            <button type="button" onClick={handleSignOut}
              className="px-3 py-1 rounded border hover:bg-gray-50">
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
