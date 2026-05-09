import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // DŮLEŽITÉ: Povolení statických WEBP/PNG souborů z public/
  images: {
    unoptimized: true,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co;"
          }
        ]
      }
    ]
  }
}

export default nextConfig