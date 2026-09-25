import '../styles/globals.css';
import { LocaleProvider } from '../lib/i18n/context.jsx';
import AppShell from '../components/AppShell.jsx';

export const metadata = {
  title: 'YUVA — Aile yönetimi · Gestión familiar',
  description: 'Ortak takvim, ev muhasebesi ve planlama — telefondan, tek elle. · Calendario compartido, gastos del hogar y planificación, desde el teléfono.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'YUVA' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport = {
  themeColor: '#2F6F5E',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  // lang, dil seçilince LocaleProvider tarafından istemcide güncellenir.
  // Bu betik <head> içinde, boyamadan ÖNCE çalışır. Olmasaydı koyu kip seçmiş
  // biri her açılışta bir anlık beyaz parlama görürdü — telefonda en rahatsız
  // eden ayrıntı bu. Kısa tutuluyor: burada hata olursa uygulama hiç açılmaz,
  // o yüzden tamamı try/catch içinde ve başarısız olursa açık kipe düşer.
  const kipBetigi = `(function(){try{var p=localStorage.getItem('yuva:theme');`
    + `if(p!=='light'&&p!=='dark'){p=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}`
    + `var d=document.documentElement;d.dataset.theme=p;d.style.colorScheme=p;}catch(e){}})()`;

  return (
    <html lang="tr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: kipBetigi }} /></head>
      <body>
        <LocaleProvider>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
