import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import Calendar, { type CalendarEvent } from './Calendar'

function pad2(n:number){ return String(n).padStart(2,'0') }
function todayYMD(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
function monthEdges(d = new Date()){
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end   = new Date(d.getFullYear(), d.getMonth()+1, 0)
  const s = `${start.getFullYear()}-${pad2(start.getMonth()+1)}-${pad2(start.getDate())}`
  const e = `${end.getFullYear()}-${pad2(end.getMonth()+1)}-${pad2(end.getDate())}`
  return { start, end, s, e }
}

type ActRow = { id: string; title: string; date: string }

export default function AtividadesCalendar({ groupId }: { groupId: string | null }) {
  const [upcoming, setUpcoming] = useState<ActRow[]>([])
  const [month, setMonth] = useState<Date>(new Date())
  const [monthActs, setMonthActs] = useState<ActRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list'|'calendar'>('list')

  useEffect(()=>{
    if (!groupId) return
    let alive = true
    ;(async ()=>{
      setLoading(true)
      const today = todayYMD()
      const { s: monthStart, e: monthEnd } = monthEdges(month)

      const [upc, mon] = await Promise.all([
        supabase.from('activities').select('id,title,date').eq('group_id', groupId).gte('date', today).order('date', { ascending: true }).limit(20),
        supabase.from('activities').select('id,title,date').eq('group_id', groupId).gte('date', monthStart).lte('date', monthEnd).order('date', { ascending: true }),
      ])
      if (!alive) return

      setUpcoming((upc.data as ActRow[]) ?? [])
      setMonthActs((mon.data as ActRow[]) ?? [])
      setLoading(false)
    })()
    return ()=>{ alive = false }
  }, [groupId, month])

  const events: CalendarEvent[] = monthActs.map(a => ({ id: a.id, date: a.date, title: a.title }))

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Agenda do grupo</h2>
        <div className="flex rounded-lg overflow-hidden border">
          <button className={`px-3 py-1 text-sm ${mode==='list'?'bg-black text-white':'bg-white'}`} onClick={()=>setMode('list')}>Próximas</button>
          <button className={`px-3 py-1 text-sm ${mode==='calendar'?'bg-black text-white':'bg-white'}`} onClick={()=>setMode('calendar')}>Calendário</button>
        </div>
      </div>

      {mode==='list' ? (
        <div className="rounded-2xl border bg-white">
          {loading ? (
            <div className="p-6 text-sm text-zinc-600 text-center">Carregando…</div>
          ) : upcoming.length === 0 ? (
            <div className="p-6 text-sm text-zinc-600 text-center">Nenhuma atividade futura.</div>
          ) : (
            <ul className="divide-y">
              {upcoming.map(a => (
                <li key={a.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-zinc-600">{new Date(a.date).toLocaleDateString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <Calendar events={events} month={month} onMonthChange={setMonth} />
      )}
    </section>
  )
}
