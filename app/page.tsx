import Link from 'next/link'
import Image from 'next/image'

// DŮLEŽITÉ: Musí být NAMED funkce s default exportem
export default function HomePage() {
  return (
    <main className="min-h-screen bg-bg-light dark:bg-bg-dark flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-8">
          <Image
            src="/images/logo-trophy-light.webp"
            alt="Tipovačka"
            width={120}
            height={120}
            className="dark:hidden mx-auto"
            priority
            unoptimized={true}
          />
          <Image
            src="/images/logo-trophy-dark.webp"
            alt="Tipovačka"
            width={120}
            height={120}
            className="hidden dark:block mx-auto"
            priority
            unoptimized={true}
          />
        </div>
        
        <h1 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white mb-4">
          Tipovačka
        </h1>
        
        <p className="text-base leading-6 text-gray-600 dark:text-gray-300 max-w-md mb-10">
          Tipuj výsledky zápasů MS ve fotbale a hokeji. Soutěž s přáteli a zjisti, 
          kdo má nejlepší fotbalové či hokejové instinkty!
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Link 
            href="/login" 
            className="btn-primary w-full"
          >
            Přihlásit se
          </Link>
          <Link 
            href="/register" 
            className="btn-secondary w-full"
          >
            Vytvořit účet
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-12 bg-white dark:bg-card-dark border-t border-gray-200 dark:border-border-dark">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="/icons/feature-sports.webp"
            title="Více sportů"
            description="Fotbal i hokej v jedné aplikaci. Přepínej mezi turnaji podle sezóny."
          />
          <FeatureCard
            icon="/icons/feature-target.webp"
            title="Přesné bodování"
            description="3 body za jedinečný přesný tip, 2 body za sdílený, 1 bod za vítěze."
          />
          <FeatureCard
            icon="/icons/feature-chart.webp"
            title="Žebříček"
            description="Sleduj své umístění v reálném čase. Admin může žebříček uzavřít."
          />
        </div>
      </section>
    </main>
  )
}

function FeatureCard({ icon, title, description }: { 
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="card p-6 text-center">
      <div className="w-12 h-12 mx-auto mb-4 bg-light-blue dark:bg-border-dark rounded-xl flex items-center justify-center">
        <Image src={icon} alt={title} width={24} height={24} className="dark:invert" unoptimized={true} />
      </div>
      <h3 className="text-lg font-semibold text-text-primary dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-5">
        {description}
      </p>
    </div>
  )
}