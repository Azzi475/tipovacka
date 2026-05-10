import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      {/* Pozadí - responzivní pro mobily */}
      <div 
        className="absolute inset-0 -z-10 dark:hidden"
        style={{ 
          backgroundImage: 'url(/images/bg-landing-light.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <div 
        className="absolute inset-0 -z-10 hidden dark:block"
        style={{ 
          backgroundImage: 'url(/images/bg-landing-dark.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat'
        }}
      />
      {/* Overlay pro čitelnost */}
      <div className="absolute inset-0 -z-10 bg-white/30 dark:bg-black/30" />

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-8 sm:py-12 text-center relative">
        <div className="mb-4 sm:mb-6">
          <Image
            src="/images/trophy-hero-light.svg"
            alt="Tipovačka"
            width={160}
            height={160}
            className="dark:hidden mx-auto w-32 h-32 sm:w-48 sm:h-48"
            priority
            unoptimized={true}
          />
          <Image
            src="/images/trophy-hero-dark.svg"
            alt="Tipovačka"
            width={160}
            height={160}
            className="hidden dark:block mx-auto w-32 h-32 sm:w-48 sm:h-48"
            priority
            unoptimized={true}
          />
        </div>
        
        <h1 className="text-3xl sm:text-[32px] leading-tight sm:leading-[40px] font-semibold text-text-primary dark:text-white mb-3 sm:mb-4 drop-shadow-lg">
          Tipovačka
        </h1>
        
        <p className="text-sm sm:text-base leading-5 sm:leading-6 text-gray-800 dark:text-gray-100 max-w-xs sm:max-w-md mb-6 sm:mb-10 drop-shadow-md font-medium px-2">
          Soutěžní tipování výsledků mistrovství světa ve fotbale i hokeji. Přesné tipy, správní vítězové a napínavé pořadí.
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-xs sm:max-w-sm sm:flex-row">
          <Link href="/login" className="btn-primary w-full shadow-xl py-3 sm:py-3 text-sm sm:text-base">
            Přihlásit se
          </Link>
          <Link href="/register" className="btn-secondary w-full shadow-xl py-3 sm:py-3 text-sm sm:text-base">
            Vytvořit účet
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-8 sm:py-12 bg-white/70 dark:bg-card-dark/70 backdrop-blur-md border-t border-gray-200 dark:border-border-dark relative">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <FeatureCard
            icon="/icons/feature-sports-light.svg"
            iconDark="/icons/feature-sports-dark.svg"
            title="Více sportů"
            description="Fotbal i hokej v jedné aplikaci. Přepínej mezi turnaji podle sezóny."
          />
          <FeatureCard
            icon="/icons/feature-target-light.svg"
            iconDark="/icons/feature-target-dark.svg"
            title="Přesné bodování"
            description="3 body za jedinečný přesný tip, 2 body za sdílený, 1 bod za vítěze."
          />
          <FeatureCard
            icon="/icons/feature-chart-light.svg"
            iconDark="/icons/feature-chart-dark.svg"
            title="Žebříček"
            description="Sleduj své umístění v reálném čase. Admin může žebříček uzavřít."
          />
        </div>
      </section>
    </main>
  )
}

function FeatureCard({ icon, iconDark, title, description }: { 
  icon: string
  iconDark: string
  title: string
  description: string
}) {
  return (
    <div className="card p-4 sm:p-6 text-center">
      <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 bg-light-blue dark:bg-border-dark rounded-xl flex items-center justify-center">
        <Image src={icon} alt={title} width={20} height={20} className="dark:hidden sm:w-6 sm:h-6" unoptimized={true} />
        <Image src={iconDark} alt={title} width={20} height={20} className="hidden dark:block sm:w-6 sm:h-6" unoptimized={true} />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-text-primary dark:text-white mb-1 sm:mb-2">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-4 sm:leading-5">
        {description}
      </p>
    </div>
  )
}