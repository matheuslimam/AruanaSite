import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useMyProfile } from '../guards'

type BoardItem = { id: string; name: string; category: 'lobinhos' | 'escoteiros' | 'seniors'; total_points: number }
type GroupRow = { id: string; name: string; invite_code: string; city: string | null; created_at: string }
type MemberMini = { id: string; role: string; patrol_id: string | null; is_youth: boolean | null }
type PatrolMini = { id: string; category: 'lobinhos' | 'escoteiros' | 'seniors' }

const CAT_THEME = {
  lobinhos:   { badge: 'bg-emerald-100 text-emerald-700 border-emerald-300', ring: 'ring-emerald-200', bar: 'bg-emerald-500' },
  escoteiros: { badge: 'bg-sky-100 text-sky-700 border-sky-300',            ring: 'ring-sky-200',     bar: 'bg-sky-500'     },
  seniors:    { badge: 'bg-violet-100 text-violet-700 border-violet-300',    ring: 'ring-violet-200',  bar: 'bg-violet-500'  },
} as const

const PIONEIROS_BAR = 'bg-amber-500'

export default function Grupo() {
  const { profile } = useMyProfile()
  const [loading, setLoading] = useState(true)

  const [group, setGroup] = useState<GroupRow | null>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  // métricas
  const [members, setMembers] = useState<MemberMini[]>([])
  const [patrols, setPatrols] = useState<PatrolMini[]>([])
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

      // membros (com seção)
      const mq = supabase.from('profiles')
        .select('id,role,patrol_id,is_youth')
        .eq('group_id', gid)

      // patrulhas (para mapear seção) + contagem
      const pq = supabase
        .from('patrols')
        .select('id,category', { count: 'exact' })
        .eq('group_id', gid)
        .order('name')

      // atividades (contagem)
      const aq = supabase
        .from('activities')
        .select('*', { head: true, count: 'exact' })
        .eq('group_id', gid)

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
      if (!pr.error && pr.data) {
        setPatrols(pr.data as any)
        setPatrolsCount(pr.count ?? (pr.data as any[]).length ?? 0)
      } else {
        setPatrolsCount(pr.count || 0)
      }
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
    const jovens = members.filter(m => !!m.is_youth).length
    return { total, chefes, pioneiros, jovens }
  }, [members])

  // mapa de patrulha -> seção
  const patrolMap = useMemo(() => {
    const m = new Map<string, PatrolMini['category']>()
    patrols.forEach(p => m.set(p.id, p.category))
    return m
  }, [patrols])

  // composição por seção (somente jovens) + pioneiros
  const sectionCounts = useMemo(() => {
    const acc = { lobinhos: 0, escoteiros: 0, seniors: 0, sem: 0, pioneiros: 0 }
    for (const m of members) {
      if (m.role === 'pioneiros') { acc.pioneiros++; continue }
      if (!m.is_youth) continue
      const cat = m.patrol_id ? patrolMap.get(m.patrol_id) : undefined
      if (!cat) { acc.sem++; continue }
      acc[cat]++
    }
    const total = acc.lobinhos + acc.escoteiros + acc.seniors + acc.sem + acc.pioneiros
    return { ...acc, total }
  }, [members, patrolMap])

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

  const createdLabel = group?.created_at ? new Date(group.created_at).toLocaleDateString() : '—'

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8 pb-24">

      {/* HERO */}
      <section className="
        rounded-3xl border bg-gradient-to-br from-white via-zinc-50 to-emerald-50
        ring-1 ring-inset ring-zinc-200
      ">
        <div className="p-5 sm:p-7 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-100">Grupo</span>
              {group?.city && <span className="text-emerald-800/80">• {group.city}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight truncate">
              {loading ? 'Carregando…' : (group?.name || 'Grupo')}
            </h1>
            <div className="text-sm text-zinc-600">Criado em {createdLabel}</div>
          </div>

          {/* Convite */}
          <div className="justify-self-start lg:justify-self-end">
            <div className="rounded-2xl border bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 p-3 sm:p-4 w-full sm:w-auto">
              <div className="text-xs text-zinc-600 mb-1">Código de convite</div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="px-2.5 py-1 rounded border border-zinc-300 bg-zinc-50 font-mono text-sm">
                  {group?.invite_code || '— — — —'}
                </code>
                <button type="button" onClick={copyInvite} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm">
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={regenerateInvite}
                  disabled={!isChief}
                  className={`px-3 py-1.5 rounded border text-sm ${isChief ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  title={isChief ? 'Gerar novo código' : 'Somente Chefes'}
                >
                  Regenerar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form de edição */}
        <div className="p-5 sm:p-7 pt-0">
          <div className="rounded-2xl border bg-white p-4 sm:p-5">
            <div className="grid sm:grid-cols-2 gap-3">
              <Labeled label="Nome do grupo">
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isChief}
                />
              </Labeled>
              <Labeled label="Cidade (opcional)">
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  disabled={!isChief}
                  placeholder="Ex.: Sorocaba — SP"
                />
              </Labeled>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={!isChief || saving}
                className={`px-4 py-2 rounded-lg text-white ${(!isChief || saving) ? 'bg-gray-500' : 'bg-black hover:opacity-90'}`}
              >
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
              {!isChief && <span className="text-sm text-zinc-600">Somente Chefes podem editar</span>}
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Membros" value={counts.total} hint={`${counts.chefes} chefes • ${counts.pioneiros} pion.`} />
          <StatCard label="Chefes" value={counts.chefes} />
          <StatCard label="Pioneiros" value={counts.pioneiros} />
          <StatCard label="Jovens" value={counts.jovens} />
          <StatCard label="Patrulhas" value={patrolsCount} />
          <StatCard label="Atividades" value={activitiesCount} />
        </div>

        {/* Composição por seção + pioneiros */}
        <div className="mt-3 rounded-2xl border bg-white p-3 sm:p-4">
          <div className="text-sm text-zinc-600">Composição por seção</div>
          <SectionBreakdown
            lobinhos={sectionCounts.lobinhos}
            escoteiros={sectionCounts.escoteiros}
            seniors={sectionCounts.seniors}
            pioneiros={sectionCounts.pioneiros}
            sem={sectionCounts.sem}
          />
        </div>
      </section>

      {/* Ranking / pontos */}
      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold">Pontuação do grupo</h2>
          <span className="text-sm text-zinc-600">
            Total: <b className="tabular-nums">{totalPoints}</b>
          </span>
        </div>

        {board.length === 0 ? (
          <Empty>Nenhuma patrulha com pontos ainda.</Empty>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="grid sm:hidden gap-2">
              {board.map((b, i) => {
                const t = CAT_THEME[b.category]
                return (
                  <li key={b.id} className={`rounded-xl border p-3 flex items-center justify-between gap-3 ring-1 ring-inset ${t.ring}`}>
                    <div className="min-w-0">
                      <div className="text-xs text-zinc-500">#{i + 1}</div>
                      <div className="font-medium truncate">{b.name}</div>
                      <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full border ${t.badge}`}>
                        {prettyCat(b.category)}
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold tabular-nums">{b.total_points}</div>
                  </li>
                )
              })}
            </ul>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr className="text-left">
                    <th className="p-2 w-10">#</th>
                    <th className="py-2">Patrulha</th>
                    <th className="py-2">Seção</th>
                    <th className="py-2 text-right pr-3">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((b, i) => {
                    const t = CAT_THEME[b.category]
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="p-2">{i + 1}</td>
                        <td className="py-2">{b.name}</td>
                        <td className="py-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${t.badge}`}>
                            {prettyCat(b.category)}
                          </span>
                        </td>
                        <td className="py-2 text-right pr-3 tabular-nums">{b.total_points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/* ====== UI helpers ====== */
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm text-zinc-600 mb-1">{label}</div>
      {children}
    </label>
  )
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 bg-white">
      <div className="text-sm text-zinc-600">{label}</div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  )
}

function SectionBreakdown({
  lobinhos, escoteiros, seniors, pioneiros, sem = 0,
}: { lobinhos: number; escoteiros: number; seniors: number; pioneiros: number; sem?: number }) {
  const total = Math.max(lobinhos + escoteiros + seniors + pioneiros + sem, 1)
  const pct = (n:number)=> Math.round((n/total)*100)

  const parts = [
    { key: 'lobinhos',   label: 'Lobinhos',   value: lobinhos,   w: pct(lobinhos),   cls: CAT_THEME.lobinhos.bar },
    { key: 'escoteiros', label: 'Escoteiros', value: escoteiros, w: pct(escoteiros), cls: CAT_THEME.escoteiros.bar },
    { key: 'seniors',    label: 'Seniors',    value: seniors,    w: pct(seniors),    cls: CAT_THEME.seniors.bar },
    { key: 'pioneiros',  label: 'Pioneiros',  value: pioneiros,  w: pct(pioneiros),  cls: PIONEIROS_BAR },
  ] as const

  return (
    <div className="mt-2">
      <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden border">
        <div className="h-full flex">
          {parts.map(p => (
            <div key={p.key} className={p.cls} style={{ width: `${p.w}%` }} />
          ))}
          {sem > 0 && <div className="bg-zinc-300" style={{ width: `${pct(sem)}%` }} />}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-1 text-xs text-zinc-600">
        {parts.map(p => (
          <div key={p.key} className="inline-flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm ${p.cls}`} />
            {p.label}: <span className="tabular-nums font-medium">{p.value}</span> ({p.w}%)
          </div>
        ))}
        {sem > 0 && (
          <div className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-zinc-300" />
            Sem seção: <span className="tabular-nums font-medium">{sem}</span> ({pct(sem)}%)
          </div>
        )}
        <div className="col-span-2 sm:col-span-5 text-[11px] text-zinc-500">
          Total: <b className="tabular-nums">{total}</b>
        </div>
      </div>
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
