import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Member, Patrol, MemberRole } from '../types'
import { Chip, ChipGroup } from '../components/Chip'


type Row = Member
type ViewMode = 'table' | 'general'

const ROLES: { label: string; value: MemberRole }[] = [
  { label: 'Lobinhos',   value: 'lobinhos'   },
  { label: 'Escoteiros', value: 'escoteiros' },
  { label: 'Seniors',    value: 'seniors'    },
  { label: 'Pioneiros',  value: 'pioneiros'  },
  { label: 'Chefe',      value: 'chefe'      },
]
const SECTION_ORDER: MemberRole[] = ['lobinhos','escoteiros','seniors','pioneiros']

export default function Membros(){
  const [members, setMembers] = useState<Row[]>([])
  const [patrols, setPatrols] = useState<Patrol[]>([])
  const [loading, setLoading] = useState(true)

  // criar novo
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPatrolId, setNewPatrolId] = useState<string>('')
  const [newRole, setNewRole] = useState<MemberRole>('escoteiros')
  const [sendInvite, setSendInvite] = useState(true)

  // edição inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPatrolId, setEditPatrolId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<MemberRole>('escoteiros')

  // presença
  const [attendanceCountByMember, setAttendanceCountByMember] = useState<Record<string, number>>({})
  const [totalActivities, setTotalActivities] = useState<number>(0)

  // loading flags p/ botões
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // filtros / visão
  const [filterRole, setFilterRole] = useState<MemberRole | 'all'>('all')
  const [view, setView] = useState<ViewMode>('table')

  async function load(){
    setLoading(true)
    const [
      { data: p },
      { data: m, error: e2 },
      actsResp,
      attResp,
    ] = await Promise.all([
      supabase.from('patrols').select('*').order('name'),
      supabase.from('profiles')
        .select('id, display_name, email, patrol_id, role, is_youth')
        .order('display_name'),
      supabase.from('activities').select('*', { count: 'exact', head: true }),
      supabase.from('attendance').select('member_id'),
    ])

    if (e2) alert(e2.message)

    setPatrols((p as Patrol[]) || [])
    setMembers((m as Row[]) || [])
    setTotalActivities(actsResp.count || 0)

    const map: Record<string, number> = {}
    ;(attResp.data as { member_id: string }[] | null)?.forEach(r => {
      map[r.member_id] = (map[r.member_id] ?? 0) + 1
    })
    setAttendanceCountByMember(map)

    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  function patrolName(id: string | null){
    if(!id) return '—'
    return patrols.find(p=>p.id===id)?.name || '—'
  }

  function roleLabel(r: MemberRole){
    return ROLES.find(x=>x.value===r)?.label || r
  }

  // presença (%) de um membro
  function presencePct(memberId: string){
    if (totalActivities <= 0) return 0
    const pres = attendanceCountByMember[memberId] || 0
    return Math.round((pres / totalActivities) * 100)
  }

  async function addMember(){
    const display_name = newName.trim()
    const email = newEmail.trim().toLowerCase()
    if(!display_name || !email) { alert('Informe nome e e-mail'); return }

    const payload = {
      display_name,
      email,
      patrol_id: newPatrolId || null,
      role: newRole,
      send_invite: sendInvite,
    }

    setAdding(true)
    try{
      const { data, error } = await supabase.functions.invoke('invite-member', { body: payload })
      if (error) {
        const res = (error as any).context?.response
        try {
          const text = res ? await res.text() : ''
          let msg = text
          try { msg = JSON.parse(text)?.error ?? text } catch {}
          alert(`Erro ${res?.status ?? ''}: ${msg || (error as any).message}`)
          console.error('EDGE ERROR', res?.status, msg)
        } catch {
          alert((error as any).message || 'Erro na Edge')
        }
        return
      }

      await load()
      setNewName('')
      setNewEmail('')
      setNewPatrolId('')
      setNewRole('escoteiros')
      setSendInvite(true)

      const link = (data as any)?.accessLink as string | null
      const temp = (data as any)?.tempPassword as string | null
      if (link && temp) alert(`Membro criado!\nSenha temporária: ${temp}\nLink de acesso: ${link}`)
      else if (link) alert(`Membro criado! Link de acesso: ${link}`)
      else if (temp) alert(`Membro criado! Senha temporária: ${temp}`)
      else alert('Membro criado/vinculado com sucesso.')
    } finally {
      setAdding(false)
    }
  }

  function startEdit(row: Row){
    setEditingId(row.id)
    setEditName(row.display_name)
    setEditEmail((row as any).email || '')
    setEditPatrolId(row.patrol_id)
    setEditRole(row.role)
  }

  async function saveEdit(){
    if(!editingId) return
    const display_name = editName.trim()
    const email = editEmail.trim().toLowerCase() || null
    if(!display_name){ alert('Nome é obrigatório'); return }

    setSaving(true)
    try{
      const { error } = await supabase
        .from('profiles')
        .update({ display_name, email, patrol_id: editPatrolId || null, role: editRole })
        .eq('id', editingId)
      if(error){ alert(error.message); return }

      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit(){
    setEditingId(null)
    setEditName('')
    setEditEmail('')
    setEditPatrolId(null)
    setEditRole('escoteiros')
  }

  async function removeMember(id: string){
    if(!confirm('Tem certeza que deseja excluir este membro?')) return
    setDeletingId(id)
    try{
      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if(error){ alert(error.message); return }
      setMembers(prev => prev.filter(m => m.id !== id))
      setAttendanceCountByMember(prev => {
        const n = { ...prev }
        delete n[id]
        return n
      })
    } finally {
      setDeletingId(null)
    }
  }

  // spinner
  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )

  // membros filtrados (para Tabela)
  const filteredMembers = useMemo(()=>{
    return members.filter(m => filterRole === 'all' ? true : m.role === filterRole)
  }, [members, filterRole])

  // estrutura para visão geral: seção -> patrulha -> membros
  const groupedGeneral = useMemo(()=>{
    // ordenar patrulhas por nome uma vez
    const sortedPatrols = [...patrols].sort((a,b)=> a.name.localeCompare(b.name))
    const res: Record<MemberRole, { patrol: Patrol, members: Row[] }[]> = {
      lobinhos: [], escoteiros: [], seniors: [], pioneiros: [], chefe: [],
    }
    for (const section of SECTION_ORDER){
      const cards: { patrol: Patrol, members: Row[] }[] = []
      for (const p of sortedPatrols){
        const ms = members
          .filter(m => m.role === section && m.patrol_id === p.id)
          .sort((a,b)=> a.display_name.localeCompare(b.display_name))
        if (ms.length > 0) cards.push({ patrol: p, members: ms })
      }
      res[section] = cards
    }
    return res
  }, [members, patrols])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Membros</h1>
        {/* Troca de visão */}
        <div className="flex rounded-lg overflow-hidden border">
          <button
            className={`px-3 py-1 text-sm ${view==='table'?'bg-black text-white':'bg-white'}`}
            onClick={()=>setView('table')}
          >Tabela</button>
          <button
            className={`px-3 py-1 text-sm ${view==='general'?'bg-black text-white':'bg-white'}`}
            onClick={()=>setView('general')}
          >Geral</button>
        </div>
      </div>

      {/* Criar novo (apenas na Tabela para não poluir a visão geral) */}
      {view==='table' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="text-sm">Nome</label>
            <input className="w-full border rounded p-2"
              value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ex.: João Silva" />
          </div>

          <div className="flex-1 min-w-[220px]">
            <label className="text-sm">E-mail</label>
            <input className="w-full border rounded p-2"
              value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="joao@email.com" />
          </div>

          <div>
            <label className="text-sm">Patrulha: </label>
            <select className="border rounded p-2"
              value={newPatrolId} onChange={e=>setNewPatrolId(e.target.value)}>
              <option value="">—</option>
              {patrols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm">Seção: </label>
            <select className="border rounded p-2"
              value={newRole} onChange={e=>setNewRole(e.target.value as MemberRole)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sendInvite} onChange={e=>setSendInvite(e.target.checked)} />
            Enviar convite por e-mail
          </label>

          <button
            onClick={addMember}
            disabled={adding}
            className={`px-3 py-2 rounded text-white ${adding ? 'bg-gray-600' : 'bg-black'}`}
          >
            {adding ? <div className="flex items-center gap-2"><Spinner/> Adicionando...</div> : 'Adicionar'}
          </button>
        </div>
      )}

      {/* FILTROS */}
{view === 'table' && (
  <div className="space-y-2">
    <div className="text-sm text-white/80">Filtrar por seção:</div>
<ChipGroup
  options={[
    { label: 'Todos',      value: 'all' as const },
    { label: 'Lobinhos',   value: 'lobinhos' as const },
    { label: 'Escoteiros', value: 'escoteiros' as const },
    { label: 'Seniors',    value: 'seniors' as const },
    { label: 'Pioneiros',  value: 'pioneiros' as const },
    { label: 'Chefes',     value: 'chefe' as const },
  ]}
  value={filterRole}
  onChange={(v)=>setFilterRole(v)}
  theme="light"   // 👈
/>
  </div>
)}


      {/* VISÃO: TABELA */}
      {view==='table' && (
        <div className="border rounded overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-gray-50">
                <th className="p-2">Nome</th>
                <th>E-mail</th>
                <th>Patrulha</th>
                <th>Seção</th>
                <th className="text-right pr-2">Presença</th>
                <th className="w-44">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-3 text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Spinner/> Carregando...
                    </span>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td className="p-3 text-gray-500" colSpan={6}>Nenhum membro.</td></tr>
              ) : filteredMembers.map(m => {
                const pct = presencePct(m.id)
                return (
                  <tr key={m.id} className="border-b">
                    <td className="p-2">
                      {editingId === m.id ? (
                        <input className="border rounded p-1 w-full"
                          value={editName} onChange={e=>setEditName(e.target.value)} />
                      ) : m.display_name}
                    </td>
                    <td className="p-2">
                      {editingId === m.id ? (
                        <input className="border rounded p-1 w-full" value={editEmail}
                          onChange={e=>setEditEmail(e.target.value)} placeholder="email@exemplo.com" />
                      ) : (m as any).email || '—'}
                    </td>
                    <td className="p-2">
                      {editingId === m.id ? (
                        <select className="border rounded p-1"
                          value={editPatrolId || ''} onChange={e=>setEditPatrolId(e.target.value || null)}>
                          <option value="">—</option>
                          {patrols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : patrolName(m.patrol_id)}
                    </td>
                    <td className="p-2">
                      {editingId === m.id ? (
                        <select className="border rounded p-1" value={editRole}
                          onChange={e=>setEditRole(e.target.value as MemberRole)}>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      ) : roleLabel(m.role)}
                    </td>
                    <td className="p-2 text-right">
                      {totalActivities > 0 ? (
                        <span className="inline-flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded overflow-hidden">
                            <div className="h-2 bg-green-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right tabular-nums">{pct}%</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-2">
                      {editingId === m.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className={`px-2 py-1 rounded text-white ${saving ? 'bg-gray-600' : 'bg-black'}`}
                          >
                            {saving ? <span className="inline-flex items-center gap-2"><Spinner/> Salvando...</span> : 'Salvar'}
                          </button>
                          <button onClick={cancelEdit} disabled={saving} className="px-2 py-1 rounded border">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={()=>startEdit(m)} className="px-2 py-1 rounded border">Editar</button>
                          <button
                            onClick={()=>removeMember(m.id)}
                            disabled={deletingId === m.id}
                            className="px-2 py-1 rounded border"
                          >
                            {deletingId === m.id
                              ? <span className="inline-flex items-center gap-2"><Spinner/> Excluindo...</span>
                              : 'Excluir'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VISÃO: GERAL (seção -> patrulhas -> membros) */}
      {view==='general' && (
        <div className="space-y-8">
          <p className="text-xs text-gray-500">
            Chefes não aparecem nesta visão por patrulha.
          </p>
          {SECTION_ORDER.map(section => {
            const cards = groupedGeneral[section] || []
            if (cards.length === 0) return null
            return (
              <div key={section} className="space-y-3">
                <h2 className="text-lg font-semibold">{ROLES.find(r=>r.value===section)?.label}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cards.map(({ patrol, members }) => (
                    <div key={patrol.id} className="border rounded-lg p-3">
                      <div className="font-medium mb-2">{patrol.name}</div>
                      <ul className="space-y-1">
                        {members.map(m => {
                          const pct = presencePct(m.id)
                          return (
                            <li key={m.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{m.display_name}</span>
                              {totalActivities > 0 ? (
                                <span className="inline-flex items-center gap-2">
                                  <div className="w-16 h-2 bg-gray-200 rounded overflow-hidden">
                                    <div className="h-2 bg-green-500" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="w-8 text-right tabular-nums text-xs">{pct}%</span>
                                </span>
                              ) : <span className="text-xs text-gray-400">—</span>}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {SECTION_ORDER.every(s => (groupedGeneral[s]||[]).length===0) && (
            <div className="text-sm text-gray-500">Sem membros nas seções juvenis.</div>
          )}
        </div>
      )}
    </div>
  )
}
