import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { requireAuth } from '../supabase'
import Nav from '../components/Nav'

export default function AppLayout(){
  const navigate = useNavigate()
  useEffect(()=>{ requireAuth(navigate) },[])
  return (
    <div className="min-h-screen flex flex-col">
      <Nav/>
      <main className="max-w-6xl mx-auto w-full p-4 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
