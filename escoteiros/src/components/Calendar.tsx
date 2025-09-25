import { useMemo, useState } from 'react'

export type CalendarEvent = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  // opcional, usado no MeuPainel p/ indicar presença
  present?: boolean
}

function pad2(n: number) { return String(n).padStart(2, '0') }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth()+1, 0) }
function startOfWeek(d: Date) {
  // semana começando em DOM (0)
  const out = new Date(d)
  out.setDate(out.getDate() - out.getDay())
  out.setHours(0,0,0,0)
  return out
}
function addDays(d: Date, n: number) {
  const out = new Date(d); out.setDate(out.getDate()+n); return out
}

const WEEKLABELS = ['D','S','T','Q','Q','S','S'] as const

export default function Calendar({
  events,
  month,
  onMonthChange,
  renderDayFooter,
  className = '',
}: {
  events: CalendarEvent[]
  month?: Date // opcional; se não passar, interno
  onMonthChange?: (newMonthDate: Date)=>void
  renderDayFooter?: (dateStr: string, dayEvents: CalendarEvent[]) => React.ReactNode
  className?: string
}) {
  const [internal, setInternal] = useState<Date>(month ?? new Date())
  const shown = month ?? internal

  const first = startOfMonth(shown)
  const last = endOfMonth(shown)
  const gridStart = startOfWeek(first)
  const totalCells = 42 // 6 semanas

  // index events by date
  const map = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const arr = m.get(e.date) ?? []
      arr.push(e)
      m.set(e.date, arr)
    }
    return m
  }, [events])

  const go = (delta: number) => {
    const next = new Date(shown.getFullYear(), shown.getMonth()+delta, 1)
    if (month) onMonthChange?.(next)
    else setInternal(next)
  }

  const isToday = (d: Date) => {
    const t = new Date()
    return d.getFullYear()===t.getFullYear() && d.getMonth()===t.getMonth() && d.getDate()===t.getDate()
  }

  const monthLabel = shown.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className={`rounded-2xl border bg-white ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="font-semibold capitalize">{monthLabel}</div>
        <div className="flex gap-2">
          <button onClick={()=>go(-1)} className="px-2 py-1 rounded border">←</button>
          <button onClick={()=>go(+1)} className="px-2 py-1 rounded border">→</button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs text-zinc-500 px-3 pt-2">
        {WEEKLABELS.map(d => <div key={d} className="px-2 py-1 text-center">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2 p-3 pt-1">
        {Array.from({ length: totalCells }).map((_, i) => {
          const day = addDays(gridStart, i)
          const ds = ymd(day)
          const outside = day < first || day > last
          const list = map.get(ds) ?? []
          return (
            <div key={i} className={`rounded-lg border p-2 min-h-[88px] flex flex-col ${outside ? 'bg-zinc-50 opacity-70' : ''}`}>
              <div className="flex items-center justify-between">
                <div className={`text-xs ${outside?'text-zinc-400':'text-zinc-600'}`}>{day.getDate()}</div>
                {isToday(day) && <span className="text-[10px] px-1 rounded bg-emerald-600/10 text-emerald-700 border border-emerald-600/30">hoje</span>}
              </div>

              <div className="mt-1 space-y-1">
                {list.slice(0,3).map(ev => (
                  <div key={ev.id} title={ev.title}
                       className={`truncate text-[11px] px-1 py-0.5 rounded border ${ev.present
                         ? 'bg-emerald-600/10 text-emerald-700 border-emerald-600/30'
                         : 'bg-zinc-100 text-zinc-700 border-zinc-300'}`}>
                    {ev.title}
                  </div>
                ))}
                {list.length > 3 && (
                  <div className="text-[10px] text-zinc-500">+{list.length-3} eventos</div>
                )}
              </div>

              {renderDayFooter ? (
                <div className="mt-auto pt-1">{renderDayFooter(ds, list)}</div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
