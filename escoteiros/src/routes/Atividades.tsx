import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Activity, ActivityKind, Member, Patrol, PatrolCategory } from '../types'
import { ChipGroup } from '../components/Chip'

type ExtraKey = string
type ExtraDef = { key: ExtraKey; label: string }

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

const slug = (s: string) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function escapeRegExp(s: string){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
const eq = (a:any,b:any)=> JSON.stringify(a)===JSON.stringify(b)

// data local YYYY-MM-DD (para comparação "hoje")
function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const isToday = (dateStr?: string|null) => (dateStr || '') === todayLocal()

export default function Atividades(){
  const [activities, setActivities] = useState<Activity[]>([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string>(()=> todayLocal())
  const [kind, setKind] = useState<ActivityKind>('interna')
  const [selected, setSelected] = useState<Activity|null>(null)

  const [members, setMembers] = useState<Member[]>([])
  const [patrols, setPatrols] = useState<Patrol[]>([])

  // filtros
  const [filterSection, setFilterSection] = useState<'all' | PatrolCategory>('all')
  const [filterKind, setFilterKind]       = useState<'all' | ActivityKind>('all')

  // presença e ponto base geral
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

  // UI states
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [newParamLabel, setNewParamLabel] = useState('')
  const [loadingHydrate, setLoadingHydrate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // edição meta
  const [isEditingMeta, setIsEditingMeta] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState<string>('')
  const [editKind, setEditKind] = useState<ActivityKind>('interna')

  // --- ordenação com "hoje" em primeiro e, depois, data desc
  const sortActivities = (arr: Activity[]) => {
    const t = todayLocal()
    return [...arr].sort((a,b) => {
      const aToday = (a.date || '') === t
      const bToday = (b.date || '') === t
      if (aToday && !bToday) return -1
      if (!aToday && bToday) return 1
      // ambos hoje ou nenhum hoje => ordena por data desc
      const cmp = (b.date||'').localeCompare(a.date||'')
      if (cmp !== 0) return cmp
      // desempate opcional pelo título
      return (a.title||'').localeCompare(b.title||'')
    })
  }

  function formatBR(dateStr?: string | null) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}


  useEffect(()=>{ (async()=>{
    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .order('date', { ascending: false })
    setActivities(sortActivities((acts as any) || []))

    const { data: mem } = await supabase
      .from('profiles')
      .select('id, display_name, patrol_id, is_youth')
      .eq('is_youth', true)
      .order('display_name')
    setMembers((mem as any) || [])

    const { data: pats } = await supabase.from('patrols').select('*').order('name')
    setPatrols((pats as any) || [])
  })() },[])

  // ===== CRUD atividade (meta) =====
  async function createActivity(){
    const { data: user } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('activities')
      .insert({ title, date, kind, created_by: user.user?.id })
      .select('*').single()
    if(error){ alert(error.message); return }
    setActivities(prev => sortActivities([data as any, ...prev]))
    setSelected(data as any)
    setTitle(''); setDate(todayLocal()); setKind('interna')
  }

  function startEditMeta(){
    if (!selected) return
    setEditTitle(selected.title)
    setEditDate(selected.date)
    setEditKind(selected.kind ?? 'interna')
    setIsEditingMeta(true)
  }
  function cancelEditMeta(){ setIsEditingMeta(false) }

  async function saveEditMeta(){
    if (!selected) return
    const newTitle = editTitle.trim()
    const newDate  = editDate
    const newKind  = editKind
    if (!newTitle || !newDate) { alert('Preencha título e data.'); return }

    const { data, error } = await supabase
      .from('activities')
      .update({ title: newTitle, date: newDate, kind: newKind })
      .eq('id', selected.id)
      .select('*').single()
    if (error){ alert(error.message); return }

    setActivities(prev => sortActivities(prev.map(a => a.id === selected.id ? (data as any) : a)))
    setSelected(data as any)
    setIsEditingMeta(false)
  }

  async function deleteActivity(a: Activity){
    if (!confirm(`Excluir a atividade "${a.title}"? Essa ação não pode ser desfeita.`)) return
    setDeletingId(a.id)
    try {
      await supabase.from('attendance').delete().eq('activity_id', a.id)
      await supabase.from('points').delete().eq('activity_id', a.id)
      const { error } = await supabase.from('activities').delete().eq('id', a.id)
      if (error) throw error
      setActivities(prev => prev.filter(x => x.id !== a.id))
      if (selected?.id === a.id) setSelected(null)
    } catch (e:any) {
      alert(e?.message || 'Erro ao excluir')
    } finally {
      setDeletingId(null)
    }
  }

  // ===== presença/pontos =====
  const patrolsMap = useMemo(()=> {
    const m = new Map<string, Patrol>()
    patrols.forEach(p=>m.set(p.id, p))
    return m
  }, [patrols])

  function patrolName(id: string | null){
    if(!id) return '—'
    return patrolsMap.get(id)?.name || '—'
  }
  function memberSection(m: Member): PatrolCategory | null {
    if (!m.patrol_id) return null
    return patrolsMap.get(m.patrol_id)?.category ?? null
  }

  const filteredMembers = useMemo(()=>{
    if (filterSection === 'all') return members
    return members.filter(m => memberSection(m) === filterSection)
  }, [members, filterSection, patrolsMap])

  const presentCount = useMemo(()=> Object.entries(present)
    .filter(([id, v]) => v && filteredMembers.some(m => m.id === id)).length
  , [present, filteredMembers])

  function toggleExtra(memberId: string, extraKey: ExtraKey, checked: boolean){
    setExtrasSelected(prev => ({
      ...prev,
      [memberId]: { ...(prev[memberId] || {}), [extraKey]: checked }
    }))
  }

  // hidrata
  async function hydrateFromDb(activity: Activity){
    setLoadingHydrate(true)
    try{
      setPresent({}); setExtrasSelected({}); setBonusByPatrol({})
      setBasePoints(1)
      setSnapPresent({}); setSnapExtrasSelected({}); setSnapBonusByPatrol({})
      setSnapBasePoints(1); setSnapExtraDefs([])

      const { data: att } = await supabase
        .from('attendance').select('member_id').eq('activity_id', activity.id)
      const presMap: Record<string, boolean> = {}
      att?.forEach(a => { presMap[a.member_id as string] = true })
      setPresent(presMap); setSnapPresent(presMap)

      const { data: pts } = await supabase
        .from('points')
        .select('member_id, patrol_id, points, reason')
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
        used.add(key)
        merged.push({ key, label })
      }
      for (const lbl of labelsFound) pushDef(lbl)
      for (const d of ['Uniforme','Comportamento']) pushDef(d)

      setExtraDefs(merged)
      setSnapExtraDefs(structuredClone(merged))
      setExtrasSelected(selectedMap)
      setSnapExtrasSelected(structuredClone(selectedMap))

      const bonusMap: Record<string, number> = {}
      for (const p of pts){
        const pid = (p as any).patrol_id as string | null
        if (pid && p.reason === bonusReason){
          bonusMap[pid] = (bonusMap[pid] ?? 0) + Number(p.points || 0)
        }
      }
      setBonusByPatrol(bonusMap)
      setSnapBonusByPatrol(structuredClone(bonusMap))
    } finally {
      setLoadingHydrate(false)
    }
  }

  useEffect(()=>{
    if (selected) {
      setEditTitle(selected.title)
      setEditDate(selected.date)
      setEditKind(selected.kind ?? 'interna')
      setIsEditingMeta(false)
      void hydrateFromDb(selected)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  async function salvarChamadaEPontos(){
    if(!selected) return
    setSaving(true)
    try{
      await persistDiff({ diffOnly: false })
      alert('Chamada e pontos salvos!')
    } finally { setSaving(false) }
  }

  async function atualizarSomenteMudancas(){
    if(!selected) return
    setUpdating(true)
    try{
      const changed = await persistDiff({ diffOnly: true })
      alert(changed ? 'Atualizado com sucesso!' : 'Nada para atualizar.')
    } finally { setUpdating(false) }
  }

  async function persistDiff({ diffOnly }: { diffOnly: boolean }): Promise<boolean>{
    if (!selected) return false
    let changed = false

    if (!diffOnly || !eq(present, snapPresent)) {
      await supabase.from('attendance').delete().eq('activity_id', selected.id)
      const rows = Object.entries(present)
        .filter(([,v])=>v)
        .map(([member_id])=>({ activity_id: selected.id, member_id }))
      if (rows.length){
        const { error } = await supabase
          .from('attendance')
          .upsert(rows, { onConflict: 'activity_id,member_id', ignoreDuplicates: true })
        if (error) throw new Error('[attendance.upsert] ' + error.message)
      }
      changed = true
    }

    const items: any[] = []
    const presenceReason = `Presença em ${selected.title}`
    const presenceNeedsRewrite =
      !diffOnly || basePoints !== snapBasePoints || !eq(present, snapPresent)

    if (basePoints > 0 && Object.values(present).some(Boolean) && presenceNeedsRewrite){
      await supabase.from('points').delete().eq('activity_id', selected.id).eq('reason', presenceReason)
      for (const [member_id, v] of Object.entries(present)){
        if (v) items.push({ member_id, activity_id: selected.id, points: basePoints, reason: presenceReason })
      }
      changed = true
    }

    const extrasChanged =
      !eq(extraDefs, snapExtraDefs) || !eq(extrasSelected, snapExtrasSelected) || basePoints !== snapBasePoints

    if (!diffOnly || extrasChanged){
      for (const def of extraDefs){
        const reason = `${def.label} em ${selected.title}`
        await supabase.from('points').delete()
          .eq('activity_id', selected.id)
          .eq('reason', reason)
      }
      for (const m of members){
        const sel = extrasSelected[m.id] || {}
        for (const def of extraDefs){
          if (sel[def.key]) {
            items.push({ member_id: m.id, activity_id: selected.id, points: basePoints, reason: `${def.label} em ${selected.title}` })
          }
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
        await supabase.from('points').delete()
          .eq('activity_id', selected.id)
          .eq('reason', reason)
          .eq('patrol_id', pid)
        if (nowVal > 0){
          items.push({ patrol_id: pid, activity_id: selected.id, points: nowVal, reason })
        }
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

  // agrupamento para bônus por seção
  const patrolsByCat = useMemo(()=>{
    const g: Record<PatrolCategory, Patrol[]> = { lobinhos: [], escoteiros: [], seniors: [] }
    for (const p of patrols) g[p.category].push(p)
    for (const k of Object.keys(g) as PatrolCategory[]) {
      g[k].sort((a,b)=> a.name.localeCompare(b.name))
    }
    return g
  }, [patrols])

  function addParam(){
    const label = newParamLabel.trim()
    if (!label) return
    const key = slug(label) || `extra-${Date.now()}`
    if (extraDefs.some(d=>d.key===key)){ alert('Esse parâmetro já existe.'); return }
    setExtraDefs(prev => [...prev, { key, label }])
    setNewParamLabel('')
  }

  function KindBadge({k}:{k:ActivityKind}){
    const label = KIND_OPTS.find(o=>o.value===k)?.label ?? k
    return <span className="text-[11px] px-2 py-0.5 rounded-full border">{label}</span>
  }
  function TodayBadge(){
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 border border-green-300">Atividade de hoje</span>
  }

  // aplica filtro por tipo na lista
  const visibleActivities = useMemo(()=>{
    if (filterKind === 'all') return activities
    return activities.filter(a => (a.kind ?? 'interna') === filterKind)
  }, [activities, filterKind])

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Coluna esquerda: lista + criar + filtros de tipo */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Atividades</h1>

        <div className="flex flex-wrap gap-2">
          <input className="border rounded p-2 flex-1" placeholder="Título da atividade" value={title} onChange={e=>setTitle(e.target.value)} />
          <input type="date" className="border rounded p-2" value={date} onChange={e=>setDate(e.target.value)} />
          <select className="border rounded p-2" value={kind} onChange={e=>setKind(e.target.value as ActivityKind)}>
            {KIND_OPTS.map(k=> <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <button onClick={createActivity} className="px-3 py-2 rounded bg-black text-white">Criar</button>
        </div>

        {/* Filtro por TIPO */}
        <div className="mt-3">
          <div className="text-sm mb-1">Filtrar por tipo:</div>
          <ChipGroup
            options={KIND_FILTER_OPTS as any}
            value={filterKind as any}
            onChange={(v)=>setFilterKind(v as any)}
            theme="light"
          />
        </div>

        <ul className="mt-4 border rounded divide-y">
          {visibleActivities.map(a=> (
            <li
              key={a.id}
              className={`p-3 cursor-pointer ${selected?.id===a.id?'bg-gray-50':''}`}
              onClick={()=> setSelected(a)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-medium flex items-center flex-wrap gap-2">
                    {a.title}
                    <KindBadge k={a.kind ?? 'interna'} />
                    {isToday(a.date) && <TodayBadge />}
                  </div>
                  <div className="text-xs text-gray-500">{formatBR(a.date)}</div>
                </div>
                <button
                  onClick={(e)=>{ e.stopPropagation(); deleteActivity(a) }}
                  disabled={deletingId === a.id}
                  className={`px-2 py-1 rounded border text-sm ${deletingId===a.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                  title="Excluir atividade"
                >
                  {deletingId === a.id ? 'Excluindo…' : 'Excluir'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Coluna direita: edição meta + chamada/pontos */}
      <div>
        <h2 className="text-xl font-semibold mb-2">
          Chamada & Pontos {selected?`— ${selected.title}`:''}
          {selected && isToday(selected.date) && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 border border-green-300">Atividade de hoje</span>}
          {loadingHydrate && <span className="ml-2 text-xs text-gray-500">(carregando...)</span>}
        </h2>

        {!selected && <div className="text-sm text-gray-500">Crie ou selecione uma atividade para abrir a chamada.</div>}

        {selected && (
          <div className="space-y-5">
            {/* METADADOS */}
            <div className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Detalhes da atividade</div>
                {!isEditingMeta ? (
                  <button onClick={startEditMeta} className="px-2 py-1 rounded border text-sm">Editar</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={saveEditMeta} className="px-2 py-1 rounded bg-black text-white text-sm">Salvar</button>
                    <button onClick={cancelEditMeta} className="px-2 py-1 rounded border text-sm">Cancelar</button>
                  </div>
                )}
              </div>

              {!isEditingMeta ? (
                <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
                  <div><div className="text-gray-500">Título</div><div className="font-medium">{selected.title}</div></div>
                  <div><div className="text-gray-500">Data</div><div className="font-medium">{formatBR(selected.date)}</div></div>
                  <div><div className="text-gray-500">Tipo</div><div className="font-medium">{KIND_OPTS.find(o=>o.value===selected.kind)?.label ?? '—'}</div></div>
                </div>
              ) : (
                <div className="mt-3 grid sm:grid-cols-3 gap-3">
                  <input className="border rounded p-2" value={editTitle} onChange={e=>setEditTitle(e.target.value)} placeholder="Título" />
                  <input type="date" className="border rounded p-2" value={editDate} onChange={e=>setEditDate(e.target.value)} />
                  <select className="border rounded p-2" value={editKind} onChange={e=>setEditKind(e.target.value as ActivityKind)}>
                    {KIND_OPTS.map(k=> <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* filtros e PONTO BASE GERAL */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm">Filtrar membros por seção:</div>
                <ChipGroup
                  options={SECTION_OPTS as any}
                  value={filterSection as any}
                  onChange={(v)=>setFilterSection(v as any)}
                  theme="light"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Pontos base geral</span>
                <input
                  type="number"
                  className="w-20 border rounded p-1"
                  value={basePoints}
                  onChange={e=>setBasePoints(parseInt(e.target.value||'0'))}
                />
              </div>
            </div>

            {/* chamada + extras */}
            <div className="border rounded max-h-[460px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b">
                  <tr className="text-left">
                    <th className="p-2">Pres.</th>
                    <th>Nome</th>
                    <th>Patrulha</th>
                    {extraDefs.map(d=>(
                      <th key={d.key} className="text-center">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(m=>{
                    const checked = !!present[m.id]
                    const rowSel = extrasSelected[m.id] || {}
                    return (
                      <tr key={m.id} className="border-b">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e=>setPresent(prev=>({...prev, [m.id]: e.target.checked}))}
                          />
                        </td>
                        <td>{m.display_name}</td>
                        <td>{patrolName(m.patrol_id)}</td>
                        {extraDefs.map(d=>(
                          <td key={d.key} className="text-center">
                            <input
                              type="checkbox"
                              checked={!!rowSel[d.key]}
                              onChange={e=>toggleExtra(m.id, d.key, e.target.checked)}
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* adicionar novo parâmetro */}
            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">Adicionar parâmetro de pontuação (extra)</div>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  className="border rounded p-2 flex-1 min-w-[200px]"
                  placeholder="Ex.: Pontualidade"
                  value={newParamLabel}
                  onChange={e=>setNewParamLabel(e.target.value)}
                />
                <button onClick={addParam} className="px-3 py-2 rounded bg-black text-white">Adicionar</button>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                * Cada extra marcado vale os “Pontos base geral”.
              </div>
            </div>

            {/* bônus por patrulha — agrupado por seção */}
            <div className="border rounded p-3 space-y-3">
              <div className="font-medium">Bônus por Patrulha</div>

              {(['lobinhos','escoteiros','seniors'] as PatrolCategory[]).map(cat => (
                <div key={cat} className="space-y-2">
                  <div className="text-sm font-semibold">
                    {{lobinhos:'Lobinhos',escoteiros:'Escoteiros',seniors:'Seniors'}[cat]}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {patrolsByCat[cat].length === 0 ? (
                      <div className="text-sm text-gray-500">Sem patrulhas nesta seção.</div>
                    ) : patrolsByCat[cat].map(p => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="min-w-[140px]">{p.name}</span>
                        <input
                          type="number"
                          className="w-24 border rounded p-2"
                          value={bonusByPatrol[p.id] ?? 0}
                          onChange={e=>setBonusByPatrol(prev=>({ ...prev, [p.id]: parseInt(e.target.value||'0') }))}
                          placeholder="Pontos"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={salvarChamadaEPontos}
                  disabled={saving}
                  className={`px-3 py-2 rounded text-white ${saving ? 'bg-gray-600' : 'bg-black'}`}
                >
                  {saving ? 'Salvando...' : 'Salvar (regravar tudo)'}
                </button>
                <button
                  onClick={atualizarSomenteMudancas}
                  disabled={updating}
                  className="px-3 py-2 rounded border"
                >
                  {updating ? 'Atualizando...' : 'Atualizar (somente mudanças)'}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
