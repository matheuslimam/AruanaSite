import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import type { MemberRole } from './types'

export type ProfileRow = {
  id: string
  user_id: string | null
  display_name: string
  email: string | null
  role: MemberRole
  is_youth: boolean
  patrol_id: string | null
  group_id?: string | null
  patrol?: { id: string; name: string } | null
  group?: { id: string; name: string; invite_code: string } | null
}

export function useMyProfile() {
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data: u } = await supabase.auth.getUser()
      if (!u?.user) { if (alive) { setProfile(null); setLoading(false) } ; return }
      const { data, error } = await supabase
        .from('profiles')
        .select('id,user_id,display_name,email,role,is_youth,patrol_id,group_id,patrol:patrol_id(id,name),group:group_id(id,name,invite_code)')
        .eq('user_id', u.user.id)
        .maybeSingle()
      if (!alive) return
      if (error) console.error('profile load error:', error)
      setProfile((data ?? null) as ProfileRow | null)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  return { profile, loading }
}

/** Permite apenas quem tem um dos roles. 
 *  Se não houver profile (novo usuário sem grupo), manda para onboarding. */
export function RequireRole({
  allow, to, children
}: { allow: MemberRole[]; to: string; children: React.ReactNode }) {
  const { profile, loading } = useMyProfile()
  if (loading) return null
  if (!profile) return <Navigate to="/app/onboarding" replace />
  return allow.includes(profile.role) ? <>{children}</> : <Navigate to={to} replace />
}

/** Permite acesso se o usuário NÃO está em um grupo.
 *  - Sem profile (usuário novo): deixa passar para onboarding.
 *  - Com group_id: redireciona para a home por role. */
export function RequireNoGroup({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useMyProfile()
  if (loading) return null
  if (!profile) return <>{children}</> // novo usuário autenticado sem profile -> pode ver onboarding
  if (profile.group_id) {
    const to = (profile.role === 'chefe' || profile.role === 'pioneiros') ? '/app/atividades' : '/app/meu'
    return <Navigate to={to} replace />
  }
  return <>{children}</>
}

/** /app -> direciona para rota correta.
 *  - Sem profile: vai para onboarding (não para /auth).
 *  - Com profile mas sem group_id: onboarding
 *  - Com group_id: home por role. */
export function IndexRedirect() {
  const { profile, loading } = useMyProfile()
  if (loading) return null
  if (!profile || !profile.group_id) return <Navigate to="/app/onboarding" replace />
  const to = (profile.role === 'chefe' || profile.role === 'pioneiros') ? '/app/atividades' : '/app/meu'
  return <Navigate to={to} replace />
}
