const serverConfig = require('./server_config').getProperties()
const { REGION = 'in', APP_ENV = 'development' } = process.env

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/stub/:path*',
        destination: 'http://localhost:3001/:path*' // Proxy to Backend
      }
    ]
  },
  images: {
    domains: ['imgcdn.shortlyst.com', 'static.shopalyst.com', 'static.shortlyst.com'],
    loader: 'custom'
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  env: {
    ...serverConfig
  },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find((rule) => rule.test && rule.test?.test?.('.svg'))
    fileLoaderRule.exclude = /\.svg$/
    config.module.rules.push({
      test: /\.svg$/,
      loader: require.resolve('@svgr/webpack')
    })
    return config
  }
}

module.exports = async (phase) => {
  // No transpilation happens here, hence use only nodejs supported features
  // Setup app cache if needed
  // For making api calls use axios
  nextConfig.env.country = REGION
  nextConfig.env.appEnv = APP_ENV
  return nextConfig
}
