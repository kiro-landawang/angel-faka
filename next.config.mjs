/** @type {import('next').NextConfig} */
const nextConfig = {
  // 不使用 standalone 输出：Vercel/Netlify 各自的 Next.js Runtime 会自行处理动态路由。
  // standalone 仅在自托管 Docker 时需要，启用它会导致 Vercel 上的客户端动态页面（如 /orders/[orderNo]）返回 404。
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://client.crisp.chat; style-src 'self' 'unsafe-inline'; connect-src 'self' https://client.crisp.chat; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;