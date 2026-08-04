import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
    serverComponentsExternalPackages: ['nodemailer'],
    // Upload da NF pelo cliente (XML/DANFE) via Server Action — o default de 1 MB
    // não cobre um DANFE. O limite real (5 MB) é validado em uploadInvoiceFileAction.
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    formats: ['image/webp'],
  },
}

export default withSentryConfig(nextConfig, {
  silent:         true,
  hideSourceMaps: true,
})
