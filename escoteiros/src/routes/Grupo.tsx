import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useMyProfile } from '../guards'

type BoardItem = { id: string; name: string; category: 'lobinhos' | 'escoteiros' | 'seniors'; total_points: number }
type GroupRow = { id: string; name: string; invite_code: string; city: string | null; created_at: string }

export default function Grupo() {
  const { profile } = useMyProfile()
  const [loading, setLoading] = useState(true)

  const [group, setGroup] = useState<GroupRow | null>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  // métricas
  const [members, setMembers] = useState<{ id: string; role: string }[]>([])
  const [patrolsCount, setPatrolsCount] = useState(0)
  const [activitiesCount, setActivitiesCount] = useState(0)
  const [board, setBoard] = useState<BoardItem[]>([])

  const isChief = profile?.role === 'chefe'
  const isAdmin = profile?.role === 'chefe' || profile?.role === 'pioneiros'
  const gid = profile?.group_id || null

  useEffect(() => {
    if (!gid) return
    let alive = true
    ;(async () => {
      setLoading(true)

      // grupo
      const gq = supabase.from('groups').select('id,name,invite_code,city,created_at').eq('id', gid).single()

      // membros (para contar por role)
      const mq = supabase.from('profiles').select('id,role').eq('group_id', gid)

      // patrulhas / atividades (contagem)
      const pq = supabase.from('patrols').select('*', { head: true, count: 'exact' }).eq('group_id', gid)
      const aq = supabase.from('activities').select('*', { head: true, count: 'exact' }).eq('group_id', gid)

      // ranking / pontos por patrulha
      const bq = supabase
        .from('patrol_points_view')
        .select('id,name,category,total_points')
        .eq('group_id', gid)
        .order('total_points', { ascending: false })

      const [gr, mr, pr, ar, br] = await Promise.all([gq, mq, pq, aq, bq])

      if (!alive) return
      if (!gr.error && gr.data) {
        setGroup(gr.data as GroupRow)
        setName((gr.data as any).name || '')
        setCity((gr.data as any).city || '')
      }
      if (!mr.error && mr.data) setMembers(mr.data as any)
      setPatrolsCount(pr.count || 0)
      setActivitiesCount(ar.count || 0)
      if (!br.error && br.data) setBoard(br.data as any)

      setLoading(false)
    })()
    return () => { alive = false }
  }, [gid])

  const counts = useMemo(() => {
    const total = members.length
    const chefes = members.filter(m => m.role === 'chefe').length
    const pioneiros = members.filter(m => m.role === 'pioneiros').length
    const juvenis = total - chefes - pioneiros
    return { total, chefes, pioneiros, juvenis }
  }, [members])

  const totalPoints = useMemo(
    () => board.reduce((s, b) => s + (b.total_points || 0), 0),
    [board]
  )

  async function save() {
    if (!group || !isChief) return
    setSaving(true)
    try {
      const { error } = await supabase.from('groups').update({ name: name.trim(), city: city.trim() || null }).eq('id', group.id)
      if (error) throw error
      setGroup(g => g ? { ...g, name: name.trim(), city: city.trim() || null } : g)
      alert('Dados do grupo salvos!')
    } catch (e: any) {
      alert(e?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function genCode(n = 8) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join('')
  }

  async function regenerateInvite() {
    if (!group) return
    if (!confirm('Gerar novo código de convite? O antigo deixará de funcionar.')) return
    const code = genCode(8)
    try {
      const { error, data } = await supabase.from('groups').update({ invite_code: code }).eq('id', group.id).select('invite_code').single()
      if (error) throw error
      setGroup(g => g ? { ...g, invite_code: (data as any).invite_code } : g)
    } catch (e: any) {
      alert(e?.message || 'Não foi possível regenerar (somente Chefes podem alterar).')
    }
  }

  async function copyInvite() {
    if (!group?.invite_code) return
    await navigator.clipboard.writeText(group.invite_code)
    alert('Código copiado!')
  }

  if (!isAdmin) return null

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
              {loading ? 'Carregando…' : group?.name || 'Grupo'}
            </h1>
            {group?.created_at && (
              <div className="text-sm text-zinc-600">
                Criado em {new Date(group.created_at).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-zinc-600">Código de convite</div>
            <div className="flex items-center gap-2">
              <code className="px-2.5 py-1 rounded border border-zinc-300 bg-zinc-50 font-mono">
                {group?.invite_code || '— — — —'}
              </code>
              <button onClick={copyInvite} className="px-2 py-1 rounded border">Copiar</button>
              <button onClick={regenerateInvite} className="px-2 py-1 rounded border" disabled={!isChief}>
                Regenerar
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-zinc-600">Nome do grupo</label>
            <input
              className="w-full border rounded p-2"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={!isChief}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600">Cidade</label>
            <input
              className="w-full border rounded p-2"
              value={city}
              onChange={e => setCity(e.target.value)}
              disabled={!isChief}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={save}
            disabled={!isChief || saving}
            className={`px-3 py-2 rounded text-white ${(!isChief || saving) ? 'bg-gray-500' : 'bg-black'}`}
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
          {!isChief && <span className="ml-3 text-sm text-zinc-600">Somente Chefes podem editar</span>}
        </div>
      </section>

      {/* KPIs */}
      <section className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Membros" value={counts.total} />
        <Stat label="Chefes" value={counts.chefes} />
        <Stat label="Pioneiros" value={counts.pioneiros} />
        <Stat label="Juvenis" value={counts.juvenis} />
        <Stat label="Patrulhas" value={patrolsCount} />
        <Stat label="Atividades" value={activitiesCount} />
      </section>

      {/* Ranking / pontos */}
      <section className="rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Pontuação do grupo</h2>
          <span className="text-sm text-zinc-600">Total: <b className="tabular-nums">{totalPoints}</b></span>
        </div>
        {board.length === 0 ? (
          <Empty>Nenhuma patrulha com pontos ainda.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr className="text-left">
                <th className="p-2">#</th>
                <th>Patrulha</th>
                <th>Seção</th>
                <th className="text-right pr-3">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {board.map((b, i) => (
                <tr key={b.id} className="border-t">
                  <td className="p-2 w-10">{i + 1}</td>
                  <td className="p-2">{b.name}</td>
                  <td className="p-2">{prettyCat(b.category)}</td>
                  <td className="p-2 text-right pr-3 tabular-nums">{b.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 bg-white">
      <div className="text-sm text-zinc-600">{label}</div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-600 bg-white">{children}</div>
}
function prettyCat(c: BoardItem['category']) {
  switch (c) {
    case 'lobinhos': return 'Lobinhos'
    case 'escoteiros': return 'Escoteiros'
    case 'seniors': return 'Seniors'
    default: return c
  }
}
