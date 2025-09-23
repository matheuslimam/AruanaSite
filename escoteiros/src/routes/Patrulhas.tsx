import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Patrol, PatrolCategory } from '../types'

type Row = { id: string; name: string; category: PatrolCategory; total_points: number }

const CATEGORIES: { label: string; value: PatrolCategory }[] = [
  { label: 'Lobinhos',   value: 'lobinhos' },
  { label: 'Escoteiros', value: 'escoteiros' },
  { label: 'Seniors',    value: 'seniors' },
]

function Badge({cat}:{cat: PatrolCategory}) {
  const label = CATEGORIES.find(c=>c.value===cat)?.label || cat
  return <span className="text-xs px-2 py-0.5 rounded-full border">{label}</span>
}

export default function Patrulhas(){
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  // criar
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState<PatrolCategory>('escoteiros')
  const [creating, setCreating] = useState(false)

  // editar
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingCat, setEditingCat] = useState<PatrolCategory>('escoteiros')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // dar pontos (opcional)
  const [awardId, setAwardId] = useState('')
  const [awardPoints, setAwardPoints] = useState<number>(0)
  const [awardReason, setAwardReason] = useState('Pontos bônus para patrulha')
  const [awarding, setAwarding] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('patrol_points_view')
      .select('*')
      .order('total_points', { ascending: false })
    if (error) { alert(error.message) }
    setRows((data as any) || [])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  async function createPatrol(){
    const name = newName.trim()
    if(!name) return
    setCreating(true)
    try{
      const { error } = await supabase.from('patrols').insert({ name, category: newCat })
      if (error) { alert(error.message); return }
      setNewName('')
      setNewCat('escoteiros')
      await load()
    } finally{
      setCreating(false)
    }
  }

  function startEdit(r: Row){
    setEditingId(r.id)
    setEditingName(r.name)
    setEditingCat(r.category)
  }

  async function saveEdit(){
    if (!editingId) return
    const name = editingName.trim()
    if (!name) return
    setSaving(true)
    try{
      const { error } = await supabase
        .from('patrols')
        .update({ name, category: editingCat })
        .eq('id', editingId)
      if (error) { alert(error.message); return }
      setEditingId(null)
      setEditingName('')
      setEditingCat('escoteiros')
      await load()
    } finally{
      setSaving(false)
    }
  }

  function cancelEdit(){
    setEditingId(null)
    setEditingName('')
    setEditingCat('escoteiros')
  }

  async function removePatrol(id: string){
    if (!confirm('Tem certeza que deseja excluir esta patrulha?')) return
    setDeletingId(id)
    try{
      const { error } = await supabase.from('patrols').delete().eq('id', id)
      if (error) { alert(error.message); return }
      await load()
    } finally{
      setDeletingId(null)
    }
  }

  async function awardToPatrol(){
    if(!awardId || awardPoints === 0) return
    setAwarding(true)
    try{
      const { error } = await supabase.functions.invoke('award-points', {
        body: { items: [{ patrol_id: awardId, points: awardPoints, reason: awardReason }] }
      })
      if (error) { alert((error as any).message || String(error)); return }
      setAwardPoints(0)
      setAwardReason('Pontos bônus para patrulha')
      await load()
      alert('Pontos atribuídos com sucesso!')
    } finally{
      setAwarding(false)
    }
  }

  // ====== agrupamento por seção ======
  const grouped = useMemo(() => {
    const map: Record<PatrolCategory, Row[]> = { lobinhos: [], escoteiros: [], seniors: [] }
    for (const r of rows) map[r.category].push(r)
    // opcional: ordenar por pontos dentro da seção
    for (const k of Object.keys(map) as PatrolCategory[]) {
      map[k].sort((a,b)=> b.total_points - a.total_points || a.name.localeCompare(b.name))
    }
    return map
  }, [rows])

  // util spinner
  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Patrulhas</h1>
        <button onClick={load} className="px-3 py-2 rounded border">Recarregar</button>
      </div>

      {/* Criar nova */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-sm">Nome da patrulha</label>
          <input
            className="w-full border rounded p-2"
            placeholder="Ex.: Lobo"
            value={newName}
            onChange={e=>setNewName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm">Seção: </label>
          <select
            className="border rounded p-2"
            value={newCat}
            onChange={e=>setNewCat(e.target.value as PatrolCategory)}
          >
            {CATEGORIES.map(c=> <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <button
          onClick={createPatrol}
          disabled={creating}
          className={`px-3 py-2 rounded text-white ${creating ? 'bg-gray-600' : 'bg-black'}`}
        >
          {creating ? <span className="inline-flex items-center gap-2"><Spinner/> Adicionando...</span> : 'Adicionar'}
        </button>
      </div>

      {/* Boxes por SEÇÃO, cada uma com grid com N colunas = nº de patrulhas naquela seção */}
      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2"><Spinner/> Carregando...</div>
      ) : (
        CATEGORIES.map(cat => {
          const list = grouped[cat.value] || []
          return (
            <div key={cat.value} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{cat.label}</h2>
                <span className="text-xs text-gray-500">({list.length} patrulha{list.length===1?'':'s'})</span>
              </div>

              {/* Grid com colunas dinâmicas: repeat(N, 1fr) */}
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, list.length)}, minmax(0, 1fr))`
                }}
              >
                {list.length === 0 ? (
                  <div className="text-sm text-gray-500">Sem patrulhas nesta seção.</div>
                ) : list.map(r => (
                  <div key={r.id} className="border rounded-xl p-4 space-y-3">
                    {editingId === r.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            className="border rounded p-2 flex-1"
                            value={editingName}
                            onChange={e=>setEditingName(e.target.value)}
                          />
                          <select
                            className="border rounded p-2"
                            value={editingCat}
                            onChange={e=>setEditingCat(e.target.value as PatrolCategory)}
                          >
                            {CATEGORIES.map(c=> <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className={`px-3 py-2 rounded text-white ${saving ? 'bg-gray-600' : 'bg-black'}`}
                          >
                            {saving ? <span className="inline-flex items-center gap-2"><Spinner/> Salvando...</span> : 'Salvar'}
                          </button>
                          <button onClick={cancelEdit} disabled={saving} className="px-3 py-2 rounded border">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-lg font-semibold">{r.name}</div>
                          <Badge cat={r.category}/>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>startEdit(r)} className="px-2 py-1 rounded border text-sm">Editar</button>
                          <button
                            onClick={()=>removePatrol(r.id)}
                            disabled={deletingId === r.id}
                            className="px-2 py-1 rounded border text-sm"
                          >
                            {deletingId === r.id
                              ? <span className="inline-flex items-center gap-2"><Spinner/> Excluindo...</span>
                              : 'Excluir'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="text-3xl font-extrabold">{r.total_points}</div>
                    <div className="text-xs text-gray-500">Pontos totais</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* (Opcional) Dar pontos direto para patrulha */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-medium">Dar pontos para uma patrulha (opcional)</div>
        <div className="flex flex-wrap gap-2 items-end">
          <select className="border rounded p-2" value={awardId} onChange={e=>setAwardId(e.target.value)}>
            <option value="">— Patrulha —</option>
            {rows.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({CATEGORIES.find(c=>c.value===p.category)?.label})
              </option>
            ))}
          </select>
          <input
            type="number"
            className="w-28 border rounded p-2"
            placeholder="Pontos"
            value={Number.isNaN(awardPoints) ? 0 : awardPoints}
            onChange={e=>setAwardPoints(parseInt(e.target.value || '0', 10))}
          />
          <input
            className="flex-1 min-w-[240px] border rounded p-2"
            placeholder="Motivo"
            value={awardReason}
            onChange={e=>setAwardReason(e.target.value)}
          />
          <button
            onClick={awardToPatrol}
            disabled={awarding}
            className={`px-3 py-2 rounded text-white ${awarding ? 'bg-gray-600' : 'bg-black'}`}
          >
            {awarding ? <span className="inline-flex items-center gap-2"><Spinner/> Atribuindo...</span> : 'Atribuir'}
          </button>
        </div>
      </div>
    </div>
  )
}
