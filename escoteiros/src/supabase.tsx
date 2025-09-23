import { createClient, type Session } from '@supabase/supabase-js'
import React, { createContext, useContext, useEffect, useState } from 'react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const supabase = createClient(supabaseUrl, supabaseKey)

const SessionCtx = createContext<{ session: Session | null, loading: boolean }>({ session: null, loading: true })

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return <SessionCtx.Provider value={{ session, loading }}>{children}</SessionCtx.Provider>
}

export function useSession() {
  return useContext(SessionCtx)
}

export async function requireAuth(navigate: (p: string) => void) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) navigate('/auth')
}
