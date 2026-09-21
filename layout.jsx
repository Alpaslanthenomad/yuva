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
  return (
    <html lang="tr">
      <body>
        <LocaleProvider>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
