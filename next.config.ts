import path from 'node:path'

import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), usb=(), payment=(), accelerometer=(), autoplay=()'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=15552000; includeSubDomains'
  }
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      },
      {
        protocol: 'http',
        hostname: '**'
      }
    ]
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ]
  },
  async redirects() {
    return [
      {
        source: '/demo-video',
        destination:
          'https://youtu.be/cacGGPPOtFU',
        permanent: false
      }
    ]
  },
  webpack(config) {
    config.resolve.alias ??= {}
    config.resolve.alias['@react-native-async-storage/async-storage'] =
      path.resolve('./src/lib/async-storage-shim.ts')
    config.resolve.alias['@farcaster/frame-sdk'] = '@farcaster/miniapp-sdk'
    config.resolve.alias.punycode = 'punycode/'

    if (!config.infrastructureLogging) {
      config.infrastructureLogging = {}
    }
    config.infrastructureLogging.level = 'error'

    const ignoreWarnings = Array.isArray(config.ignoreWarnings)
      ? config.ignoreWarnings
      : []
    config.ignoreWarnings = [
      ...ignoreWarnings,
      (warning: unknown) => {
        const message = String(
          (warning as { message?: string })?.message ?? warning ?? ''
        )
        return (
          message.includes('PackFileCacheStrategy') ||
          message.includes('Serializing big strings')
        )
      }
    ]

    return config
  }
}

export default nextConfig
