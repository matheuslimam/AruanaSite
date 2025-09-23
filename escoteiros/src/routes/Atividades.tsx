import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Activity, Member, Patrol, PatrolCategory } from '../types'
import { ChipGroup } from '../components/Chip' // ← usamos os chips

type ExtraKeys = 'uniforme' | 'comportamento'
const DEFAULT_EXTRAS: Record<ExtraKeys, number> = { uniforme: 0, comportamento: 0 }

const SECTION_OPTS: { label: string; value: 'all' | PatrolCategory }[] = [
  { label: 'Todos',      value: 'all' },
  { label: 'Lobinhos',   value: 'lobinhos' },
  { label: 'Escoteiros', value: 'escoteiros' },
  { label: 'Seniors',    value: 'seniors' },
]

export default function Atividades(){
  const [activities, setActivities] = useState<Activity[]>([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string>(()=> new Date().toISOString().slice(0,10))
  const [selected, setSelected] = useState<Activity|null>(null)

  const [members, setMembers] = useState<Member[]>([])
  const [patrols, setPatrols] = useState<Patrol[]>([])

  // filtro de presença por seção
  const [filterSection, setFilterSection] = useState<'all' | PatrolCategory>('all')

  // estado atual (UI)
  const [present, setPresent] = useState<Record<string, boolean>>({})
  const [basePoints, setBasePoints] = useState<number>(10)
  const [extraByMember, setExtraByMember] = useState<Record<string, Record<ExtraKeys, number>>>({})
  const [bonusByPatrol, setBonusByPatrol] = useState<Record<string, number>>({})

  // snapshot (para “Atualizar” não duplicar)
  const [snapPresent, setSnapPresent] = useState<Record<string, boolean>>({})
  const [snapBasePoints, setSnapBasePoints] = useState<number>(10)
  const [snapExtraByMember, setSnapExtraByMember] =
    useState<Record<string, Record<ExtraKeys, number>>>({})
  const [snapBonusByPatrol, setSnapBonusByPatrol] = useState<Record<string, number>>({})

  const [saving, setSaving]   = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(()=>{ (async()=>{
    const { data: acts } = await supabase.from('activities').select('*').order('date', { ascending: false })
    setActivities((acts as any) || [])

    const { data: mem } = await supabase
      .from('profiles')
      .select('id, display_name, patrol_id, is_youth')
      .eq('is_youth', true)
      .order('display_name')
    setMembers((mem as any) || [])

    const { data: pats } = await supabase.from('patrols').select('*').order('name')
    setPatrols((pats as any) || [])
  })() },[])

  async function createActivity(){
    const { data: user } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('activities')
      .insert({ title, date, created_by: user.user?.id })
      .select('*').single()
    if(error){ alert(error.message); return }
    setActivities(prev=>[data as any, ...prev])
    setSelected(data as any)
  }

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

  // membros filtrados por seção
  const filteredMembers = useMemo(()=>{
    if (filterSection === 'all') return members
    return members.filter(m => memberSection(m) === filterSection)
  }, [members, filterSection, patrolsMap])

  const presentCount = useMemo(()=> Object.entries(present)
    .filter(([id, v]) => v && filteredMembers.some(m => m.id === id)).length
  , [present, filteredMembers])

  function setExtra(memberId: string, key: ExtraKeys, value: number){
    setExtraByMember(prev => {
      const prevExtras = prev[memberId] ?? { ...DEFAULT_EXTRAS }
      return { ...prev, [memberId]: { ...prevExtras, [key]: value } }
    })
  }

  const shallowEqual = (a: Record<string, any>, b: Record<string, any>) => {
    const ka = Object.keys(a), kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    for (const k of ka) if (a[k] !== b[k]) return false
    return true
  }

  // hidrata da base
  async function hydrateFromDb(activity: Activity){
    setPresent({}); setExtraByMember({}); setBonusByPatrol({}); setBasePoints(10)
    setSnapPresent({}); setSnapExtraByMember({}); setSnapBonusByPatrol({}); setSnapBasePoints(10)

    const { data: att } = await supabase
      .from('attendance').select('member_id').eq('activity_id', activity.id)
    const presMap: Record<string, boolean> = {}
    att?.forEach(a => { presMap[a.member_id as string] = true })
    setPresent(presMap); setSnapPresent(presMap)

    const { data: pts } = await supabase
      .from('points')
      .select('member_id, patrol_id, points, reason')
      .eq('activity_id', activity.id)

    if (!pts || pts.length === 0) return

    const baseReason = `Presença em ${activity.title}`
    const extraDefs: { key: ExtraKeys; label: string }[] = [
      { key: 'uniforme',      label: 'Uniforme' },
      { key: 'comportamento', label: 'Comportamento' },
    ]
    const bonusReason = `Bônus patrulha em ${activity.title}`

    const anyBase = pts.find(p => p.reason === baseReason && (p as any).member_id)
    const baseVal = anyBase?.points ? Number(anyBase.points) : 10
    setBasePoints(baseVal); setSnapBasePoints(baseVal)

    const extraMap: Record<string, Record<ExtraKeys, number>> = {}
    for (const p of pts){
      const memberId = (p as any).member_id as string | null
      const patrolId = (p as any).patrol_id as string | null
      const reason = (p as any).reason as string
      const value  = Number(p.points || 0)

      if (memberId){
        for (const def of extraDefs){
          if (reason === `${def.label} em ${activity.title}`) {
            const prev = extraMap[memberId] ?? { ...DEFAULT_EXTRAS }
            prev[def.key] = value
            extraMap[memberId] = prev
          }
        }
      }
      if (patrolId && reason === bonusReason){
        // somado abaixo
      }
    }
    setExtraByMember(extraMap); setSnapExtraByMember(structuredClone(extraMap))

    const bonusMap: Record<string, number> = {}
    for (const p of pts){
      const patrolId = (p as any).patrol_id as string | null
      if (patrolId && p.reason === bonusReason){
        bonusMap[patrolId] = (bonusMap[patrolId] ?? 0) + Number(p.points || 0)
      }
    }
    setBonusByPatrol(bonusMap); setSnapBonusByPatrol(structuredClone(bonusMap))
  }

  useEffect(()=>{
    if (selected) void hydrateFromDb(selected)
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

    // Attendance
    const sameAttendance = shallowEqual(present, snapPresent)
    if (!diffOnly || !sameAttendance) {
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

    // Points
    const items: any[] = []
    const baseReason = `Presença em ${selected.title}`
    const baseNeedsRewrite =
      !diffOnly || basePoints !== snapBasePoints || !sameAttendance

    if (basePoints > 0 && Object.values(present).some(Boolean) && baseNeedsRewrite){
      await supabase.from('points').delete().eq('activity_id', selected.id).eq('reason', baseReason)
      for (const [member_id, v] of Object.entries(present)){
        if (v) items.push({ member_id, activity_id: selected.id, points: basePoints, reason: baseReason })
      }
      changed = true
    }

    const extraDefs: { key: ExtraKeys; label: string }[] = [
      { key: 'uniforme',      label: 'Uniforme' },
      { key: 'comportamento', label: 'Comportamento' },
    ]
    for (const m of members){
      const now = extraByMember[m.id] ?? { ...DEFAULT_EXTRAS }
      const snap = snapExtraByMember[m.id] ?? { ...DEFAULT_EXTRAS }
      for (const def of extraDefs){
        const nowVal  = Number(now[def.key]  || 0)
        const snapVal = Number(snap[def.key] || 0)
        if (!diffOnly || nowVal !== snapVal){
          const reason = `${def.label} em ${selected.title}`
          await supabase.from('points').delete()
            .eq('activity_id', selected.id)
            .eq('reason', reason)
            .eq('member_id', m.id)
          if (nowVal > 0){
            items.push({ member_id: m.id, activity_id: selected.id, points: nowVal, reason })
          }
          if (nowVal !== snapVal) changed = true
        }
      }
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
      setSnapExtraByMember(structuredClone(extraByMember))
      setSnapBonusByPatrol(structuredClone(bonusByPatrol))
    }
    return changed
  }

  // ======== agrupamentos para UI ========
  const patrolsByCat = useMemo(()=>{
    const g: Record<PatrolCategory, Patrol[]> = { lobinhos: [], escoteiros: [], seniors: [] }
    for (const p of patrols) g[p.category].push(p)
    // opcional: ordenar por nome
    for (const k of Object.keys(g) as PatrolCategory[]) {
      g[k].sort((a,b)=> a.name.localeCompare(b.name))
    }
    return g
  }, [patrols])

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Atividades</h1>
        <div className="flex gap-2">
          <input className="border rounded p-2 flex-1" placeholder="Título da atividade" value={title} onChange={e=>setTitle(e.target.value)} />
          <input type="date" className="border rounded p-2" value={date} onChange={e=>setDate(e.target.value)} />
          <button onClick={createActivity} className="px-3 py-2 rounded bg-black text-white">Criar</button>
        </div>
        <ul className="mt-4 border rounded divide-y">
          {activities.map(a=> (
            <li
              key={a.id}
              className={`p-3 cursor-pointer ${selected?.id===a.id?'bg-gray-50':''}`}
              onClick={()=> setSelected(a)}
            >
              <div className="font-medium">{a.title}</div>
              <div className="text-xs text-gray-500">{a.date}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Chamada & Pontos {selected?`— ${selected.title}`:''}</h2>
        {!selected && <div className="text-sm text-gray-500">Crie ou selecione uma atividade para abrir a chamada.</div>}
        {selected && (
          <div className="space-y-4">

            {/* filtro por seção (presença) */}
            <div className="space-y-2">
              <div className="text-sm">Filtrar membros por seção:</div>
              <ChipGroup
                options={SECTION_OPTS as any}
                value={filterSection as any}
                onChange={(v)=>setFilterSection(v as any)}
                theme="light"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                Presentes nesta visão: <b>{presentCount}</b>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Pontos base presença</span>
                <input
                  type="number"
                  className="w-20 border rounded p-1"
                  value={basePoints}
                  onChange={e=>setBasePoints(parseInt(e.target.value||'0'))}
                />
              </div>
            </div>

            <div className="border rounded max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b">
                  <tr className="text-left">
                    <th className="p-2">Presente</th>
                    <th>Nome</th>
                    <th>Patrulha</th>
                    <th className="text-center">Uniforme</th>
                    <th className="text-center">Comport.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(m=>{
                    const checked = !!present[m.id]
                    const extras = extraByMember[m.id] ?? { ...DEFAULT_EXTRAS }
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
                        <td className="text-center">
                          <input
                            type="number"
                            className="w-20 border rounded p-1 text-center"
                            value={extras.uniforme ?? 0}
                            onChange={e=>setExtra(m.id, 'uniforme', parseInt(e.target.value||'0'))}
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="number"
                            className="w-20 border rounded p-1 text-center"
                            value={extras.comportamento ?? 0}
                            onChange={e=>setExtra(m.id, 'comportamento', parseInt(e.target.value||'0'))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* BÔNUS por patrulha — agrupado por seção */}
            <div className="border rounded p-3 space-y-3">
              <div className="font-medium">Bônus por Patrulha</div>

              {(['lobinhos','escoteiros','seniors'] as PatrolCategory[]).map(cat => (
                <div key={cat} className="space-y-2">
                  <div className="text-sm font-semibold">
                    {SECTION_OPTS.find(o=>o.value===cat)?.label}
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
