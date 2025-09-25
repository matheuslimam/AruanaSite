import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useMyProfile } from '../guards'
import Calendar, { type CalendarEvent } from '../components/Calendar'

type AttRow = { activity_id: string; present: boolean; created_at: string | null }
type ActRow = { id: string; title: string; date: string }
type BoardItem = { id: string; name: string; category: 'lobinhos'|'escoteiros'|'seniors'; total_points: number }

function pad2(n:number){ return String(n).padStart(2,'0') }
function todayYMD(){
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
}
function monthEdges(d = new Date()){
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end   = new Date(d.getFullYear(), d.getMonth()+1, 0)
  const s = `${start.getFullYear()}-${pad2(start.getMonth()+1)}-${pad2(start.getDate())}`
  const e = `${end.getFullYear()}-${pad2(end.getMonth()+1)}-${pad2(end.getDate())}`
  return { start, end, s, e }
}

export default function MeuPainel() {
  const { profile } = useMyProfile()
  const gid = profile?.group_id || null

  // métricas de atividades/presenças
  const [totalActivities, setTotalActivities] = useState(0)
  const [attendances, setAttendances] = useState<AttRow[]>([])
  const [recentActivities, setRecentActivities] = useState<ActRow[]>([])
  const [loading, setLoading] = useState(true)

  // pontos/ranking da patrulha
  const [board, setBoard] = useState<BoardItem[]>([])
  const [myPatrolPoints, setMyPatrolPoints] = useState<number | null>(null)
  const [myRank, setMyRank] = useState<number | null>(null)

  // próximas + calendário
  const [upcoming, setUpcoming] = useState<ActRow[]>([])
  const [month, setMonth] = useState<Date>(new Date())
  const [monthActs, setMonthActs] = useState<ActRow[]>([])
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('list')

  useEffect(() => {
    if (!profile?.id || !gid) return
    let alive = true
    ;(async () => {
      setLoading(true)

      // limites do mês atual
      const { s: monthStart, e: monthEnd } = monthEdges(month)
      const today = todayYMD()

      // 1) total atividades do grupo
      const totalReq = supabase
        .from('activities')
        .select('*', { head: true, count: 'exact' })
        .eq('group_id', gid)

      // 2) presenças deste membro (apenas do grupo)
      const attReq = supabase
        .from('attendance')
        .select('activity_id,present,created_at, activities!inner(group_id)')
        .eq('member_id', profile.id)
        .eq('present', true)
        .eq('activities.group_id', gid)
        .order('created_at', { ascending: false })

      // 3) últimas 20 atividades (do grupo)
      const actsReq = supabase
        .from('activities')
        .select('id,title,date')
        .eq('group_id', gid)
        .order('date', { ascending: false })
        .limit(20)

      // 4) próximas atividades (do grupo, data >= hoje)
      const upcomingReq = supabase
        .from('activities')
        .select('id,title,date')
        .eq('group_id', gid)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(10)

      // 5) atividades do mês (para o calendário)
      const monthReq = supabase
        .from('activities')
        .select('id,title,date')
        .eq('group_id', gid)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: true })

      // 6) placar por patrulha (do grupo)
      const boardReq = supabase
        .from('patrol_points_view')
        .select('id,name,category,total_points')
        .eq('group_id', gid)
        .order('total_points', { ascending: false })

      const [totalRes, attRes, actsRes, upcRes, mRes, boardRes] =
        await Promise.all([totalReq, attReq, actsReq, upcomingReq, monthReq, boardReq])
      if (!alive) return

      const rawAtts = ((attRes.data as any[]) ?? []).map(a => ({
        activity_id: a.activity_id,
        present: a.present,
        created_at: a.created_at,
      })) as AttRow[]
      const dedup = Array.from(new Map(rawAtts.map(a => [String(a.activity_id), a])).values())

      setTotalActivities(totalRes.count || 0)
      setAttendances(dedup)
      setRecentActivities((actsRes.data as ActRow[]) ?? [])
      setUpcoming((upcRes.data as ActRow[]) ?? [])
      setMonthActs((mRes.data as ActRow[]) ?? [])

      const rows = (boardRes.data as BoardItem[]) ?? []
      setBoard(rows)

      if (profile.patrol_id) {
        const mine = rows.find(r => r.id === profile.patrol_id)
        setMyPatrolPoints(mine?.total_points ?? 0)
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
  }, [profile?.id, profile?.patrol_id, gid, month])

  // ===== derivados =====
  const myPresenceCount = attendances.length
  const pct = useMemo(
    () => (totalActivities > 0 ? Math.round((myPresenceCount / totalActivities) * 100) : 0),
    [myPresenceCount, totalActivities]
  )
  const absences = Math.max(0, totalActivities - myPresenceCount)
  const attActivityIds = useMemo(() => new Set(attendances.map(a => String(a.activity_id))), [attendances])

  const myBoardCat = useMemo(() => {
    const pid = profile?.patrol_id
    if (!pid) return [] as BoardItem[]
    const myRow = board.find(b => b.id === pid)
    if (!myRow) return [] as BoardItem[]
    return board.filter(b => b.category === myRow.category)
  }, [board, profile?.patrol_id])

  const initials = (profile?.display_name || 'A').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()
  const isCommon = ['lobinhos','escoteiros','seniors'].includes(profile?.role || '')

  if (!profile) return null

  // eventos do calendário (marca verde se já há presença)
  const calEvents: CalendarEvent[] = monthActs.map(a => ({
    id: a.id,
    date: a.date,
    title: a.title,
    present: attActivityIds.has(String(a.id)),
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* HERO */}
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

      {/* Próximas + Calendário */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Agenda</h2>
          <div className="flex rounded-lg overflow-hidden border">
            <button className={`px-3 py-1 text-sm ${viewMode==='list'?'bg-black text-white':'bg-white'}`} onClick={()=>setViewMode('list')}>Próximas</button>
            <button className={`px-3 py-1 text-sm ${viewMode==='calendar'?'bg-black text-white':'bg-white'}`} onClick={()=>setViewMode('calendar')}>Calendário</button>
          </div>
        </div>

        {viewMode==='list' ? (
          <div className="rounded-2xl border bg-white">
            {loading ? <Empty>Carregando…</Empty> : upcoming.length === 0 ? (
              <Empty>Nenhuma atividade futura.</Empty>
            ) : (
              <ul className="divide-y">
                {upcoming.map(a => {
                  const present = attActivityIds.has(String(a.id))
                  return (
                    <li key={a.id} className="flex items-center justify-between p-3">
                      <div>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-zinc-600">{new Date(a.date).toLocaleDateString()}</div>
                      </div>
                      <span className={`inline-flex items-center gap-2 text-sm px-2 py-1 rounded-full border ${present
                        ? 'bg-emerald-600/10 text-emerald-700 border-emerald-600/30'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-300'}`}>
                        {present ? '✔ Presente' : '— Aguardando'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : (
          <Calendar
            events={calEvents}
            month={month}
            onMonthChange={setMonth}
          />
        )}
      </section>

      {/* Pontuação da Patrulha */}
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
                      <div className="font-medium">{act ? (act.title || `Atividade #${act.id}`) : `Atividade #${String(a.activity_id).slice(0,8)}…`}</div>
                      <div className="text-xs text-zinc-600">
                        {act ? new Date(act.date).toLocaleString() : (a.created_at ? new Date(a.created_at).toLocaleString() : '—')}
                      </div>
                    </div>
                  </div>
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
function RingLight({ percent, size=96, stroke=12 }:{
  percent: number; size?: number; stroke?: number
}) {
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
