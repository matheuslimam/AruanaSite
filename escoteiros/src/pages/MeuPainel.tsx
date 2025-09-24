import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useMyProfile } from '../guards'

type AttRow = { activity_id: string; present: boolean; created_at: string | null }
type ActRow = Record<string, any>
type BoardItem = { id: string; name: string; category: 'lobinhos'|'escoteiros'|'seniors'; total_points: number }

export default function MeuPainel() {
  const { profile } = useMyProfile()

  // métricas de atividades/presenças
  const [totalActivities, setTotalActivities] = useState(0)
  const [attendances, setAttendances] = useState<AttRow[]>([])
  const [recentActivities, setRecentActivities] = useState<ActRow[]>([])
  const [loading, setLoading] = useState(true)

  // pontos/ranking da patrulha
  const [board, setBoard] = useState<BoardItem[]>([])
  const [myPatrolPoints, setMyPatrolPoints] = useState<number | null>(null)
  const [myRank, setMyRank] = useState<number | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    let alive = true
    ;(async () => {
      setLoading(true)

      // 1) total de atividades
      const totalReq = supabase.from('activities').select('*', { head: true, count: 'exact' })

      // 2) presenças reais (present = true) deste membro
      const attReq = supabase
        .from('attendance')
        .select('activity_id,present,created_at')
        .eq('member_id', profile.id)
        .eq('present', true)
        .order('created_at', { ascending: false })

      // 3) últimas 20 atividades
      const actsReq = supabase
        .from('activities')
        .select('*')
        .order('date', { ascending: false })
        .limit(20)

      // 4) placar/total por patrulha via VIEW (mesma de Patrulhas)
      const boardReq = supabase
        .from('patrol_points_view')
        .select('id,name,category,total_points')
        .order('total_points', { ascending: false })

      const [totalRes, attRes, actsRes, boardRes] = await Promise.all([totalReq, attReq, actsReq, boardReq])
      if (!alive) return

      // presenças deduplicadas por atividade
      const rawAtts = (attRes.data as AttRow[]) ?? []
      const dedup = Array.from(new Map(rawAtts.map(a => [String(a.activity_id), a])).values())

      setTotalActivities(totalRes.count || 0)
      setAttendances(dedup)
      setRecentActivities((actsRes.data as ActRow[]) ?? [])

      const rows = (boardRes.data as BoardItem[]) ?? []
      setBoard(rows)

      if (profile.patrol_id) {
        const mine = rows.find(r => r.id === profile.patrol_id)
        setMyPatrolPoints(mine?.total_points ?? 0)

        // ranking só na mesma categoria da patrulha do membro
        const cat = mine?.category || null
        const sameCat = cat ? rows.filter(r => r.category === cat) : rows
        const ordered = [...sameCat].sort((a,b)=> b.total_points - a.total_points || a.name.localeCompare(b.name))
        const idx = ordered.findIndex(r => r.id === profile.patrol_id)
        setMyRank(idx >= 0 ? idx + 1 : null)
      } else {
        setMyPatrolPoints(null)
        setMyRank(null)
      }

      setLoading(false)
    })()
    return () => { alive = false }
  }, [profile?.id, profile?.patrol_id])

  // ===== Hooks (sempre antes de qualquer return!) =====
  const myPresenceCount = attendances.length
  const pct = useMemo(
    () => (totalActivities > 0 ? Math.round((myPresenceCount / totalActivities) * 100) : 0),
    [myPresenceCount, totalActivities]
  )
  const absences = Math.max(0, totalActivities - myPresenceCount)
  const attActivityIds = useMemo(() => new Set(attendances.map(a => String(a.activity_id))), [attendances])

  // board filtrado para exibir (mesma categoria do membro); devolve [] se não tiver profile
  const myBoardCat = useMemo(() => {
    const pid = profile?.patrol_id
    if (!pid) return [] as BoardItem[]
    const myRow = board.find(b => b.id === pid)
    if (!myRow) return [] as BoardItem[]
    return board.filter(b => b.category === myRow.category)
  }, [board, profile?.patrol_id])

  // ===== helpers e UI =====
  const titleOf = (a: ActRow) => a.title || a.name || `Atividade #${a.id ?? ''}`.trim()
  const dateOf  = (a: ActRow) => {
    const raw = a.date || a.starts_at || a.created_at
    if (!raw) return '—'
    const d = new Date(raw)
    return isNaN(+d) ? String(raw) : d.toLocaleString()
  }

  // Podemos retornar nulo DEPOIS de todos os hooks
  if (!profile) return null

  const initials = (profile.display_name || 'A').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()
  const isCommon = ['lobinhos','escoteiros','seniors'].includes(profile.role)

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* HERO claro */}
      <section className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-emerald-50 text-zinc-900">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] items-center">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-zinc-200 grid place-items-center text-xl font-semibold shadow-sm">
              {initials}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{profile.display_name}</h1>
              <div className="flex flex-wrap gap-2">
                <Chip>{prettyRole(profile.role)}</Chip>
                <Chip mono>{profile.email ?? '—'}</Chip>
                <Chip>Patrulha: {profile.patrol?.name || '—'}</Chip>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5 justify-self-end">
            <RingLight percent={pct} size={108} stroke={12} />
            <div className="text-sm/5 text-zinc-700">
              <div><b className="text-zinc-900">{myPresenceCount}</b> presenças</div>
              <div><b className="text-zinc-900">{totalActivities}</b> atividades</div>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid sm:grid-cols-3 gap-4">
        <Stat label="Atividades" value={totalActivities} />
        <Stat label="Presenças" value={myPresenceCount} />
        <Stat label="Faltas" value={absences} />
      </section>

      {/* Pontuação da Patrulha (via VIEW) */}
      <section className="rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Pontuação da patrulha</h2>
          {myRank && <span className="text-sm text-zinc-600">Posição: <b>#{myRank}</b></span>}
        </div>

        {!profile.patrol_id ? (
          <Empty>Você não pertence a uma patrulha.</Empty>
        ) : myPatrolPoints === null ? (
          <Empty>Carregando…</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 p-4 bg-white">
              <div className="text-sm text-zinc-600">Total da sua patrulha</div>
              <div className="text-3xl font-semibold tabular-nums">{myPatrolPoints}</div>
            </div>

            <div className="md:col-span-2 rounded-xl border border-zinc-200">
              {myBoardCat.length === 0 ? (
                <div className="p-4 text-sm text-zinc-600">Ranking indisponível.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr className="text-left">
                      <th className="p-2">#</th>
                      <th>Patrulha</th>
                      <th className="text-right pr-3">Pontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myBoardCat
                      .sort((a,b)=> b.total_points - a.total_points || a.name.localeCompare(b.name))
                      .slice(0, 6)
                      .map((b, idx) => {
                        const isMine = b.id === profile.patrol_id
                        return (
                          <tr key={b.id} className={`border-t ${isMine ? 'bg-emerald-50' : ''}`}>
                            <td className="p-2 w-10">{idx + 1}</td>
                            <td className="p-2">{b.name}</td>
                            <td className="p-2 text-right pr-3 tabular-nums">{b.total_points}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Presenças recentes */}
      <section className="rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Minhas presenças recentes</h2>
          <span className="text-sm text-zinc-600">{attendances.length} no total</span>
        </div>
        {loading ? (
          <Empty>Carregando…</Empty>
        ) : attendances.length === 0 ? (
          <Empty>Você ainda não tem presenças registradas.</Empty>
        ) : (
          <ul className="space-y-2">
            {attendances.slice(0, 8).map((a, i) => {
              const act = recentActivities.find(x => String(x.id) === String(a.activity_id))
              const key = `${a.activity_id}-${a.created_at ?? i}`
              return (
                <li key={key} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 bg-white">
                  <div className="flex items-center gap-3">
                    <span className="inline-grid place-items-center w-7 h-7 rounded-full bg-emerald-600/15 text-emerald-700 text-sm">✔</span>
                    <div>
                      <div className="font-medium">{act ? titleOf(act) : `Atividade #${String(a.activity_id).slice(0,8)}…`}</div>
                      <div className="text-xs text-zinc-600">
                        {act ? dateOf(act) : (a.created_at ? new Date(a.created_at).toLocaleString() : '—')}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Últimas atividades */}
      <section className="rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Últimas atividades</h2>
          <span className="text-sm text-zinc-600">Indicador de presença</span>
        </div>
        {loading ? (
          <Empty>Carregando…</Empty>
        ) : recentActivities.length === 0 ? (
          <Empty>Nenhuma atividade encontrada.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {recentActivities.map(a => {
              const present = attActivityIds.has(String(a.id))
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium">{titleOf(a)}</div>
                    <div className="text-xs text-zinc-600">{dateOf(a)}</div>
                  </div>
                  <span className={`inline-flex items-center gap-2 text-sm px-2 py-1 rounded-full border ${present
                    ? 'bg-emerald-600/10 text-emerald-700 border-emerald-600/30'
                    : 'bg-zinc-100 text-zinc-700 border-zinc-300'}`}>
                    {present ? '✔ Presente' : '— Ausente'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {isCommon && (
        <p className="text-xs text-zinc-600">Dica: esta página mostra apenas suas informações e estatísticas pessoais.</p>
      )}
    </div>
  )
}

/* ====== UI helpers ====== */
function prettyRole(role: string) {
  switch (role) {
    case 'lobinhos': return 'Lobinhos'
    case 'escoteiros': return 'Escoteiros'
    case 'seniors': return 'Seniors'
    case 'pioneiros': return 'Pioneiros'
    case 'chefe': return 'Chefe'
    default: return role
  }
}
function Chip({ children, mono=false }:{ children: React.ReactNode; mono?: boolean }) {
  return <span className={`text-xs ${mono?'font-mono':''} px-2.5 py-1 rounded-full border border-zinc-300 bg-white text-zinc-800`}>{children}</span>
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
function RingLight({ percent, size=96, stroke=12 }:{ percent: number; size?: number; stroke?: number }) {
  const p = Math.max(0, Math.min(100, percent))
  const inner = size - stroke*2
  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(rgb(16 185 129) ${p*3.6}deg, rgba(0,0,0,0.08) 0deg)` }}
      />
      <div
        className="absolute rounded-full bg-white border border-zinc-200"
        style={{ top: stroke, left: stroke, width: inner, height: inner }}
      />
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-zinc-900">{p}%</div>
    </div>
  )
}
