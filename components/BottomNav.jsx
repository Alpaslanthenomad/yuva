'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../lib/i18n/context.jsx';

const ITEMS = [
  { href: '/', icon: '🏡', key: 'today' },
  { href: '/takvim/', icon: '📅', key: 'calendar' },
  { href: '/para/', icon: '💰', key: 'money' },
  { href: '/planlar/', icon: '🧭', key: 'plans' },
  { href: '/aile/', icon: '👨‍👩‍👧‍👦', key: 'family' },
];

export default function BottomNav() {
  const path = usePathname() || '/';
  const t = useT();
  const isActive = (href) => (href === '/' ? path === '/' : path.startsWith(href.replace(/\/$/, '')));
  return (
    <nav className="nav" aria-label={t('app.name')}>
      <Link href="/" className="nav__brand">{t('app.name')}</Link>
      {ITEMS.map((it) => (
        <Link key={it.key} href={it.href} className={'nav__item' + (isActive(it.href) ? ' nav__item--active' : '')}>
          <span className="nav__icon" aria-hidden>{it.icon}</span>
          <span>{t('nav.' + it.key)}</span>
        </Link>
      ))}
    </nav>
  );
}
