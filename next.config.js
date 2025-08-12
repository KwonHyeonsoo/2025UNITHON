// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Next.js API 라우트 전용 (예: /api/*)
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { 
            key: "Access-Control-Allow-Origin", 
            value: "https://dapi.kakao.com, https://api.openai.com" 
          }, // 두 API 도메인만 허용
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { 
            key: "Access-Control-Allow-Headers", 
            value: "X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization" 
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
