'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../lib/i18n/context.jsx';
import Icon from './icons.jsx';

const ITEMS = [
  { href: '/', key: 'today' },
  { href: '/takvim/', key: 'calendar' },
  { href: '/para/', key: 'money' },
  { href: '/planlar/', key: 'plans' },
  { href: '/aile/', key: 'family' },
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
          <span className="nav__icon"><Icon name={it.key} /></span>
          <span>{t('nav.' + it.key)}</span>
        </Link>
      ))}
    </nav>
  );
}
