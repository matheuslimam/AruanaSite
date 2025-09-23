// supabase/functions/invite-member/index.ts
// 1) CORS + helpers (sempre JSON)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
const json = (status, data)=>new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
const bad = (msg)=>json(400, {
    error: msg
  });
const unauth = (msg = 'não autenticado')=>json(401, {
    error: msg
  });
const forbid = (msg = 'apenas chefes podem convidar/criar membros')=>json(403, {
    error: msg
  });
Deno.serve(async (req)=>{
  try {
    if (req.method === 'OPTIONS') return new Response('ok', {
      headers: corsHeaders
    });
    if (req.method === 'GET') return json(200, {
      ok: true,
      fn: 'invite-member',
      version: 5
    }); // << mude o número se precisar conferir deploy
    if (req.method !== 'POST') return json(405, {
      error: 'Method not allowed'
    });
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY'); // precisa estar setado nos Secrets
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const admin = createClient(SUPABASE_URL, SERVICE_KEY); // bypass RLS / auth.admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') ?? ''
        }
      }
    });
    // body
    const body = await req.json().catch(()=>({}));
    const { email, display_name, role, patrol_id, sendInvite = true, tempPassword = null } = body;
    if (!email || !display_name || !role) return bad('email, display_name e role são obrigatórios');
    // 2) quem chama precisa estar logado
    const { data: me, error: meErr } = await userClient.auth.getUser();
    if (meErr || !me?.user) return unauth();
    // 3) precisa ser CHEFE
    const { data: myProfile, error: profErr } = await admin.from('profiles').select('role').eq('user_id', me.user.id).single();
    if (profErr) return forbid('perfil não encontrado para o usuário autenticado');
    if (myProfile?.role !== 'chefe') return forbid();
    // 4) criar/ convidar
    let userId = null;
    let generatedPassword = null;
    if (sendInvite && !tempPassword) {
      const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          name: display_name
        }
      });
      if (invErr && !invErr.message?.includes('already registered')) {
        return bad(`inviteUserByEmail: ${invErr.message}`);
      }
      userId = invited?.user?.id ?? null;
    } else {
      generatedPassword = tempPassword ?? crypto.randomUUID().slice(0, 12);
      const { data: created, error: crtErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: generatedPassword,
        user_metadata: {
          name: display_name
        }
      });
      if (crtErr && !crtErr.message?.includes('already registered')) {
        return bad(`createUser: ${crtErr.message}`);
      }
      userId = created?.user?.id ?? null;
    }
    // 5) upsert profile
    const { error: upErr } = await admin.from('profiles').upsert({
      user_id: userId,
      display_name,
      email,
      role,
      patrol_id: patrol_id ?? null,
      is_youth: role === 'chefe' ? false : true
    }, {
      onConflict: 'email'
    });
    if (upErr) return bad(`profiles upsert: ${upErr.message}`);
    return json(200, {
      ok: true,
      tempPassword: generatedPassword
    });
  } catch (e) {
    return json(500, {
      error: String(e?.message || e)
    });
  }
});
