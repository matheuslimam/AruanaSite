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
  patrol?: { id: string; name: string } | null
}

export function useMyProfile() {
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data: u } = await supabase.auth.getUser()
      if (!u?.user) { if (alive){ setProfile(null); setLoading(false) } ; return }
      const { data, error } = await supabase
        .from('profiles')
        .select('id,user_id,display_name,email,role,is_youth,patrol_id,patrol:patrol_id(id,name)')
        .eq('user_id', u.user.id)
        .maybeSingle()
      if (alive){
        if (error) console.error('profile load error:', error)
        setProfile((data ?? null) as ProfileRow | null)
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return { profile, loading }
}

/** Deixa passar só quem tem um dos roles em `allow` */
export function RequireRole({
  allow, to, children
}: { allow: MemberRole[]; to: string; children: React.ReactNode }) {
  const { profile, loading } = useMyProfile()
  if (loading) return null
  if (!profile) return <Navigate to="/auth" replace />
  return allow.includes(profile.role) ? <>{children}</> : <Navigate to={to} replace />
}
