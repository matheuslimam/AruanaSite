import { type FormEvent, useEffect, useState } from 'react'
import { supabase, useSession } from '../supabase'
import { Link, useNavigate } from 'react-router-dom'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { session } = useSession()

  // Evita navegar no meio do render
  useEffect(() => {
    if (session) {
      navigate('/app/atividades', { replace: true })
    }
  }, [session, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
      navigate('/app/atividades', { replace: true })
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm">
        {/* Link para a landing */}
        <div className="mb-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black"
          >
            <span aria-hidden>←</span>
            Voltar para a landing
          </Link>
        </div>

        <form onSubmit={onSubmit} className="w-full border rounded-xl p-6 space-y-4 bg-white">
          <h1 className="text-xl font-bold">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h1>

          <input
            className="w-full border rounded p-2"
            placeholder="email"
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />

          <input
            className="w-full border rounded p-2"
            placeholder="senha"
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
          />

          <button
            disabled={loading}
            className="w-full rounded bg-black text-white py-2"
          >
            {loading ? '...' : (mode==='login' ? 'Entrar' : 'Cadastrar')}
          </button>

          <button
            type="button"
            onClick={()=>setMode(mode==='login' ? 'signup' : 'login')}
            className="w-full text-sm underline"
          >
            {mode==='login' ? 'Criar uma conta' : 'Já tenho conta'}
          </button>

          {/* Link extra no rodapé do card (opcional) */}
          <div className="pt-2 text-center">
            <Link to="/" className="text-xs text-gray-500 hover:text-gray-800">
              Ir para a página inicial
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
