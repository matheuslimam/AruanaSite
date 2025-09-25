import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { toPng } from 'html-to-image'
import type { PatrolCategory } from '../types'
import { useMyProfile } from '../guards'

type Row = {
  id: string
  name: string
  category: PatrolCategory
  total_points: number
  emoji?: string | null
}

const CATEGORIES: { label: string; value: PatrolCategory }[] = [
  { label: 'Lobinhos',   value: 'lobinhos' },
  { label: 'Escoteiros', value: 'escoteiros' },
  { label: 'Seniors',    value: 'seniors' },
]

// 🎨 tema por seção (classes estáticas p/ Tailwind)
const THEME = {
  lobinhos: {
    headerGrad: 'from-emerald-50 to-emerald-100',
    headerRing: 'ring-emerald-200',
    pill: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-200',
    iconBg: 'bg-emerald-100 ring-emerald-300',
    podiumGrad: 'from-emerald-200 to-emerald-50',
  },
  escoteiros: {
    headerGrad: 'from-sky-50 to-sky-100',
    headerRing: 'ring-sky-200',
    pill: 'bg-sky-100 text-sky-800 ring-sky-300',
    accentText: 'text-sky-700',
    accentBorder: 'border-sky-200',
    iconBg: 'bg-sky-100 ring-sky-300',
    podiumGrad: 'from-sky-200 to-sky-50',
  },
  seniors: {
    headerGrad: 'from-violet-50 to-violet-100',
    headerRing: 'ring-violet-200',
    pill: 'bg-violet-100 text-violet-800 ring-violet-300',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-200',
    iconBg: 'bg-violet-100 ring-violet-300',
    podiumGrad: 'from-violet-200 to-violet-50',
  },
} as const

function Badge({ cat }: { cat: PatrolCategory }) {
  const label = CATEGORIES.find(c => c.value === cat)?.label || cat
  const t = THEME[cat]
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${t.accentBorder}`}>{label}</span>
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )
}

function IconBubble({ name, cat, emoji, big = false }: { name: string; cat: PatrolCategory; emoji?: string | null; big?: boolean }) {
  const t = THEME[cat]
  const size = big ? 'h-16 w-16 text-4xl' : 'h-10 w-10 text-2xl'
  const content = (emoji && emoji.trim()) ? emoji : (name.trim()[0] || '?').toUpperCase()
  return (
    <div className={`grid place-items-center rounded-full ring ${t.iconBg} ${t.headerRing} ${size} font-bold`}>
      <span aria-hidden>{content}</span>
    </div>
  )
}

function Modal({ open, onClose, title, children }:{
  open: boolean; onClose: ()=>void; title: string; children: React.ReactNode
}) {
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

/* ====== componente do “degrau” do pódio ====== */
function PodiumStep({
 // rank,
  row,
  cat,
  height,
  label
}: {
  rank: 1 | 2 | 3
  row: Row | null
  cat: PatrolCategory
  height: number
  label: string
}) {
  const t = THEME[cat]
  if (!row) {
    return <div className="opacity-50 text-center text-sm text-slate-400">—</div>
  }
  return (
    <div className="flex flex-col items-center">
      <IconBubble name={row.name} cat={cat} emoji={row.emoji} big />
      <div className="mt-2 text-sm font-semibold text-slate-800 text-center">{row.name}</div>
      <div className="mt-0.5"><Badge cat={cat} /></div>

      <div
        className={`mt-3 w-full rounded-t-xl border ${t.accentBorder} bg-gradient-to-t ${t.podiumGrad} relative flex items-end justify-center`}
        style={{ height }}
      >
        <div className="absolute -top-3 text-xs px-2 py-0.5 rounded-full border bg-white shadow-sm">
          {label}
        </div>
        <div className="pb-3 text-2xl font-extrabold tabular-nums">{row.total_points}</div>
      </div>
    </div>
  )
}

export default function Patrulhas(){
  const { profile } = useMyProfile()
  const gid = profile?.group_id || null
  const groupName = profile?.group?.name || 'Meu Grupo'

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  // criar
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState<PatrolCategory>('escoteiros')
  const [newEmoji, setNewEmoji] = useState('')
  const [creating, setCreating] = useState(false)

  // editar (via modal)
  const [editingRow, setEditingRow] = useState<Row | null>(null)
  const [editName, setEditName] = useState('')
  const [editCat, setEditCat] = useState<PatrolCategory>('escoteiros')
  const [editEmoji, setEditEmoji] = useState('')
  const [deltaPoints, setDeltaPoints] = useState<number>(0)
  const [deltaReason, setDeltaReason] = useState('Ajuste manual de pontuação')
  const [savingEdit, setSavingEdit] = useState(false)

  // excluir
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // dar pontos
  const [awardId, setAwardId] = useState('')
  const [awardPoints, setAwardPoints] = useState<number>(0)
  const [awardReason, setAwardReason] = useState('Pontos bônus para patrulha')
  const [awarding, setAwarding] = useState(false)

  // refs por seção (placar e pódio)
  const boardRefs = useRef<Record<PatrolCategory, HTMLDivElement | null>>({
    lobinhos: null, escoteiros: null, seniors: null
  })
  const podiumRefs = useRef<Record<PatrolCategory, HTMLDivElement | null>>({
    lobinhos: null, escoteiros: null, seniors: null
  })

  async function load(groupId: string) {
    setLoading(true)
    // pontos + metadados (emoji)
    const [vr, pr] = await Promise.all([
      supabase.from('patrol_points_view')
        .select('id,name,category,total_points')
        .eq('group_id', groupId)
        .order('total_points', { ascending: false }),
      supabase.from('patrols')
        .select('id,emoji')
        .eq('group_id', groupId),
    ])

    if (vr.error) alert(vr.error.message)
    const stats = (vr.data as any[] | null) ?? []
    const metaMap = new Map<string, string | null>((pr.data as any[] | null)?.map((m: any)=>[m.id, m.emoji]) || [])
    const merged: Row[] = stats.map(s => ({ ...s, emoji: metaMap.get(s.id) ?? null }))
    setRows(merged)
    setLoading(false)
  }

  useEffect(()=>{
    if (!gid) return
    setRows([])
    void load(gid)
  }, [gid])

  async function createPatrol(){
    const name = newName.trim()
    if(!name) return
    setCreating(true)
    try{
      const payload: any = { name, category: newCat }
      if (newEmoji.trim()) payload.emoji = newEmoji.trim()
      const { error } = await supabase.from('patrols').insert(payload)
      if (error) { alert(error.message); return }
      setNewName(''); setNewCat('escoteiros'); setNewEmoji('')
      if (gid) await load(gid)
    } finally{
      setCreating(false)
    }
  }

  function openEdit(r: Row){
    setEditingRow(r)
    setEditName(r.name)
    setEditCat(r.category)
    setEditEmoji(r.emoji || '')
    setDeltaPoints(0)
    setDeltaReason('Ajuste manual de pontuação')
  }

  async function saveEditModal(){
    if (!editingRow) return
    const name = editName.trim()
    if (!name) return
    setSavingEdit(true)
    try{
      const payload: any = { name, category: editCat, emoji: editEmoji.trim() || null }
      const { error } = await supabase.from('patrols').update(payload).eq('id', editingRow.id)
      if (error) { alert(error.message); return }

      if (deltaPoints !== 0) {
        const { error: e2 } = await supabase.functions.invoke('award-points', {
          body: { items: [{ patrol_id: editingRow.id, points: deltaPoints, reason: deltaReason || 'Ajuste manual' }] }
        })
        if (e2) { alert((e2 as any).message || String(e2)); return }
      }

      setEditingRow(null)
      if (gid) await load(gid)
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
      if (gid) await load(gid)
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
      setAwardPoints(0); setAwardReason('Pontos bônus para patrulha')
      if (gid) await load(gid)
      alert('Pontos atribuídos com sucesso!')
    } finally{
      setAwarding(false)
    }
  }

  const grouped = useMemo(() => {
    const map: Record<PatrolCategory, Row[]> = { lobinhos: [], escoteiros: [], seniors: [] }
    for (const r of rows) map[r.category].push(r)
    for (const k of Object.keys(map) as PatrolCategory[]) {
      map[k].sort((a,b)=> b.total_points - a.total_points || a.name.localeCompare(b.name))
    }
    return map
  }, [rows])

  function prettyDate() {
    return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  async function exportSection(cat: PatrolCategory){
    const node = boardRefs.current[cat]
    if (!node) return alert('Nada para exportar.')
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 3,
        // Oculta QUALQUER nó marcado com data-noexport="true"
        filter: (el: any) => !(el?.dataset?.noexport === 'true'),
      })
      const link = document.createElement('a')
      link.download = `placar-${cat}.png`
      link.href = dataUrl
      link.click()
    } catch (e: any) {
      alert('Falha ao gerar PNG: ' + (e?.message || String(e)))
    }
  }

  // 👇 técnica robusta: clona o pódio, exibe “atrás” da UI, exporta e remove
  async function exportPodium(cat: PatrolCategory){
    const src = podiumRefs.current[cat]
    if (!src) return alert('Nada para exportar.')

    const clone = src.cloneNode(true) as HTMLElement
    clone.classList.remove('hidden') // revela o clone
    Object.assign(clone.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      zIndex: '-1',
      pointerEvents: 'none',
      opacity: '1',
      width: '1100px',
      background: '#fff',
    } as CSSStyleDeclaration)

    document.body.appendChild(clone)

    // espera 2 frames p/ layout ficar estável
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

    try {
      const dataUrl = await toPng(clone, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 3,
      })
      const link = document.createElement('a')
      link.download = `podio-${cat}.png`
      link.href = dataUrl
      link.click()
    } catch (e:any) {
      alert('Falha ao gerar PNG do pódio: ' + (e?.message || String(e)))
    } finally {
      document.body.removeChild(clone)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Patrulhas</h1>
        <button onClick={()=>gid && load(gid)} className="px-3 py-2 rounded border">Recarregar</button>
      </div>

      {/* Criar nova */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-sm">Nome da patrulha</label>
          <input className="w-full border rounded p-2" placeholder="Ex.: Lobo"
            value={newName} onChange={e=>setNewName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Seção</label>
          <select className="border rounded p-2 w-full"
            value={newCat} onChange={e=>setNewCat(e.target.value as PatrolCategory)}>
            {CATEGORIES.map(c=> <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm">Emoji (opcional)</label>
          <input
            className="border rounded p-2 w-28 text-center"
            placeholder="🐺"
            value={newEmoji}
            onChange={e=>setNewEmoji(e.target.value)}
          />
        </div>
        <button onClick={createPatrol} disabled={creating}
          className={`px-3 py-2 rounded text-white ${creating ? 'bg-gray-600' : 'bg-black'}`}>
          {creating ? <span className="inline-flex items-center gap-2"><Spinner/> Adicionando...</span> : 'Adicionar'}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2"><Spinner/> Carregando...</div>
      ) : (
        CATEGORIES.map(catObj => {
          const cat = catObj.value
          const list = grouped[cat] || []
          const t = THEME[cat]
          const top3 = list.slice(0, 3)

          return (
            <section key={cat} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{catObj.label}</h2>
                  <span className="text-xs text-gray-500">({list.length} patrulha{list.length===1?'':'s'})</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>exportSection(cat)} className="px-3 py-1.5 rounded border text-sm">
                    Exportar placar (PNG)
                  </button>
                  <button onClick={()=>exportPodium(cat)} className="px-3 py-1.5 rounded border text-sm">
                    Exportar pódio (PNG)
                  </button>
                </div>
              </div>

              {/* 🎯 Container do PLACAR (vai para o PNG) */}
              <div
                ref={el => { boardRefs.current[cat] = el }}
                className={`rounded-2xl border ring ${t.headerRing} bg-white overflow-hidden`}
              >
                {/* cabeçalho do PNG */}
                <div className={`px-5 py-4 bg-gradient-to-r ${t.headerGrad} border-b ${t.accentBorder}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className={`text-xs ${t.accentText} font-semibold tracking-wide uppercase`}>Placar por Patrulha</div>
                      <div className="text-lg font-bold leading-tight">{catObj.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-600">{groupName}</div>
                      <div className="text-xs text-slate-500">{prettyDate()}</div>
                    </div>
                  </div>
                </div>

                {/* grade de cards */}
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.length === 0 ? (
                      <div className="text-sm text-gray-500">Sem patrulhas nesta seção.</div>
                    ) : list.map((r, idx) => (
                      <div key={r.id} className={`rounded-xl border p-4 flex flex-col justify-between bg-white`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <IconBubble name={r.name} cat={cat} emoji={r.emoji} big />
                            <div className="space-y-0.5">
                              <div className="text-xs text-gray-500">#{idx+1}</div>
                              <div className="text-lg font-semibold leading-tight">{r.name}</div>
                              <Badge cat={cat}/>
                            </div>
                          </div>
                          <div className="text-3xl font-extrabold tabular-nums">{r.total_points}</div>
                        </div>

                        {/* 🔧 Ações (não entram no PNG) */}
                        <div className="mt-3 flex gap-2" data-noexport="true">
                          <button onClick={()=>openEdit(r)} className="px-2 py-1 rounded border text-sm">Editar</button>
                          <button onClick={()=>removePatrol(r.id)} disabled={deletingId === r.id}
                            className="px-2 py-1 rounded border text-sm">
                            {deletingId === r.id ? <span className="inline-flex items-center gap-2"><Spinner/> Excluindo…</span> : 'Excluir'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* watermark */}
                  <div className="mt-4 text-[10px] text-right text-slate-500">
                    Gerado no SAPS — {prettyDate()}
                  </div>
                </div>
              </div>

              {/* 🏆 PÓDIO — base escondida (usamos um CLONE visível na exportação) */}
              <div
                ref={el => { podiumRefs.current[cat] = el }}
                className="hidden w-[1100px] bg-white rounded-2xl border overflow-hidden"
              >
                {/* header do pódio */}
                <div className={`px-6 py-5 bg-gradient-to-r ${t.headerGrad} border-b ${t.accentBorder}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-xs ${t.accentText} font-semibold tracking-wide uppercase`}>Pódio — {catObj.label}</div>
                      <div className="text-xl font-extrabold leading-tight">Top 3 Patrulhas</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-600">{groupName}</div>
                      <div className="text-xs text-slate-500">{prettyDate()}</div>
                    </div>
                  </div>
                </div>

                <div className="p-8">
                  {top3.length === 0 ? (
                    <div className="text-sm text-gray-500">Sem patrulhas nesta seção.</div>
                  ) : (
                    <div className="grid grid-cols-3 items-end gap-6">
                      <PodiumStep rank={2} row={top3[1] || null} cat={cat} height={180} label="2º" />
                      <PodiumStep rank={1} row={top3[0] || null} cat={cat} height={220} label="CAMPEÃ" />
                      <PodiumStep rank={3} row={top3[2] || null} cat={cat} height={150} label="3º" />
                    </div>
                  )}

                  <div className="mt-6 text-[10px] text-right text-slate-500">
                    Gerado no SAPS — {prettyDate()}
                  </div>
                </div>
              </div>
            </section>
          )
        })
      )}

      {/* Dar pontos direto */}
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

      {/* Modal de edição */}
      <Modal open={!!editingRow} onClose={()=>setEditingRow(null)} title="Editar patrulha">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm">Nome</label>
              <input className="w-full border rounded p-2" value={editName} onChange={e=>setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Emoji (opcional)</label>
              <input
                className="w-full border rounded p-2 text-center"
                placeholder="🐺"
                value={editEmoji}
                onChange={e=>setEditEmoji(e.target.value)}
                maxLength={4}
              />
            </div>
            <div>
              <label className="text-sm">Seção</label>
              <select className="w-full border rounded p-2" value={editCat} onChange={e=>setEditCat(e.target.value as PatrolCategory)}>
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
            <div className="text-xs text-gray-500">Dica: use valores negativos para remover pontos (ex.: -5).</div>
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
