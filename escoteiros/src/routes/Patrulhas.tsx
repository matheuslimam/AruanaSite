import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { toPng } from 'html-to-image'
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

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )
}

/** Modal simples e acessível */
function Modal({
  open, onClose, title, children
}: { open: boolean; onClose: ()=>void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Patrulhas(){
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  // criar
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState<PatrolCategory>('escoteiros')
  const [creating, setCreating] = useState(false)

  // editar (via modal)
  const [editingRow, setEditingRow] = useState<Row | null>(null)
  const [editName, setEditName] = useState('')
  const [editCat, setEditCat] = useState<PatrolCategory>('escoteiros')
  const [deltaPoints, setDeltaPoints] = useState<number>(0)
  const [deltaReason, setDeltaReason] = useState('Ajuste manual de pontuação')
  const [savingEdit, setSavingEdit] = useState(false)

  // excluir
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // dar pontos (opcional, fora do modal)
  const [awardId, setAwardId] = useState('')
  const [awardPoints, setAwardPoints] = useState<number>(0)
  const [awardReason, setAwardReason] = useState('Pontos bônus para patrulha')
  const [awarding, setAwarding] = useState(false)

  // refs para exportar PNG por seção
  const boardRefs = useRef<Record<PatrolCategory, HTMLDivElement | null>>({
    lobinhos: null, escoteiros: null, seniors: null
  })

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

  function openEdit(r: Row){
    setEditingRow(r)
    setEditName(r.name)
    setEditCat(r.category)
    setDeltaPoints(0)
    setDeltaReason('Ajuste manual de pontuação')
  }

  async function saveEditModal(){
    if (!editingRow) return
    const name = editName.trim()
    if (!name) return
    setSavingEdit(true)
    try{
      // 1) atualizar dados básicos da patrulha
      const { error } = await supabase
        .from('patrols')
        .update({ name, category: editCat })
        .eq('id', editingRow.id)
      if (error) { alert(error.message); return }

      // 2) ajuste de pontos (se delta ≠ 0) — usa edge function award-points
      if (deltaPoints !== 0) {
        const { error: e2 } = await supabase.functions.invoke('award-points', {
          body: { items: [{ patrol_id: editingRow.id, points: deltaPoints, reason: deltaReason || 'Ajuste manual' }] }
        })
        if (e2) { alert((e2 as any).message || String(e2)); return }
      }

      setEditingRow(null)
      await load()
    } finally{
      setSavingEdit(false)
    }
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

  // ====== agrupamento por seção (para mobile e placar) ======
  const grouped = useMemo(() => {
    const map: Record<PatrolCategory, Row[]> = { lobinhos: [], escoteiros: [], seniors: [] }
    for (const r of rows) map[r.category].push(r)
    for (const k of Object.keys(map) as PatrolCategory[]) {
      map[k].sort((a,b)=> b.total_points - a.total_points || a.name.localeCompare(b.name))
    }
    return map
  }, [rows])

  // Exporta PNG do nó de uma seção
  async function exportSection(cat: PatrolCategory){
    const node = boardRefs.current[cat]
    if (!node) return alert('Nada para exportar.')
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2, // mais nítido
      })
      const link = document.createElement('a')
      link.download = `placar-${cat}.png`
      link.href = dataUrl
      link.click()
    } catch (e: any) {
      alert('Falha ao gerar PNG: ' + (e?.message || String(e)))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Patrulhas</h1>
        <button onClick={load} className="px-3 py-2 rounded border">Recarregar</button>
      </div>

      {/* Criar nova (mobile-first) */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
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
          <label className="text-sm">Seção</label>
          <select
            className="border rounded p-2 w-full"
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

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2"><Spinner/> Carregando...</div>
      ) : (
        CATEGORIES.map(cat => {
          const list = grouped[cat.value] || []
          return (
            <section key={cat.value} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{cat.label}</h2>
                  <span className="text-xs text-gray-500">({list.length} patrulha{list.length===1?'':'s'})</span>
                </div>
                <button
                  onClick={()=>exportSection(cat.value)}
                  className="px-3 py-1.5 rounded border text-sm"
                  title="Exportar PNG do placar desta seção"
                >
                  Exportar placar (PNG)
                </button>
              </div>

              {/* Container do placar (o que vira PNG) */}
              <div
                ref={el => { boardRefs.current[cat.value] = el }}
                className="bg-white rounded-xl border p-3 sm:p-4"
              >
                {/* grid mobile-first: 1 col → 2 → 3 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.length === 0 ? (
                    <div className="text-sm text-gray-500">Sem patrulhas nesta seção.</div>
                  ) : list.map((r, idx) => (
                    <div key={r.id} className="rounded-xl border p-4 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">#{idx+1}</div>
                          <div className="text-lg font-semibold leading-tight">{r.name}</div>
                          <Badge cat={r.category}/>
                        </div>
                        <div className="text-3xl font-extrabold tabular-nums">{r.total_points}</div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={()=>openEdit(r)} className="px-2 py-1 rounded border text-sm">Editar</button>
                        <button
                          onClick={()=>removePatrol(r.id)}
                          disabled={deletingId === r.id}
                          className="px-2 py-1 rounded border text-sm"
                        >
                          {deletingId === r.id
                            ? <span className="inline-flex items-center gap-2"><Spinner/> Excluindo…</span>
                            : 'Excluir'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })
      )}

      {/* (Opcional) Dar pontos direto para qualquer patrulha */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-medium">Dar pontos para uma patrulha (opcional)</div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
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
            className="w-full sm:w-28 border rounded p-2"
            placeholder="Pontos"
            value={Number.isNaN(awardPoints) ? 0 : awardPoints}
            onChange={e=>setAwardPoints(parseInt(e.target.value || '0', 10))}
          />
          <input
            className="flex-1 min-w-[200px] border rounded p-2"
            placeholder="Motivo"
            value={awardReason}
            onChange={e=>setAwardReason(e.target.value)}
          />
          <button
            onClick={awardToPatrol}
            disabled={awarding}
            className={`px-3 py-2 rounded text-white ${awarding ? 'bg-gray-600' : 'bg-black'}`}
          >
            {awarding ? <span className="inline-flex items-center gap-2"><Spinner/> Atribuindo…</span> : 'Atribuir'}
          </button>
        </div>
      </div>

      {/* MODAL de edição */}
      <Modal
        open={!!editingRow}
        onClose={()=>setEditingRow(null)}
        title="Editar patrulha"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Nome</label>
              <input
                className="w-full border rounded p-2"
                value={editName}
                onChange={e=>setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm">Seção</label>
              <select
                className="w-full border rounded p-2"
                value={editCat}
                onChange={e=>setEditCat(e.target.value as PatrolCategory)}
              >
                {CATEGORIES.map(c=> <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="border rounded p-3 space-y-2">
            <div className="font-medium">Ajuste de pontos (opcional)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="number"
                className="border rounded p-2"
                placeholder="+/- pontos"
                value={Number.isNaN(deltaPoints) ? 0 : deltaPoints}
                onChange={e=>setDeltaPoints(parseInt(e.target.value || '0', 10))}
              />
              <input
                className="sm:col-span-2 border rounded p-2"
                placeholder="Motivo"
                value={deltaReason}
                onChange={e=>setDeltaReason(e.target.value)}
              />
            </div>
            <div className="text-xs text-gray-500">
              Dica: use valores negativos para remover pontos (ex.: -5).
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={()=>setEditingRow(null)} className="px-3 py-2 rounded border">Cancelar</button>
            <button
              onClick={saveEditModal}
              disabled={savingEdit}
              className={`px-3 py-2 rounded text-white ${savingEdit ? 'bg-gray-600' : 'bg-black'}`}
            >
              {savingEdit ? <span className="inline-flex items-center gap-2"><Spinner/> Salvando…</span> : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
