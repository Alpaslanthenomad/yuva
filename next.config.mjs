/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // statik export — CDN/Vercel/Netlify, PWA
  trailingSlash: true,       // /takvim/ → out/takvim/index.html
  images: { unoptimized: true },
  reactStrictMode: true,
  // Hangi sürümün çalıştığı Ayarlar'da yazsın. Telefonun güncellenip
  // güncellenmediğini tahmin etmek zorunda kalmayalım — bir kez bunu
  // tahmin etmeye çalışmak günler kaybettirdi.
  env: {
    NEXT_PUBLIC_BUILD: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'yerel',
    NEXT_PUBLIC_BUILD_AT: new Date().toISOString().slice(0, 10),
  },
};
export default nextConfig;
