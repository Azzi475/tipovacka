import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-6">🏆</div>
        <h1 className="text-5xl font-black mb-4 tracking-tight">Tipovačka</h1>
        <p className="text-xl text-blue-200 mb-12 max-w-2xl mx-auto">
          Soutěžní tipování výsledků mistrovství světa. 
          Přesné tipy, správní vítězové a napínavé pořadí.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login" className="bg-white text-blue-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition shadow-xl">
            Přihlásit se
          </Link>
          <Link href="/register" className="bg-blue-600 bg-opacity-30 backdrop-blur border border-blue-400 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-opacity-40 transition">
            Vytvořit účet
          </Link>
        </div>

        <div className="mt-20 grid sm:grid-cols-3 gap-6 text-left">
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-xl p-6 border border-white border-opacity-10">
            <div className="text-3xl mb-3">⚽🏒</div>
            <h3 className="font-bold text-lg mb-2">Fotbal i hokej</h3>
            <p className="text-blue-200 text-sm">Tipujte zápasy MS ve fotbale i hokeji s přáteli nebo kolegy.</p>
          </div>
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-xl p-6 border border-white border-opacity-10">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold text-lg mb-2">Chytré bodování</h3>
            <p className="text-blue-200 text-sm">3 body za přesný tip, 2 za sdílený přesný, 1 za správného vítěze.</p>
          </div>
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-xl p-6 border border-white border-opacity-10">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold text-lg mb-2">Live leaderboard</h3>
            <p className="text-blue-200 text-sm">Sledujte pořadí v reálném čase. Kdo bude nejlepší tipér?</p>
          </div>
        </div>
      </div>
    </div>
  )
}