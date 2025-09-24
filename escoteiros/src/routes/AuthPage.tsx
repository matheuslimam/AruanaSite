import { type FormEvent, useEffect, useState } from 'react'
import { supabase, useSession } from '../supabase'
import { Link, useNavigate } from 'react-router-dom'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { session } = useSession()

  async function goHomeByRole() {
    const { data: u } = await supabase.auth.getUser()
    if (!u.user) return
    const { data: prof } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', u.user.id)
      .maybeSingle()

    const role = (prof as any)?.role
    if (role === 'chefe' || role === 'pioneiros') {
      navigate('/app/atividades', { replace: true })
    } else {
      navigate('/app/meu', { replace: true })
    }
  }

  useEffect(() => {
    if (session) {
      goHomeByRole()
    }
  }, [session])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`
          }
        })
        if (error) throw error
      }
      await goHomeByRole()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm">
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
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            className="w-full border rounded p-2"
            placeholder="senha"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button disabled={loading} className="w-full rounded bg-black text-white py-2">
            {loading ? '...' : (mode === 'login' ? 'Entrar' : 'Cadastrar')}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-sm underline"
          >
            {mode === 'login' ? 'Criar uma conta' : 'Já tenho conta'}
          </button>

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
