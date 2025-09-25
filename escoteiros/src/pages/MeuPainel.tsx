import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()

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

  // ===== Scanner QR =====
  const [qrOpen, setQrOpen] = useState(false)
  const [qrErr, setQrErr] = useState<string | null>(null)
  const [readerId, setReaderId] = useState<string>('') // id do container
  const [manual, setManual] = useState('')
  const scannerRef = useRef<any>(null)

  useEffect(() => {
    if (!profile?.id || !gid) return
    let alive = true
    ;(async () => {
      setLoading(true)
      const { s: monthStart, e: monthEnd } = monthEdges(month)
      const today = todayYMD()

      const totalReq = supabase
        .from('activities')
        .select('*', { head: true, count: 'exact' })
        .eq('group_id', gid)

      const attReq = supabase
        .from('attendance')
        .select('activity_id,present,created_at, activities!inner(group_id)')
        .eq('member_id', profile.id)
        .eq('present', true)
        .eq('activities.group_id', gid)
        .order('created_at', { ascending: false })

      const actsReq = supabase
        .from('activities')
        .select('id,title,date')
        .eq('group_id', gid)
        .order('date', { ascending: false })
        .limit(20)

      const upcomingReq = supabase
        .from('activities')
        .select('id,title,date')
        .eq('group_id', gid)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(10)

      const monthReq = supabase
        .from('activities')
        .select('id,title,date')
        .eq('group_id', gid)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: true })

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

// ===== scan helpers =====
function parseCheckin(text: string): { t?: string; a?: string } | null {
  // 1) tenta URL completa (com ou sem hash)
  try {
    const u = new URL(text)
    const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash

    // params na query normal
    let t = u.searchParams.get('t') || ''
    let a = u.searchParams.get('a') || ''

    // params depois do hash (ex.: #/app/checkin?t=...)
    if (!t && !a && hash.includes('?')) {
      const q = new URLSearchParams(hash.split('?')[1] || '')
      t = q.get('t') || ''
      a = q.get('a') || ''
    }

    const pathOk =
      u.pathname.endsWith('/app/checkin') ||
      hash.startsWith('/app/checkin')

    if (pathOk && (t || a)) {
      return { t: t || undefined, a: a || undefined }
    }
  } catch {
    /* not a URL, segue */
  }

  // 2) token simples
  if (/^[A-Za-z0-9._~-]{8,}$/.test(text)) return { t: text }

  // 3) UUID da atividade
  if (/^[0-9a-fA-F-]{36}$/.test(text)) return { a: text }

  return null
}

async function handleDecoded(text: string) {
  const params = parseCheckin(text)
  if (!params) {
    setQrErr('QR inválido. Cole o link ou peça um novo código.')
    return
  }
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  await stopScanner()
  // navega SEM basename; HashRouter acrescenta o "#/" pra você
  navigate(`/app/checkin?${qs}`, { replace: true })
}

async function startScanner() {
  setQrErr(null)
  const id = `qr-reader-${Date.now()}`
  setReaderId(id)
  try {
    const mod: any = await import('html5-qrcode')
    const Html5Qrcode = mod.Html5Qrcode
    await new Promise(r => setTimeout(r, 0)) // espera montar o container
    const scanner = new Html5Qrcode(id)
    scannerRef.current = scanner
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 260 } },
      (decodedText: string) => handleDecoded(decodedText),
      () => {} // onError: ignora ruído
    )
  } catch {
    setQrErr('Não consegui acessar a câmera. Dica: permita o uso da câmera ou cole o link abaixo.')
    scannerRef.current = null
  }
}

async function stopScanner() {
  try {
    await scannerRef.current?.stop()
    await scannerRef.current?.clear()
  } catch {}
  scannerRef.current = null
}

function openQr() {
  setQrOpen(true)
  setReaderId('')
  setManual('')
  setQrErr(null)
  setTimeout(startScanner, 50) // inicia após o modal montar
}

function closeQr() {
  setQrOpen(false)
  void stopScanner()
}

function submitManual() {
  const v = manual.trim()
  if (!v) return
  void handleDecoded(v)
}

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
          <div className="flex items-center gap-2">
            <button
              onClick={openQr}
              className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
              title="Ler QR de check-in"
            >
              Check-in por QR
            </button>
            <div className="flex rounded-lg overflow-hidden border">
              <button className={`px-3 py-1 text-sm ${viewMode==='list'?'bg-black text-white':'bg-white'}`} onClick={()=>setViewMode('list')}>Próximas</button>
              <button className={`px-3 py-1 text-sm ${viewMode==='calendar'?'bg-black text-white':'bg-white'}`} onClick={()=>setViewMode('calendar')}>Calendário</button>
            </div>
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

      {/* ==== Modal Scanner ==== */}
      {qrOpen && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeQr} />
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Check-in por QR</h3>
              <button onClick={closeQr} className="p-2 rounded hover:bg-gray-100" aria-label="Fechar">✕</button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border bg-black/90 text-white grid place-items-center p-3 min-h-[280px]">
                {readerId ? (
                  <div id={readerId} className="w-full max-w-xs aspect-square" />
                ) : (
                  <div className="text-sm opacity-80">Abrindo câmera…</div>
                )}
              </div>

              {qrErr && <div className="text-xs text-red-600">{qrErr}</div>}

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs text-zinc-600 mb-1">
                  Sem câmera? Cole aqui o link/código do QR:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 border rounded px-2 py-1 bg-white text-sm"
                    placeholder="Ex.: https://seuapp.com/app/checkin?t=...  ou  123e4567-e89b-12d3-a456-426614174000"
                    value={manual}
                    onChange={e=>setManual(e.target.value)}
                  />
                  <button onClick={submitManual} className="px-3 py-1.5 rounded border bg-white text-sm">
                    Confirmar
                  </button>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  Dica: permita o acesso à câmera do navegador para leitura automática.
                </div>
              </div>
            </div>
          </div>
        </div>
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
