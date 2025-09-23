import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-white to-slate-50">
      {/* Header fixo */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="font-extrabold text-xl tracking-tight">Aruanã</Link>
          <nav className="flex items-center gap-3">
            <a href="#como-funciona" className="text-sm text-slate-700 hover:text-black">Como funciona</a>
            <a href="#recursos" className="text-sm text-slate-700 hover:text-black">Recursos</a>
            <a href="#faq" className="text-sm text-slate-700 hover:text-black">FAQ</a>
            <Link to="/auth" className="px-3 py-1.5 rounded-md bg-black text-white text-sm">Entrar</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center px-6 md:px-8 py-10 md:py-16">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Sempre Alerta! <br className="hidden md:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-sky-600">
                Gestão simples para o seu grupo.
              </span>
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Crie atividades, faça chamada e some pontos por patrulha em poucos cliques.
              Exporta PNG bonito do placar para divulgar nos encontros e redes.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/auth" className="px-5 py-3 rounded-md bg-black text-white font-medium">
                Entrar na gestão
              </Link>
              <a href="#como-funciona" className="px-5 py-3 rounded-md border font-medium">
                Como funciona
              </a>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                ✅ Sem planilhas confusas
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-sky-50 text-sky-700">
                ⚡ Em tempo real
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 text-violet-700">
                🖼️ PNG do placar
              </span>
            </div>
          </div>

          {/* “mock” de preview */}
          <div className="rounded-2xl border bg-white shadow-sm p-5">
            <div className="text-sm font-semibold mb-3">Exemplo do Placar</div>
            <div className="grid grid-cols-3 gap-3">
              {['Lobos', 'Falcões', 'Tigres'].map((p, i) => (
                <div key={p} className="rounded-xl border p-4">
                  <div className="text-xs text-slate-500">#{i+1}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl">{i===0?'🐺':i===1?'🦅':'🐯'}</span>
                    <div className="font-bold">{p}</div>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold tabular-nums">{(10-i)*37}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-gradient-to-r from-emerald-200 via-sky-200 to-violet-200" />
            <p className="mt-3 text-xs text-slate-500">
              Visual ilustrativo. No app real, o placar usa as suas patrulhas, pontos e cores por seção.
            </p>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="max-w-6xl mx-auto px-6 md:px-8 py-12">
          <h2 className="text-3xl font-extrabold tracking-tight">Como funciona</h2>
          <p className="mt-2 text-slate-600 max-w-3xl">
            Em poucos passos você organiza o encontro, registra as presenças e as conquistas,
            e acompanha o placar por patrulha automaticamente.
          </p>

          <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <li className="rounded-xl border bg-white p-5">
              <div className="text-2xl">🧭</div>
              <h3 className="mt-3 font-semibold">1) Configure o Grupo</h3>
              <p className="mt-1 text-sm text-slate-600">
                Cadastre seções (Lobinhos, Escoteiros, Sêniores), patrulhas e jovens.
                Tudo fica vinculado para o placar consolidado.
              </p>
            </li>
            <li className="rounded-xl border bg-white p-5">
              <div className="text-2xl">🗓️</div>
              <h3 className="mt-3 font-semibold">2) Crie a Atividade</h3>
              <p className="mt-1 text-sm text-slate-600">
                Título, data e seção. Pode adicionar observações e objetivos.
              </p>
            </li>
            <li className="rounded-xl border bg-white p-5">
              <div className="text-2xl">✅</div>
              <h3 className="mt-3 font-semibold">3) Faça a Chamada</h3>
              <p className="mt-1 text-sm text-slate-600">
                Marque presença/ausência por jovem. Os totais da atividade são somados automaticamente.
              </p>
            </li>
            <li className="rounded-xl border bg-white p-5">
              <div className="text-2xl">🏅</div>
              <h3 className="mt-3 font-semibold">4) Atribua Pontos</h3>
              <p className="mt-1 text-sm text-slate-600">
                Pontos individuais (mérito, boa ação) e/ou pontos diretos para a patrulha (desafio, espírito escoteiro).
              </p>
            </li>
            <li className="rounded-xl border bg-white p-5">
              <div className="text-2xl">📊</div>
              <h3 className="mt-3 font-semibold">5) Placar em Tempo Real</h3>
              <p className="mt-1 text-sm text-slate-600">
                A soma aparece no placar por patrulha. Cores por seção e ranking automático.
              </p>
            </li>
            <li className="rounded-xl border bg-white p-5">
              <div className="text-2xl">🖼️</div>
              <h3 className="mt-3 font-semibold">6) Exporte o PNG</h3>
              <p className="mt-1 text-sm text-slate-600">
                Gere um PNG bonito do placar (com logo/data) para compartilhar no grupo ou redes sociais.
              </p>
            </li>
          </ol>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="px-5 py-3 rounded-md bg-black text-white font-medium">Começar agora</Link>
            <a href="#recursos" className="px-5 py-3 rounded-md border font-medium">Ver recursos</a>
          </div>
        </section>

        {/* RECURSOS */}
        <section id="recursos" className="max-w-6xl mx-auto px-6 md:px-8 py-12">
          <h2 className="text-3xl font-extrabold tracking-tight">O que você ganha</h2>
          <p className="mt-2 text-slate-600 max-w-3xl">
            Ferramentas pensadas para a rotina do grupo — simples, diretas e com visual padronizado.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🔐', title: 'Login simples', desc: 'Autenticação via Supabase, com segurança e praticidade.' },
              { icon: '🧒', title: 'Jovens & Patrulhas', desc: 'Vincule cada jovem à sua patrulha, por seção.' },
              { icon: '📝', title: 'Atividades', desc: 'Crie, edite e registre presença de forma organizada.' },
              { icon: '🏆', title: 'Pontuação clara', desc: 'Pontos individuais e por patrulha, com regras simples.' },
              { icon: '📈', title: 'Placar em tempo real', desc: 'Ranking automático com cores por seção.' },
              { icon: '🖼️', title: 'Exportação de PNG', desc: 'Um clique para gerar arte pronta para divulgação.' },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-white p-5">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PARA QUEM É */}
        <section className="max-w-6xl mx-auto px-6 md:px-8 py-12">
          <h2 className="text-3xl font-extrabold tracking-tight">Para quem é</h2>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardPill title="Chefes de seção" text="Ganham agilidade para preparar e conduzir encontros." />
            <CardPill title="Conselhos de Patrulha" text="Acompanham seu desempenho e combinam metas." />
            <CardPill title="Diretoria do Grupo" text="Visual padrão para comunicação e prestação de contas." />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-6xl mx-auto px-6 md:px-8 py-12">
          <h2 className="text-3xl font-extrabold tracking-tight">Perguntas frequentes</h2>
          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <FaqItem q="Preciso pagar?" a="Não. O projeto é comunitário para facilitar a gestão do grupo. Futuramente podemos adicionar recursos avançados." />
            <FaqItem q="Posso personalizar as regras de pontos?" a="Sim. Você pode pontuar individualmente ou por patrulha conforme suas regras internas." />
            <FaqItem q="Consigo usar só o placar?" a="Consegue. Mas o fluxo completo (atividade → chamada → pontos) deixa tudo automático." />
            <FaqItem q="Funciona no celular?" a="Sim. A interface é responsiva e roda no navegador do celular." />
          </div>

          <div className="mt-8">
            <Link to="/auth" className="px-5 py-3 rounded-md bg-black text-white font-medium">Entrar e testar</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-8 py-8 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>© {new Date().getFullYear()} Aruanã — feito com ❤️ pela tropa</div>
          <div className="flex items-center gap-3">
            <a href="#como-funciona" className="hover:text-slate-700">Como funciona</a>
            <a href="#recursos" className="hover:text-slate-700">Recursos</a>
            <Link to="/auth" className="hover:text-slate-700">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ----- componentes auxiliares ----- */
function CardPill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <h3 className="font-semibold">{q}</h3>
      <p className="mt-1 text-sm text-slate-600">{a}</p>
    </div>
  )
}
