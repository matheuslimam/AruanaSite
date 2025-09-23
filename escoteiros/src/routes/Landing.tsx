import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="font-bold">Aruana</div>
          <Link to="/auth" className="px-3 py-1 rounded bg-black text-white">Entrar</Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center p-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Sempre Alerta!<br/>Gestão simples para o seu grupo.</h1>
            <p className="mt-4 text-lg text-gray-600">Crie atividades, faça chamada e some pontos por patrulha em poucos cliques.</p>
            <div className="mt-6 flex gap-3">
              <Link to="/auth" className="px-5 py-3 rounded bg-black text-white">Entrar na gestão</Link>
              <a href="#como-funciona" className="px-5 py-3 rounded border">Como funciona</a>
            </div>
          </div>
          <div className="rounded-2xl border p-6">
            <ul className="space-y-3 text-sm">
              <li>• Cadastro/Login com Supabase</li>
              <li>• Atividades com chamada e pontuação</li>
              <li>• Jovens vinculados a Patrulhas</li>
              <li>• Placar por Patrulha em tempo real</li>
            </ul>
          </div>
        </section>

        <section id="como-funciona" className="max-w-6xl mx-auto p-8">
          <h2 className="text-2xl font-bold">Como funciona</h2>
          <p className="mt-2 text-gray-600">Ao criar uma atividade, abrimos a chamada (presenças) e uma área de pontos. Os pontos individuais somam automaticamente no placar da patrulha do jovem. Também é possível dar pontos diretos para a patrulha.</p>
        </section>
      </main>

      <footer className="p-6 text-center text-sm text-gray-500">© {new Date().getFullYear()} Aruana</footer>
    </div>
  )
}
