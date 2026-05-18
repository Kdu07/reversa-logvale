import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
  images: {
    formats: ['image/webp'],
  },
}

export default withSentryConfig(nextConfig, {
  silent:         true,
  hideSourceMaps: true,
})
