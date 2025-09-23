import { type FormEvent, useState } from 'react'
import { supabase, useSession } from '../supabase'
import { useNavigate } from 'react-router-dom'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { session } = useSession()

  if (session) navigate('/app/atividades')

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
      navigate('/app/atividades')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm border rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-bold">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
        <input className="w-full border rounded p-2" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button disabled={loading} className="w-full rounded bg-black text-white py-2">{loading ? '...' : (mode==='login'?'Entrar':'Cadastrar')}</button>
        <button type="button" onClick={()=>setMode(mode==='login'?'signup':'login')} className="w-full text-sm underline">
          {mode==='login'?'Criar uma conta':'Já tenho conta'}
        </button>
      </form>
    </div>
  )
}
