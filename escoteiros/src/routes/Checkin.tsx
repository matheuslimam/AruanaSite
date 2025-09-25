// src/routes/Checkin.tsx
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { useMyProfile } from '../guards'

type State =
  | 'loading'
  | 'ok'
  | 'already'
  | 'invalid'
  | 'expired'
  | 'forbidden'
  | 'error'

function isUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
}

export default function Checkin() {
  const { profile } = useMyProfile()
  const loc = useLocation()
  const [state, setState] = useState<State>('loading')
  const [msg, setMsg] = useState<string>('Carregando…')

  useEffect(() => {
    if (!profile) return
    const params = new URLSearchParams(loc.search)
    const t = (params.get('t') || '').trim()
    const a = (params.get('a') || '').trim()

    async function run() {
      try {
        if (!t && !a) {
          setState('invalid'); setMsg('Link inválido.')
          return
        }

        // 1) Resolver activity_id
        let activity_id: string | null = null
        let tokenGroup: string | null = null
        let expiresAt: string | null = null

        if (a && isUUID(a)) {
          activity_id = a
        } else if (t) {
          // (a) se tiver tabela activity_tokens, valida token
          // (b) fallback: se t já for uuid, usa como activity_id
          const { data, error } = await supabase
            .from('activity_tokens')
            .select('activity_id, group_id, expires_at')
            .eq('token', t)
            .maybeSingle()

          if (!error && data) {
            activity_id = data.activity_id as string
            tokenGroup = (data as any).group_id || null
            expiresAt = (data as any).expires_at || null
          } else if (isUUID(t)) {
            activity_id = t
          } else {
            setState('invalid'); setMsg('Link inválido.')
            return
          }
        }

        if (!activity_id) {
          setState('invalid'); setMsg('Link inválido.')
          return
        }

        // 2) Carrega atividade para validar grupo
        const { data: act, error: actErr } = await supabase
          .from('activities')
          .select('id, group_id, date, title')
          .eq('id', activity_id)
          .maybeSingle()

        if (actErr || !act) {
          setState('invalid'); setMsg('Atividade não encontrada.')
          return
        }

        // 3) Se token tinha group_id, confere; senão confere pelo da atividade
        const gidFromTokenOrActivity = tokenGroup || (act as any).group_id || null
        if (!gidFromTokenOrActivity || profile!.group_id !== gidFromTokenOrActivity) {
          setState('forbidden'); setMsg('Este check-in não pertence ao seu grupo.')
          return
        }

        // 4) Expiração do token (se existir campo)
        if (expiresAt) {
          const now = new Date()
          const exp = new Date(expiresAt)
          if (isFinite(+exp) && now > exp) {
            setState('expired'); setMsg('Este QR/Link expirou.')
            return
          }
        }

        // 5) Já tem presença?
        const { data: att } = await supabase
          .from('attendance')
          .select('activity_id')
          .eq('activity_id', act.id)
          .eq('member_id', profile!.id)
          .maybeSingle()

        if (att) {
          setState('already'); setMsg('Você já confirmou presença nesta atividade.')
          return
        }

        // 6) Upsert presença
        const { error: upErr } = await supabase
          .from('attendance')
          .upsert({ activity_id: act.id, member_id: profile!.id, present: true })

        if (upErr) {
          setState('error'); setMsg('Não foi possível registrar sua presença.')
          return
        }

        setState('ok'); setMsg('Presença confirmada! ✔')
      } catch (e) {
        setState('error'); setMsg('Ocorreu um erro no check-in.')
      }
    }

    void run()
  }, [profile, loc.search])

  const Title = () => <h1 className="text-2xl font-extrabold">Check-in</h1>

  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white text-center space-y-4">
        <Title />
        {state === 'loading' && <p className="text-zinc-600">Validando link…</p>}

        {state !== 'loading' && (
          <>
            {state === 'ok' && (
              <p className="text-emerald-700 font-medium">{msg}</p>
            )}

            {state === 'already' && (
              <p className="text-emerald-700">{msg}</p>
            )}

            {state === 'invalid' && (
              <>
                <p className="text-rose-600 font-medium">✖ Link inválido.</p>
                <p className="text-sm text-zinc-600">
                  Certifique-se de ler o QR correto ou use o botão “Check-in por QR” no seu painel.
                </p>
              </>
            )}

            {state === 'expired' && (
              <>
                <p className="text-rose-600 font-medium">⏰ Link expirado.</p>
                <p className="text-sm text-zinc-600">
                  Peça um novo QR/Link para o chefe da atividade.
                </p>
              </>
            )}

            {state === 'forbidden' && (
              <>
                <p className="text-rose-600 font-medium">🚫 Este check-in é de outro grupo.</p>
                <p className="text-sm text-zinc-600">
                  Entre em contato com sua chefia.
                </p>
              </>
            )}

            {state === 'error' && (
              <>
                <p className="text-rose-600 font-medium">Algo deu errado ao registrar sua presença.</p>
                <p className="text-sm text-zinc-600">
                  Tente novamente em instantes.
                </p>
              </>
            )}

            <div className="pt-2">
              <Link to="/app/meu" className="px-4 py-2 rounded border">
                Ir para o app
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
