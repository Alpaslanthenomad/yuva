'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getRepo } from '../lib/data/index.js';
import BottomNav from './BottomNav.jsx';
import QuickAdd from './QuickAdd.jsx';
import { useT, useLocale, LanguageSwitch } from '../lib/i18n/context.jsx';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function AppShell({ children }) {
  const repo = useMemo(() => getRepo(), []);
  const pathname = usePathname();
  const t = useT();
  const { locale, applyHouseholdDefault } = useLocale();
  const [state, setState] = useState({ loading: true, household: null, members: [], me: null, user: null, accounts: [], categories: [], rates: {} });
  const [quickOpen, setQuickOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(async () => {
    try {
      const base = await repo.init();
      if (!base.household) { setState((s) => ({ ...s, ...base, loading: false })); return base; }
      applyHouseholdDefault(base.household.locale);
      // supabaseRepo.init() hesap/kategori/kuru zaten tek pakette getirir (0004).
      // demoRepo getirmediği için orada eski yoldan tamamlanır.
      const [accounts, categories, rates] = base.categories
        ? [base.accounts, base.categories, base.rates]
        : await Promise.all([repo.accounts.list(), repo.categories.list(), repo.fx.rates()]);
      setState({ ...base, accounts, categories, rates, loading: false });
      return base;   // çağıran (giriş ekranı) haneyi görüp görmediğini bilsin
    } catch (e) {
      console.error(e);
      setState((s) => ({ ...s, loading: false, error: e.message }));
      return null;
    }
  }, [repo, applyHouseholdDefault]);

  useEffect(() => { reload(); }, [reload]);

  // PWA service worker
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const bump = useCallback(() => setTick((x) => x + 1), []);

  // Canlı yenileme (0009): başka bir cihazda veri değişince ekran kendiliğinden
  // tazelenir. Aynı anda gelen olaylar 400 ms'de tek yenilemeye indirilir; bir
  // alışveriş listesini işaretlemek onlarca olay üretebiliyor.
  // Hane/üye/hesap/kategori değiştiyse tick yetmez — kabuk verisi de yenilenir.
  useEffect(() => {
    const hid = state.household?.id;
    if (!hid || typeof repo.subscribe !== 'function') return;
    let timer = null;
    let deep = false;
    const unsub = repo.subscribe((table) => {
      if (['households', 'household_members', 'accounts', 'categories'].includes(table)) deep = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (deep) { deep = false; reload(); } else setTick((x) => x + 1);
      }, 400);
    });
    return () => { clearTimeout(timer); if (typeof unsub === 'function') unsub(); };
  }, [repo, state.household?.id, reload]);
  const value = useMemo(() => ({
    repo, ...state, tick, bump, reload, locale,
    memberById: (id) => state.members.find((m) => m.id === id),
    categoryById: (id) => state.categories.find((c) => c.id === id),
    accountById: (id) => state.accounts.find((a) => a.id === id),
    baseCurrency: state.household?.base_currency || 'CLP',
    openQuick: () => setQuickOpen(true),
  }), [repo, state, tick, bump, reload, locale]);

  const isAuthPage = pathname?.startsWith('/giris');
  const needsAuth = !state.loading && repo.mode === 'supabase' && !state.household;

  return (
    <AppCtx.Provider value={value}>
      <div className="shell">
        <main className="shell__main">
          {repo.mode === 'demo' && !isAuthPage && <div className="banner">{t('common.demoBanner')}</div>}
          {state.loading ? <div className="empty">{t('common.loading')}</div>
            : needsAuth && !isAuthPage ? <AuthGate />
            : children}
        </main>
        {!isAuthPage && !needsAuth && (
          <>
            <BottomNav />
            <button className="fab" aria-label={t('quick.title')} onClick={() => setQuickOpen(true)}>+</button>
            {quickOpen && <QuickAdd onClose={() => setQuickOpen(false)} />}
          </>
        )}
      </div>
    </AppCtx.Provider>
  );
}

function AuthGate() {
  const t = useT();
  return (
    <div className="card" style={{ marginTop: 'var(--sp-8)' }}>
      <h1 className="h1">{t('app.name')}</h1>
      <p className="muted" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>{t('app.tagline')}</p>
      <div style={{ marginBottom: 'var(--sp-4)' }}><LanguageSwitch /></div>
      <a className="btn btn--block" href="/giris/">{t('auth.title')}</a>
    </div>
  );
}
