/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // statik export — CDN/Vercel/Netlify, PWA
  trailingSlash: true,       // /takvim/ → out/takvim/index.html
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
