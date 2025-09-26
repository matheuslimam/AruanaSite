import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Activity, ActivityKind, Member, Patrol, PatrolCategory } from '../types'
import { ChipGroup } from '../components/Chip'
import { useMyProfile } from '../guards'

type ExtraKey = string
type ExtraDef = { key: ExtraKey; label: string }

// estende Activity com os campos de horário
type ActivityRow = Activity & { starts_at?: string | null; ends_at?: string | null }

const SECTION_OPTS: { label: string; value: 'all' | PatrolCategory }[] = [
  { label: 'Todos',      value: 'all' },
  { label: 'Lobinhos',   value: 'lobinhos' },
  { label: 'Escoteiros', value: 'escoteiros' },
  { label: 'Seniors',    value: 'seniors' },
]

const KIND_OPTS: { label: string; value: ActivityKind }[] = [
  { label: 'Interna',      value: 'interna' },
  { label: 'Externa',      value: 'externa' },
  { label: 'Acampamento',  value: 'acampamento' },
]
const KIND_FILTER_OPTS: { label: string; value: 'all' | ActivityKind }[] = [
  { label: 'Todos os tipos', value: 'all' },
  ...KIND_OPTS
]
const KIND_ICON: Record<ActivityKind, string> = {
  interna: '🏠',
  externa: '🚶',
  acampamento: '🏕️',
}

/* ===== utils ===== */
const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
function escapeRegExp(s: string){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
const eq = (a:any,b:any)=> JSON.stringify(a)===JSON.stringify(b)
function pad2(n:number){ return String(n).padStart(2,'0') }

function toDatetimeLocalInput(d: Date){
  const y = d.getFullYear()
  const m = pad2(d.getMonth()+1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${y}-${m}-${day}T${hh}:${mm}`
}
function fromDatetimeLocalInput(s: string): string {
  const dt = new Date(s) // interpreta em localtime
  return dt.toISOString()
}
function startsISO(a: ActivityRow): string | null {
  if (a.starts_at) return a.starts_at
  if (a.date)      return new Date(a.date + 'T00:00:00').toISOString()
  return null
}
function endsISO(a: ActivityRow): string | null {
  if (a.ends_at) return a.ends_at
  if (a.date)    return new Date(a.date + 'T23:59:00').toISOString()
  return null
}
function startMs(a: ActivityRow){ const s = startsISO(a); return s ? new Date(s).getTime() : 0 }
function endMs(a: ActivityRow){ const e = endsISO(a); return e ? new Date(e).getTime() : startMs(a) }
function sameDay(d1: Date, d2: Date){
  return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate()
}
function fmtRangeBR(startIso?: string|null, endIso?: string|null){
  if (!startIso) return '—'
  const s = new Date(startIso)
  const e = endIso ? new Date(endIso) : s
  const ds = `${pad2(s.getDate())}/${pad2(s.getMonth()+1)}/${s.getFullYear()}`
  const de = `${pad2(e.getDate())}/${pad2(e.getMonth()+1)}/${e.getFullYear()}`
  const hs = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`
  const he = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`
  return sameDay(s,e) ? `${ds}, ${hs}–${he}` : `${ds} ${hs} — ${de} ${he}`
}
function includesToday(a: ActivityRow){
  const t = new Date()
  const sIso = startsISO(a); if(!sIso) return false
  const eIso = endsISO(a) ?? sIso
  const s = new Date(sIso); const e = new Date(eIso)
  const t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  const s0 = new Date(s.getFullYear(), s.getMonth(), s.getDate())
  const e0 = new Date(e.getFullYear(), e.getMonth(), e.getDate())
  return s0.getTime() <= t0.getTime() && t0.getTime() <= e0.getTime()
}

export default function Atividades(){
  const { profile } = useMyProfile()
  const gid = profile?.group_id || null

  // ===== state =====
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [title, setTitle] = useState('')

  const now = new Date()
  const defStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0)
  const defEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0)
  const [startLocal, setStartLocal] = useState<string>(()=> toDatetimeLocalInput(defStart))
  const [endLocal,   setEndLocal]   = useState<string>(()=> toDatetimeLocalInput(defEnd))
  const [kind, setKind] = useState<ActivityKind>('interna')
  const [selected, setSelected] = useState<ActivityRow|null>(null)

  const [members, setMembers] = useState<Member[]>([])
  const [patrols, setPatrols] = useState<Patrol[]>([])

  // filtros
  const [filterSection, setFilterSection] = useState<'all' | PatrolCategory>('all')
  const [filterKind, setFilterKind]       = useState<'all' | ActivityKind>('all')

  // presença e pontos
  const [present, setPresent] = useState<Record<string, boolean>>({})
  const [basePoints, setBasePoints] = useState<number>(1)

  // extras
  const [extraDefs, setExtraDefs] = useState<ExtraDef[]>([
    { key: 'uniforme',      label: 'Uniforme' },
    { key: 'comportamento', label: 'Comportamento' },
  ])
  const [extrasSelected, setExtrasSelected] = useState<Record<string, Record<ExtraKey, boolean>>>({})

  // bônus por patrulha
  const [bonusByPatrol, setBonusByPatrol] = useState<Record<string, number>>({})

  // snapshots
  const [snapPresent, setSnapPresent] = useState<Record<string, boolean>>({})
  const [snapBasePoints, setSnapBasePoints] = useState<number>(1)
  const [snapExtraDefs, setSnapExtraDefs] = useState<ExtraDef[]>([])
  const [snapExtrasSelected, setSnapExtrasSelected] =
    useState<Record<string, Record<ExtraKey, boolean>>>({})
  const [snapBonusByPatrol, setSnapBonusByPatrol] = useState<Record<string, number>>({})

  // ui
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [newParamLabel, setNewParamLabel] = useState('')
  const [loadingHydrate, setLoadingHydrate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // edição meta
  const [isEditingMeta, setIsEditingMeta] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editKind, setEditKind] = useState<ActivityKind>('interna')
  const [editStartLocal, setEditStartLocal] = useState<string>(toDatetimeLocalInput(defStart))
  const [editEndLocal,   setEditEndLocal]   = useState<string>(toDatetimeLocalInput(defEnd))

  // QR
  const [qrOpen, setQrOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState<string>('')
  const [qrImg, setQrImg] = useState<string>('')
  const [issuing, setIssuing] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<{ expires_at?: string }|null>(null)

  // ===== queries =====
  const sortActivities = (arr: ActivityRow[]) =>
    [...arr].sort((a,b)=> (startMs(b)-startMs(a)) || (a.title||'').localeCompare(b.title||''))

  useEffect(()=>{ (async()=>{
    if (!gid) return
    setActivities([]); setMembers([]); setPatrols([]); setSelected(null)

    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('group_id', gid)
      .order('date', { ascending: false })
    setActivities(sortActivities((acts as ActivityRow[]) || []))

    const { data: mem } = await supabase
      .from('profiles')
      .select('id, display_name, patrol_id, is_youth')
      .eq('group_id', gid)
      .eq('is_youth', true)
      .order('display_name')
    setMembers((mem as any) || [])

    const { data: pats } = await supabase
      .from('patrols')
      .select('*')
      .eq('group_id', gid)
      .order('name')
    setPatrols((pats as any) || [])
  })() },[gid])

  // próxima atividade (futura mais próxima)
  const nextActivity = useMemo(()=>{
    const nowMs = Date.now()
    return [...activities]
      .filter(a => startMs(a) >= nowMs)
      .sort((a,b)=> startMs(a) - startMs(b))[0]
  }, [activities])

  async function createActivity(){
    if (!title.trim()){ alert('Dê um título para a atividade.'); return }
    const startIso = fromDatetimeLocalInput(startLocal)
    const endIso   = fromDatetimeLocalInput(endLocal)
    if (new Date(endIso) < new Date(startIso)){ alert('Término antes do início.'); return }

    const { data: user } = await supabase.auth.getUser()
    const payload = {
      title,
      kind,
      starts_at: startIso,
      ends_at: endIso,
      date: startIso.slice(0,10), // compat
      created_by: user.user?.id
    }
    const { data, error } = await supabase.from('activities').insert(payload).select('*').single()
    if (error){ alert(error.message); return }

    setActivities(prev => sortActivities([data as ActivityRow, ...prev]))
    setSelected(data as ActivityRow)
    setTitle(''); setStartLocal(toDatetimeLocalInput(defStart)); setEndLocal(toDatetimeLocalInput(defEnd))
    setKind('interna')
  }

  function startEditMeta(){
    if (!selected) return
    setEditTitle(selected.title)
    setEditKind(selected.kind ?? 'interna')
    const s = startsISO(selected); const e = endsISO(selected)
    setEditStartLocal(s ? toDatetimeLocalInput(new Date(s)) : toDatetimeLocalInput(defStart))
    setEditEndLocal(e ? toDatetimeLocalInput(new Date(e))   : toDatetimeLocalInput(defEnd))
    setIsEditingMeta(true)
  }
  function cancelEditMeta(){ setIsEditingMeta(false) }

  async function saveEditMeta(){
    if (!selected) return
    const newTitle = editTitle.trim(); if(!newTitle){ alert('Preencha o título.'); return }
    const sIso = fromDatetimeLocalInput(editStartLocal)
    const eIso = fromDatetimeLocalInput(editEndLocal)
    if (new Date(eIso) < new Date(sIso)){ alert('Término antes do início.'); return }

    const patch = { title: newTitle, kind: editKind, starts_at: sIso, ends_at: eIso, date: sIso.slice(0,10) }
    const { data, error } = await supabase.from('activities').update(patch).eq('id', selected.id).select('*').single()
    if (error){ alert(error.message); return }

    setActivities(prev => sortActivities(prev.map(a => a.id === selected.id ? (data as ActivityRow) : a)))
    setSelected(data as ActivityRow); setIsEditingMeta(false)
  }

  async function deleteActivity(a: ActivityRow){
    if (!confirm(`Excluir a atividade "${a.title}"?`)) return
    setDeletingId(a.id)
    try{
      await supabase.from('attendance').delete().eq('activity_id', a.id)
      await supabase.from('points').delete().eq('activity_id', a.id)
      const { error } = await supabase.from('activities').delete().eq('id', a.id)
      if (error) throw error
      setActivities(prev => prev.filter(x => x.id !== a.id))
      if (selected?.id === a.id) setSelected(null)
    } catch(e:any){ alert(e?.message || 'Erro ao excluir') }
    finally{ setDeletingId(null) }
  }

  // ===== presença / pontos =====
  const patrolsMap = useMemo(()=>{
    const m = new Map<string, Patrol>(); patrols.forEach(p=>m.set(p.id, p)); return m
  }, [patrols])
  function patrolName(id: string | null){ return id ? (patrolsMap.get(id)?.name || '—') : '—' }
  function memberSection(m: Member): PatrolCategory | null {
    if (!m.patrol_id) return null
    return patrolsMap.get(m.patrol_id)?.category ?? null
  }
  const filteredMembers = useMemo(()=>{
    if (filterSection === 'all') return members
    return members.filter(m => memberSection(m) === filterSection)
  }, [members, filterSection, patrolsMap])
  const presentCount = useMemo(()=> Object.entries(present)
    .filter(([id,v]) => v && filteredMembers.some(m => m.id===id)).length
  , [present, filteredMembers])

  function toggleExtra(memberId: string, extraKey: ExtraKey, checked: boolean){
    setExtrasSelected(prev => ({ ...prev, [memberId]: { ...(prev[memberId] || {}), [extraKey]: checked } }))
  }

  async function hydrateFromDb(activity: ActivityRow){
    setLoadingHydrate(true)
    try{
      setPresent({}); setExtrasSelected({}); setBonusByPatrol({})
      setBasePoints(1)
      setSnapPresent({}); setSnapExtrasSelected({}); setSnapBonusByPatrol({})
      setSnapBasePoints(1); setSnapExtraDefs([])

      const { data: att } = await supabase.from('attendance').select('member_id').eq('activity_id', activity.id)
      const presMap: Record<string, boolean> = {}
      att?.forEach(a => { presMap[a.member_id as string] = true })
      setPresent(presMap); setSnapPresent(presMap)

      const { data: pts } = await supabase
        .from('points').select('member_id, patrol_id, points, reason')
        .eq('activity_id', activity.id)

      if (!pts || pts.length === 0) {
        setSnapExtraDefs(structuredClone(extraDefs))
        return
      }

      const presenceReason = `Presença em ${activity.title}`
      const bonusReason    = `Bônus patrulha em ${activity.title}`
      const reasonToLabel  = (reason: string) => reason.replace(new RegExp(` em ${escapeRegExp(activity.title)}$`), '')

      let inferredBase: number | null = null
      const anyPresence = pts.find(p => p.reason === presenceReason && (p as any).member_id)
      if (anyPresence) inferredBase = Number(anyPresence.points || 1)

      const labelsFound = new Set<string>()
      const selectedMap: Record<string, Record<ExtraKey, boolean>> = {}

      for (const p of pts){
        const mid = (p as any).member_id as string | null
        const pid = (p as any).patrol_id as string | null
        const reason = String((p as any).reason || '')
        if (pid && reason === bonusReason) continue
        if (reason === presenceReason) continue

        const label = reasonToLabel(reason)
        labelsFound.add(label)

        if (mid){
          const key = slug(label)
          selectedMap[mid] = selectedMap[mid] || {}
          selectedMap[mid][key] = true
        }
        if (inferredBase == null) inferredBase = Number(p.points || 1) || 1
      }

      setBasePoints(inferredBase ?? 1)
      setSnapBasePoints(inferredBase ?? 1)

      const merged: ExtraDef[] = []
      const used = new Set<string>()
      const pushDef = (label: string) => {
        const key = slug(label) || `extra-${Date.now()}`
        if (used.has(key)) return
        used.add(key); merged.push({ key, label })
      }
      for (const lbl of labelsFound) pushDef(lbl)
      for (const d of ['Uniforme','Comportamento']) pushDef(d)

      setExtraDefs(merged); setSnapExtraDefs(structuredClone(merged))
      setExtrasSelected(selectedMap); setSnapExtrasSelected(structuredClone(selectedMap))

      const bonusMap: Record<string, number> = {}
      for (const p of pts){
        const pid = (p as any).patrol_id as string | null
        if (pid && p.reason === bonusReason){
          bonusMap[pid] = (bonusMap[pid] ?? 0) + Number(p.points || 0)
        }
      }
      setBonusByPatrol(bonusMap); setSnapBonusByPatrol(structuredClone(bonusMap))
    } finally { setLoadingHydrate(false) }
  }

  useEffect(()=>{
    if (selected) {
      setEditTitle(selected.title); setEditKind(selected.kind ?? 'interna')
      const s = startsISO(selected); const e = endsISO(selected)
      setEditStartLocal(s ? toDatetimeLocalInput(new Date(s)) : toDatetimeLocalInput(defStart))
      setEditEndLocal(e ? toDatetimeLocalInput(new Date(e))   : toDatetimeLocalInput(defEnd))
      setIsEditingMeta(false)
      void hydrateFromDb(selected)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  async function persistDiff({ diffOnly }: { diffOnly: boolean }): Promise<boolean>{
    if (!selected) return false
    let changed = false

    if (!diffOnly || !eq(present, snapPresent)) {
      await supabase.from('attendance').delete().eq('activity_id', selected.id)
      const rows = Object.entries(present).filter(([,v])=>v).map(([member_id])=>({ activity_id: selected.id, member_id }))
      if (rows.length){
        const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'activity_id,member_id', ignoreDuplicates: true })
        if (error) throw new Error('[attendance.upsert] ' + error.message)
      }
      changed = true
    }

    const items: any[] = []
    const presenceReason = `Presença em ${selected.title}`
    const presenceNeedsRewrite = !diffOnly || basePoints !== snapBasePoints || !eq(present, snapPresent)

    if (basePoints > 0 && Object.values(present).some(Boolean) && presenceNeedsRewrite){
      await supabase.from('points').delete().eq('activity_id', selected.id).eq('reason', presenceReason)
      for (const [member_id, v] of Object.entries(present)){
        if (v) items.push({ member_id, activity_id: selected.id, points: basePoints, reason: presenceReason })
      }
      changed = true
    }

    const extrasChanged = !eq(extraDefs, snapExtraDefs) || !eq(extrasSelected, snapExtrasSelected) || basePoints !== snapBasePoints
    if (!diffOnly || extrasChanged){
      for (const def of extraDefs){
        const reason = `${def.label} em ${selected.title}`
        await supabase.from('points').delete().eq('activity_id', selected.id).eq('reason', reason)
      }
      for (const m of members){
        const sel = extrasSelected[m.id] || {}
        for (const def of extraDefs){
          if (sel[def.key]) items.push({ member_id: m.id, activity_id: selected.id, points: basePoints, reason: `${def.label} em ${selected.title}` })
        }
      }
      if (extrasChanged) changed = true
    }

    const allPatrolIds = Array.from(new Set([...Object.keys(bonusByPatrol), ...Object.keys(snapBonusByPatrol)]))
    for (const pid of allPatrolIds){
      const nowVal  = Number(bonusByPatrol[pid]  || 0)
      const snapVal = Number(snapBonusByPatrol[pid] || 0)
      if (!diffOnly || nowVal !== snapVal){
        const reason = `Bônus patrulha em ${selected.title}`
        await supabase.from('points').delete().eq('activity_id', selected.id).eq('reason', reason).eq('patrol_id', pid)
        if (nowVal > 0) items.push({ patrol_id: pid, activity_id: selected.id, points: nowVal, reason })
        if (nowVal !== snapVal) changed = true
      }
    }

    if (items.length){
      const { error } = await supabase.functions.invoke('award-points', { body: { items } })
      if (error) {
        const res = (error as any).context?.response
        const txt = res ? await res.text() : (error as any).message
        throw new Error('[award-points] ' + txt)
      }
    }

    if (changed){
      setSnapPresent(structuredClone(present))
      setSnapBasePoints(basePoints)
      setSnapExtraDefs(structuredClone(extraDefs))
      setSnapExtrasSelected(structuredClone(extrasSelected))
      setSnapBonusByPatrol(structuredClone(bonusByPatrol))
    }
    return changed
  }

  async function salvarChamadaEPontos(){ if(!selected) return; setSaving(true); try{ await persistDiff({ diffOnly:false }); alert('Chamada e pontos salvos!') } finally{ setSaving(false) } }
  async function atualizarSomenteMudancas(){ if(!selected) return; setUpdating(true); try{ const changed = await persistDiff({ diffOnly:true }); alert(changed?'Atualizado com sucesso!':'Nada para atualizar.') } finally{ setUpdating(false) } }

  // agrupamento para bônus
  const patrolsByCat = useMemo(()=>{
    const g: Record<PatrolCategory, Patrol[]> = { lobinhos: [], escoteiros: [], seniors: [] }
    for (const p of patrols) g[p.category].push(p)
    for (const k of Object.keys(g) as PatrolCategory[]) g[k].sort((a,b)=> a.name.localeCompare(b.name))
    return g
  }, [patrols])

  function addParam(){
    const label = newParamLabel.trim(); if(!label) return
    const key = slug(label) || `extra-${Date.now()}`
    if (extraDefs.some(d=>d.key===key)){ alert('Esse parâmetro já existe.'); return }
    setExtraDefs(prev => [...prev, { key, label }]); setNewParamLabel('')
  }

  // filtros
  const visibleActivities = useMemo(()=>{
    const arr = (filterKind === 'all') ? activities : activities.filter(a => (a.kind ?? 'interna') === filterKind)
    return sortActivities(arr)
  }, [activities, filterKind])

  // URL helpers
  const CHECKIN_BASE = new URL('app/checkin', new URL(import.meta.env.BASE_URL, window.location.origin))
  const makeCheckinUrl = (params: Record<string, string>) => {
    const u = new URL(CHECKIN_BASE); Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v)); return u.toString()
  }

  async function openQrModal() {
    if (!selected) return
    setIssuing(true); setQrOpen(true)
    try{
      let url = makeCheckinUrl({ a: selected.id })
      let meta: { expires_at?: string } | null = null
      try {
        const { data, error } = await supabase.functions.invoke('issue-checkin-token', { body: { activity_id: selected.id } })
        if (!error && (data as any)?.token) { url = makeCheckinUrl({ t: (data as any).token }); meta = { expires_at: (data as any)?.expires_at } }
      } catch {}
      setQrUrl(url); setTokenInfo(meta)
      try {
        const QR: any = await import('qrcode')
        const png: string = await QR.toDataURL(url, { margin: 1, width: 512 })
        setQrImg(png)
      } catch { setQrImg(`https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(url)}`) }
    } finally { setIssuing(false) }
  }
  async function copyQrUrl(){ try{ await navigator.clipboard.writeText(qrUrl); alert('Link de check-in copiado!') } catch{} }

  const selectedIsToday = selected ? includesToday(selected) : false

  /* ===== render ===== */
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sticky top-16 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b pt-2 pb-3">
        <h1 className="text-2xl font-bold">Atividades</h1>

        {/* Próxima atividade (card) */}
        {nextActivity && (
          <div className="mt-3 rounded-xl border p-3 bg-gradient-to-r from-amber-50 to-white">
            <div className="text-xs text-amber-700 font-semibold mb-1">Próxima atividade</div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{nextActivity.title}</div>
                <div className="mt-0.5 text-xs text-gray-600">{fmtRangeBR(startsISO(nextActivity), endsISO(nextActivity))}</div>
              </div>
              <button onClick={()=> setSelected(nextActivity)} className="px-3 py-1.5 rounded-lg text-sm bg-black text-white">
                Abrir
              </button>
            </div>
          </div>
        )}

        {/* Criar */}
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="border rounded-lg px-3 py-2 flex-1 min-w-[140px]" placeholder="Título da atividade" value={title} onChange={e=>setTitle(e.target.value)} />
          <input type="datetime-local" className="border rounded-lg px-3 py-2" value={startLocal} onChange={e=>setStartLocal(e.target.value)} title="Início" />
          <input type="datetime-local" className="border rounded-lg px-3 py-2" value={endLocal}   onChange={e=>setEndLocal(e.target.value)}   title="Término" />
          <select className="border rounded-lg px-3 py-2" value={kind} onChange={e=>setKind(e.target.value as ActivityKind)}>
            {KIND_OPTS.map(k=> <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <button onClick={createActivity} className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90">Criar</button>
        </div>

        {/* Filtro por tipo */}
        <div className="mt-3">
          <div className="text-sm mb-1">Filtrar por tipo:</div>
          <ChipGroup options={KIND_FILTER_OPTS as any} value={filterKind as any} onChange={(v)=>setFilterKind(v as any)} theme="light" />
        </div>
      </div>

      {/* Lista */}
      <ul className="mt-4 grid gap-3">
        {visibleActivities.map(a=> {
          const today = includesToday(a)
          return (
            <li key={a.id} className={`rounded-xl border p-3 cursor-pointer transition hover:shadow-sm ${selected?.id===a.id?'bg-slate-50 ring-1 ring-slate-200':''}`} onClick={()=> setSelected(a)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium flex items-center flex-wrap gap-2">
                    <span className="truncate">{a.title}</span>
                    <KindBadge k={a.kind ?? 'interna'} />
                    {today && <TodayBadge />}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">{fmtRangeBR(startsISO(a), endsISO(a))}</div>
                </div>
                <button onClick={(e)=>{ e.stopPropagation(); deleteActivity(a) }} disabled={deletingId === a.id} className={`px-2 py-1 rounded-lg border text-sm hover:bg-gray-50 ${deletingId===a.id ? 'opacity-60 cursor-not-allowed' : ''}`} title="Excluir atividade">
                  {deletingId === a.id ? 'Excluindo…' : 'Excluir'}
                </button>
              </div>
            </li>
          )
        })}
        {visibleActivities.length === 0 && (
          <li className="rounded-xl border p-6 text-sm text-gray-500 text-center">Nenhuma atividade. Crie a primeira acima.</li>
        )}
      </ul>

      {/* Painel direita: Detalhes + Chamada/Pontos */}
      <div className="mt-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chamada & Pontos {selected?`— ${selected.title}`:''}</h2>
          {selected && (
            <div className="text-xs text-gray-500">
              {selectedIsToday && <span className="px-2 py-0.5 rounded-full bg-green-100 border border-green-300 mr-2">Hoje</span>}
              Presenças: <span className="font-semibold">{presentCount}</span>
            </div>
          )}
        </div>

        {!selected && (
          <div className="rounded-2xl border p-6 text-sm text-gray-600">Crie ou selecione uma atividade para abrir a chamada.</div>
        )}

        {selected && (
          <>
            {/* METADADOS */}
            <div className={`rounded-2xl border p-3 ring-1 ring-inset ${selectedIsToday ? 'ring-emerald-200' : 'ring-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">Detalhes da atividade</div>
                <div className="flex items-center gap-2">
                  <button onClick={openQrModal} className="px-2 py-1 rounded-lg border text-sm hover:bg-gray-50">QR de check-in</button>
                  {!isEditingMeta ? (
                    <button onClick={startEditMeta} className="px-2 py-1 rounded-lg border text-sm hover:bg-gray-50">Editar</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={saveEditMeta} className="px-2 py-1 rounded-lg bg-black text-white text-sm">Salvar</button>
                      <button onClick={cancelEditMeta} className="px-2 py-1 rounded-lg border text-sm">Cancelar</button>
                    </div>
                  )}
                </div>
              </div>

              {!isEditingMeta ? (
                <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
                  <InfoItem label="Título" value={selected.title} />
                  <InfoItem label="Quando" value={fmtRangeBR(startsISO(selected), endsISO(selected))} />
                  <InfoItem label="Tipo" value={KIND_OPTS.find(o=>o.value===selected.kind)?.label ?? '—'} />
                </div>
              ) : (
                <div className="mt-3 grid sm:grid-cols-4 gap-3">
                  <input className="border rounded-lg px-3 py-2 sm:col-span-2" value={editTitle} onChange={e=>setEditTitle(e.target.value)} placeholder="Título" />
                  <select className="border rounded-lg px-3 py-2" value={editKind} onChange={e=>setEditKind(e.target.value as ActivityKind)}>
                    {KIND_OPTS.map(k=> <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="datetime-local" className="border rounded-lg px-3 py-2" value={editStartLocal} onChange={e=>setEditStartLocal(e.target.value)} title="Início" />
                    <input type="datetime-local" className="border rounded-lg px-3 py-2" value={editEndLocal} onChange={e=>setEditEndLocal(e.target.value)} title="Término" />
                  </div>
                </div>
              )}
            </div>

            {/* filtros + ponto base */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm">Filtrar membros por seção:</div>
                <ChipGroup options={SECTION_OPTS as any} value={filterSection as any} onChange={(v)=>setFilterSection(v as any)} theme="light" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Pontos base geral</span>
                <input type="number" className="w-24 border rounded-lg px-2 py-1" value={basePoints} onChange={e=>setBasePoints(parseInt(e.target.value||'0'))} />
              </div>
            </div>

            {/* chamada + extras */}
            <div className="rounded-2xl border overflow-hidden">
              <div className="bg-gradient-to-r from-slate-50 to-white px-3 py-2 text-xs text-slate-600 border-b">
                Marque presença e extras (cada extra vale o “ponto base”).
                {loadingHydrate && <span className="ml-2 italic text-slate-400">(carregando…)</span>}
              </div>

              {/* MOBILE */}
              <div className="md:hidden divide-y">
                {filteredMembers.map((m) => {
                  const checked = !!present[m.id]
                  const rowSel  = extrasSelected[m.id] || {}
                  const cat     = memberSection(m)
                  return (
                    <div key={m.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <label className="inline-flex items-center gap-2 select-none">
                          <input type="checkbox" className="h-5 w-5" checked={checked} onChange={e=>setPresent(prev=>({...prev, [m.id]: e.target.checked}))} />
                          <span className="text-sm font-medium">{m.display_name}</span>
                        </label>
                        <div>
                          {cat && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ring-inset ${
                              cat==='lobinhos'   ? 'bg-emerald-100 text-emerald-700 ring-emerald-300' :
                              cat==='escoteiros' ? 'bg-sky-100 text-sky-700 ring-sky-300' :
                                                   'bg-violet-100 text-violet-700 ring-violet-300'
                            }`}>{cat}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Patrulha: <span className="font-medium text-slate-700">{patrolName(m.patrol_id)}</span>
                      </div>
                      {extraDefs.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {extraDefs.map(d => (
                            <label key={d.key} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" className="h-4 w-4" checked={!!rowSel[d.key]} onChange={e=>toggleExtra(m.id, d.key, e.target.checked)} />
                              <span className="truncate">{d.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {filteredMembers.length === 0 && <div className="p-6 text-center text-sm text-gray-500">Nenhum membro na filtragem atual.</div>}
              </div>

              {/* DESKTOP */}
              <div className="hidden md:block max-h-[460px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b">
                    <tr className="text-left">
                      <th className="p-2 w-14">Pres.</th>
                      <th className="py-2">Nome</th>
                      <th className="py-2">Patrulha</th>
                      {extraDefs.map(d=>(<th key={d.key} className="py-2 text-center">{d.label}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m, idx)=>{
                      const checked = !!present[m.id]
                      const rowSel  = extrasSelected[m.id] || {}
                      const cat     = memberSection(m)
                      const stripe  = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      const ring    = cat==='lobinhos'   ? 'ring-emerald-200' :
                                      cat==='escoteiros' ? 'ring-sky-200'     :
                                      cat==='seniors'    ? 'ring-violet-200'  : 'ring-slate-200'
                      return (
                        <tr key={m.id} className={`${stripe} border-b`}>
                          <td className="p-2">
                            <input type="checkbox" className="h-4 w-4" checked={checked} onChange={e=>setPresent(prev=>({...prev, [m.id]: e.target.checked}))} />
                          </td>
                          <td className="py-2">
                            <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-lg ring-1 ring-inset ${ring}`}>
                              <span className="font-medium">{m.display_name}</span>
                              {cat && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  cat==='lobinhos'   ? 'bg-emerald-100 text-emerald-700' :
                                  cat==='escoteiros' ? 'bg-sky-100 text-sky-700' :
                                                       'bg-violet-100 text-violet-700'
                                }`}>{cat}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2">{patrolName(m.patrol_id)}</td>
                          {extraDefs.map(d=>(
                            <td key={d.key} className="py-2 text-center">
                              <input type="checkbox" className="h-4 w-4" checked={!!rowSel[d.key]} onChange={e=>toggleExtra(m.id, d.key, e.target.checked)} />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                    {filteredMembers.length === 0 && (
                      <tr><td colSpan={3 + extraDefs.length} className="py-8 text-center text-gray-500">Nenhum membro na filtragem atual.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* adicionar extra */}
            <div className="rounded-2xl border p-3">
              <div className="text-sm font-medium mb-2">Adicionar parâmetro de pontuação (extra)</div>
              <div className="flex flex-wrap items-end gap-2">
                <input className="border rounded-lg px-3 py-2 flex-1 min-w-[200px]" placeholder="Ex.: Pontualidade" value={newParamLabel} onChange={e=>setNewParamLabel(e.target.value)} />
                <button onClick={addParam} className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90">Adicionar</button>
              </div>
              <div className="text-xs text-gray-500 mt-1">* Cada extra marcado vale os “Pontos base geral”.</div>
            </div>

            {/* bônus por patrulha */}
            <div className="rounded-2xl border p-3 space-y-5">
              <div className="font-medium">Bônus por Patrulha</div>
              {(['lobinhos','escoteiros','seniors'] as PatrolCategory[]).map(cat => (
                <div key={cat} className="space-y-2">
                  <div className="text-sm font-semibold">
                    {{lobinhos:'Lobinhos',escoteiros:'Escoteiros',seniors:'Seniors'}[cat]}
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {patrolsByCat[cat].length === 0 ? (
                      <div className="text-sm text-gray-500">Sem patrulhas nesta seção.</div>
                    ) : patrolsByCat[cat].map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 bg-white">
                        <span className="font-medium">{p.name}</span>
                        <input type="number" className="w-24 border rounded-lg px-2 py-1"
                          value={bonusByPatrol[p.id] ?? 0}
                          onChange={e=>setBonusByPatrol(prev=>({ ...prev, [p.id]: parseInt(e.target.value||'0') }))}
                          placeholder="Pontos"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* actions */}
            <div className="sticky bottom-4">
              <div className="rounded-2xl border bg-white/90 backdrop-blur px-3 py-2 flex items-center gap-2 shadow-sm">
                <button onClick={salvarChamadaEPontos} disabled={saving} className={`px-3 py-2 rounded-lg text-white ${saving ? 'bg-gray-600' : 'bg-black hover:opacity-90'}`}>
                  {saving ? 'Salvando...' : 'Salvar (regravar tudo)'}
                </button>
                <button onClick={atualizarSomenteMudancas} disabled={updating} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50">
                  {updating ? 'Atualizando...' : 'Atualizar (somente mudanças)'}
                </button>
                <div className="ml-auto text-xs text-slate-500">Presenças <span className="font-semibold">{presentCount}</span></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal QR */}
      {qrOpen && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setQrOpen(false)} />
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">QR de check-in</h3>
              <button onClick={()=>setQrOpen(false)} className="p-2 rounded hover:bg-gray-100" aria-label="Fechar">✕</button>
            </div>

            {!selected ? (
              <div className="text-sm text-gray-600">Selecione uma atividade.</div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm">
                  Atividade: <b>{selected.title}</b> — {fmtRangeBR(startsISO(selected), endsISO(selected))}
                </div>

                <div className="rounded-xl border p-3 grid place-items-center bg-white">
                  {issuing ? <div className="text-sm text-gray-600">Gerando código…</div>
                    : qrImg ? <img src={qrImg} alt="QR code" className="w-full max-w-xs h-auto" />
                    : <div className="text-sm text-gray-600">Não foi possível gerar o QR.</div>}
                </div>

                <div className="rounded-lg border p-3 bg-gray-50">
                  <div className="text-xs text-gray-600 mb-1">Link do check-in</div>
                  <div className="flex items-center gap-2">
                    <input readOnly className="flex-1 border rounded px-2 py-1 bg-white text-xs" value={qrUrl} />
                    <button onClick={copyQrUrl} className="px-2 py-1 rounded border text-sm bg-white">Copiar</button>
                  </div>
                  {tokenInfo?.expires_at && (
                    <div className="mt-1 text-xs text-gray-500">Este QR expira em: {new Date(tokenInfo.expires_at).toLocaleString()}</div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <a href={qrImg || '#'} download={`checkin-${selected.id}.png`} className={`px-3 py-2 rounded border text-sm ${qrImg ? 'bg-white' : 'pointer-events-none opacity-50'}`}>
                    Baixar PNG
                  </a>
                  <button onClick={()=>window.open(qrUrl, '_blank')} className="px-3 py-2 rounded bg-black text-white text-sm">
                    Abrir link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* auxiliares visuais */
function KindBadge({k}:{k:ActivityKind}){
  const label = KIND_OPTS.find(o=>o.value===k)?.label ?? k
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-white">
      <span className="text-xs">{KIND_ICON[k]}</span>{label}
    </span>
  )
}
function TodayBadge(){
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 border border-green-300">Atividade de hoje</span>
}
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
