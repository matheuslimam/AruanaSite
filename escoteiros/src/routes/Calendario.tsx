// src/routes/Calendario.tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useMyProfile } from '../guards'
import type { Activity, ActivityKind } from '../types'

type ActivityRow = Activity & { starts_at?: string | null; ends_at?: string | null }

const KIND_ICON: Record<ActivityKind, string> = {
  interna: '🏠',
  externa: '🚶',
  acampamento: '🏕️',
}
const KIND_LABEL: Record<ActivityKind, string> = {
  interna: 'Interna',
  externa: 'Externa',
  acampamento: 'Acampamento',
}

function pad2(n:number){ return String(n).padStart(2,'0') }
function toStartISO(a: ActivityRow){ return a.starts_at ?? (a.date ? new Date(a.date+'T00:00:00').toISOString() : null) }
function toEndISO(a: ActivityRow){ return a.ends_at ?? (a.date ? new Date(a.date+'T23:59:00').toISOString() : null) }
function sameYMD(a: Date, b: Date){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function dayKey(d: Date){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
function fmtRangeBR(sIso?: string|null, eIso?: string|null){
  if(!sIso) return '—'
  const s = new Date(sIso); const e = eIso ? new Date(eIso) : s
  const ds = `${pad2(s.getDate())}/${pad2(s.getMonth()+1)}/${s.getFullYear()}`
  const de = `${pad2(e.getDate())}/${pad2(e.getMonth()+1)}/${e.getFullYear()}`
  const hs = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`
  const he = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`
  return sameYMD(s,e) ? `${ds}, ${hs}–${he}` : `${ds} ${hs} — ${de} ${he}`
}
function startMs(a: ActivityRow){ const s=toStartISO(a); return s?new Date(s).getTime():0 }

export default function Calendario(){
  const { profile } = useMyProfile()
  const gid = profile?.group_id || null

  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [viewDate, setViewDate] = useState(()=> new Date())
  const [openAct, setOpenAct] = useState<ActivityRow|null>(null)
  const now = new Date()

  useEffect(()=>{ (async()=>{
    if(!gid) return
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('group_id', gid)
      .order('date', { ascending: false })
    setActivities((data as ActivityRow[])||[])
  })() },[gid])

  // próxima (apenas a mais próxima futura)
  const next = useMemo(()=>{
    const t = Date.now()
    return [...activities]
      .filter(a => startMs(a) >= t)
      .sort((a,b)=> startMs(a)-startMs(b))[0] || null
  }, [activities])

  // --- datas da visão atual ---
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const last  = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 0)

  // grid mensal (domingo a sábado, desktop)
  const startGrid = new Date(first); startGrid.setDate(first.getDate() - first.getDay())
  const daysGrid: Date[] = []
  for(let i=0;i<42;i++){ const d = new Date(startGrid); d.setDate(startGrid.getDate()+i); daysGrid.push(d) }

  // mapa (desktop): atividade aparece em TODOS os dias do intervalo
  const byDay = useMemo(()=>{
    const map: Record<string, ActivityRow[]> = {}
    for(const a of activities){
      const sIso = toStartISO(a); if(!sIso) continue
      const eIso = toEndISO(a) ?? sIso
      let d = new Date(new Date(sIso).getFullYear(), new Date(sIso).getMonth(), new Date(sIso).getDate())
      const end = new Date(new Date(eIso).getFullYear(), new Date(eIso).getMonth(), new Date(eIso).getDate())
      while(d.getTime() <= end.getTime()){
        const key = dayKey(d)
        map[key] = map[key] || []
        map[key].push(a)
        d = new Date(d); d.setDate(d.getDate()+1)
      }
    }
    for(const k of Object.keys(map)){ map[k].sort((a,b)=> startMs(a)-startMs(b)) }
    return map
  }, [activities])

  // --- MOBILE: itens agrupados (cada atividade uma vez, mesmo sendo multi-dia) ---
  const mobileItems = useMemo(()=>{
    const items = activities.filter(a=>{
      const sIso = toStartISO(a); if(!sIso) return false
      const eIso = toEndISO(a) ?? sIso
      const sDay = new Date(new Date(sIso).getFullYear(), new Date(sIso).getMonth(), new Date(sIso).getDate())
      const eDay = new Date(new Date(eIso).getFullYear(), new Date(eIso).getMonth(), new Date(eIso).getDate())
      return !(eDay < first || sDay > last) // tem intersecção com o mês
    })
    return items.sort((a,b)=> startMs(a)-startMs(b))
  }, [activities, first, last])

  // label "Outubro de 2025" (mês capitalizado, "de" minúsculo)
  const monthLabel = (() => {
    const m = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(viewDate)
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${viewDate.getFullYear()}`
  })()

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* Cabeçalho responsivo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold leading-tight">Agenda do grupo</h1>

        <div className="flex items-center gap-2 justify-center sm:justify-end flex-wrap">
          <button
            className="px-3 py-1 rounded border"
            onClick={()=>setViewDate(d=>new Date(d.getFullYear(), d.getMonth()-1, 1))}
            aria-label="Mês anterior"
          >
            ←
          </button>

          <div className="min-w-[12ch] text-center font-medium">
            {monthLabel}
          </div>

          <button
            className="px-3 py-1 rounded border"
            onClick={()=>setViewDate(d=>new Date(d.getFullYear(), d.getMonth()+1, 1))}
            aria-label="Próximo mês"
          >
            →
          </button>

          <button
            className="px-3 py-1 rounded border"
            onClick={()=>setViewDate(new Date())}
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Próxima atividade (apenas a próxima) */}
      <div className="mt-3 rounded-xl border p-3 bg-gradient-to-r from-amber-50 to-white">
        <div className="text-xs text-amber-700 font-semibold mb-1">Próxima atividade</div>
        {next ? (
          <button
            type="button"
            onClick={()=>setOpenAct(next)}
            className="w-full text-left flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{next.title}</div>
              <div className="mt-0.5 text-xs text-gray-600">{fmtRangeBR(toStartISO(next), toEndISO(next))}</div>
            </div>
            <span className="text-xl">{KIND_ICON[next.kind ?? 'interna']}</span>
          </button>
        ) : (
          <div className="text-sm text-gray-600">Sem próximas atividades.</div>
        )}
      </div>

      {/* Calendário mensal (desktop) */}
      <div className="mt-4 rounded-2xl border overflow-hidden hidden md:block">
        <div className="grid grid-cols-7 text-xs bg-slate-50 border-b">
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>(
            <div key={d} className="px-2 py-2 font-medium text-slate-600">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {daysGrid.map((d,i)=>{
            const inMonth = d.getMonth()===viewDate.getMonth()
            const k = dayKey(d)
            const list = byDay[k] || []
            const isToday = sameYMD(d, now)
            return (
              <div
                key={i}
                className={`min-h-[92px] border-b border-r p-2 ${i%7===6?'border-r-0':''} ${!inMonth?'bg-slate-50/40 text-slate-400':''} ${isToday?'bg-emerald-50/60':''}`}
              >
                <div className="text-xs font-semibold">{d.getDate()}</div>
                <div className="mt-1 space-y-1">
                  {list.slice(0,3).map(a=>(
                    <button
                      type="button"
                      key={a.id}
                      onClick={()=>setOpenAct(a)}
                      className="w-full text-left text-[11px] leading-tight px-2 py-1 rounded border bg-white hover:bg-gray-50"
                    >
                      <span className="mr-1">{KIND_ICON[a.kind ?? 'interna']}</span>
                      <span className="font-medium">{a.title}</span>
                    </button>
                  ))}
                  {list.length>3 && (
                    <div className="text-[11px] text-slate-500">+{list.length-3} mais…</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Agenda (mobile) — AGRUPADA (cada atividade 1x) */}
      <div className="mt-4 rounded-2xl border overflow-hidden md:hidden">
        {mobileItems.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-600">Sem eventos neste mês.</div>
        ) : (
          <ul className="divide-y">
            {mobileItems.map(a=>(
              <li key={a.id} className="p-3">
                <button
                  type="button"
                  onClick={()=>setOpenAct(a)}
                  className="w-full text-left rounded-xl border px-3 py-2 bg-white hover:bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{KIND_ICON[a.kind ?? 'interna']}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.title}</div>
                      <div className="text-[12px] text-slate-600">{fmtRangeBR(toStartISO(a), toEndISO(a))}</div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 text-sm text-slate-500">
        * No desktop, eventos multi-dia aparecem em todos os dias do intervalo. No celular, eles são <b>agrupados</b> em um único item com o período completo.
      </div>

      {/* ===== Modal resumo ===== */}
      {openAct && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setOpenAct(null)} />
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Resumo da atividade</h3>
              <button onClick={()=>setOpenAct(null)} className="p-2 rounded hover:bg-gray-100" aria-label="Fechar">✕</button>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{KIND_ICON[openAct.kind ?? 'interna']}</div>
                <div>
                  <div className="font-semibold text-lg leading-tight">{openAct.title}</div>
                  <div className="text-sm text-slate-600">{KIND_LABEL[openAct.kind ?? 'interna']}</div>
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs text-gray-600 mb-1">Quando</div>
                <div className="text-sm">{fmtRangeBR(toStartISO(openAct), toEndISO(openAct))}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button onClick={()=>setOpenAct(null)} className="px-3 py-2 rounded border bg-white">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
