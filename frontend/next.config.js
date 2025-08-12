/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // 키워드 매트릭스 전용 최적화
  webpack: (config) => {
    // three.js 최적화
    config.externals = config.externals || [];
    config.externals.push({
      'three/examples/jsm/controls/OrbitControls': 'THREE.OrbitControls',
    });
    return config;
  },
  // 메모리 사용량 최적화
  compress: true,
  swcMinify: true,
  poweredByHeader: false,
  generateEtags: false,
  
  // 환경변수 설정
  env: {
    CUSTOM_KEY: 'heal7-keywords-matrix',
    SERVICE_PORT: '8003'
  },
  
  // 보안 헤더 설정 (iframe 허용)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'
          },
        ],
      },
    ]
  }
}

module.exports = nextConfig