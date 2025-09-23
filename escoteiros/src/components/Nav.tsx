import { Link, NavLink } from 'react-router-dom'
import { supabase, useSession } from '../supabase'

export default function Nav() {
  const { session } = useSession()
  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <Link to="/" className="font-bold">Aruanã</Link>
      <div className="flex gap-4">
        {session ? (
          <>
            <NavLink to="/app/atividades">Atividades</NavLink>
            <NavLink to="/app/membros">Membros</NavLink>
            <NavLink to="/app/patrulhas">Patrulhas</NavLink>
            <button onClick={() => supabase.auth.signOut()}>Sair</button>
          </>
        ) : (
          <Link to="/auth" className="px-3 py-1 rounded bg-black text-white">Entrar</Link>
        )}
      </div>
    </nav>
  )
}
