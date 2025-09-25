import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useMyProfile } from '../guards'

export default function Onboarding(){
  const [mode, setMode] = useState<'join'|'create'>('join')
  const [invite, setInvite] = useState('')
  const [groupName, setGroupName] = useState('')
  const [role, setRole] = useState<'lobinhos'|'escoteiros'|'seniors'|'pioneiros'>('escoteiros')
  const [loading, setLoading] = useState(false)

  const { profile, loading: loadingProfile } = useMyProfile()
  const navigate = useNavigate()

  // Se já estiver em grupo, não deixa ficar aqui
  useEffect(() => {
    if (loadingProfile) return
    if (!profile) return // usuário autenticado sem profile -> deve ver onboarding
    if (profile.group_id) {
      const to = (profile.role === 'chefe' || profile.role === 'pioneiros') ? '/app/atividades' : '/app/meu'
      navigate(to, { replace: true })
    }
  }, [loadingProfile, profile?.group_id, profile?.role, navigate])

  if (loadingProfile || (profile && profile.group_id)) return null

  async function submit(){
    setLoading(true)
    try{
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token ?? ''
      const payload =
        mode === 'create'
          ? { mode:'create', group_name: groupName }
          : { mode:'join', invite_code: invite.trim().toUpperCase(), role }

      const { data, error } = await supabase.functions.invoke('group-join-or-create', {
        body: payload,
        headers: { Authorization: `Bearer ${token}` }
      })
      if (error) {
        const res = (error as any).context?.response
        const txt = res ? await res.text() : (error as any).message
        let msg = txt; try{ msg = JSON.parse(txt).error } catch{}
        alert(msg); return
      }

      // redireciona pela role
      const r = (data as any).profile?.role
      if (r === 'chefe' || r === 'pioneiros') navigate('/app/atividades', { replace:true })
      else navigate('/app/meu', { replace:true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white space-y-4">
        <h1 className="text-xl font-bold">Bem-vindo! 🎉</h1>

        <div className="flex gap-2">
          <button
            className={`flex-1 rounded border px-3 py-2 ${mode==='join'?'bg-black text-white':''}`}
            onClick={()=>setMode('join')}
          >Entrar em um grupo</button>
          <button
            className={`flex-1 rounded border px-3 py-2 ${mode==='create'?'bg-black text-white':''}`}
            onClick={()=>setMode('create')}
          >Criar meu grupo</button>
        </div>

        {mode==='join' ? (
          <>
            <label className="text-sm">Código do grupo</label>
            <input className="w-full border rounded p-2"
              placeholder="EX.: ARUANA272"
              value={invite} onChange={e=>setInvite(e.target.value)} />
            <label className="text-sm">Sua seção</label>
            <select className="w-full border rounded p-2" value={role} onChange={e=>setRole(e.target.value as any)}>
              <option value="lobinhos">Lobinhos</option>
              <option value="escoteiros">Escoteiros</option>
              <option value="seniors">Seniors</option>
              <option value="pioneiros">Pioneiros</option>
            </select>
          </>
        ) : (
          <>
            <label className="text-sm">Nome do grupo</label>
            <input className="w-full border rounded p-2"
              placeholder="Ex.: GE Aruanã 272"
              value={groupName} onChange={e=>setGroupName(e.target.value)} />
            <p className="text-xs text-gray-500">
              Você será criado como <b>Chefe</b> deste grupo. Depois poderá convidar membros e criar patrulhas.
            </p>
          </>
        )}

        <button className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
          disabled={loading || (mode==='join' ? !invite.trim() : !groupName.trim())}
          onClick={submit}>
          {loading ? '...' : (mode==='join' ? 'Entrar' : 'Criar grupo')}
        </button>
      </div>
    </div>
  )
}
