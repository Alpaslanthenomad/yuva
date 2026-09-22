'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getRepo } from '../lib/data/index.js';
import BottomNav from './BottomNav.jsx';
import QuickAdd from './QuickAdd.jsx';
import { useT, useLocale, LanguageSwitch } from '../lib/i18n/context.jsx';
import { fmtDay, fmtTime } from '../lib/dates.js';
import { authScreen } from '../lib/authState.js';

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
  // Bağlantı durumu. Uygulamanın çevrimdışı yazma kuyruğu YOK; bu yüzden
  // "senkron bekliyor" demek yanlış olurdu — çevrimdışıyken değişiklik
  // kaydedilmiyor ve kullanıcıya bunu açıkça söylüyoruz.
  const [online, setOnline] = useState(true);
  const [channel, setChannel] = useState('SUBSCRIBED');

  // Son başarılı yenilemenin zamanı. Kaçırılan değişiklikleri yakalamak için
  // kullanılır (aşağıdaki resync); sekmeye her dönüşte sunucuya gitmeyelim diye
  // eşik var.
  const lastSyncRef = useRef(0);

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
      lastSyncRef.current = Date.now();
      return base;   // çağıran (giriş ekranı) haneyi görüp görmediğini bilsin
    } catch (e) {
      console.error(e);
      setState((s) => ({ ...s, loading: false, error: e.message }));
      return null;
    }
  }, [repo, applyHouseholdDefault]);

  useEffect(() => { reload(); }, [reload]);

  /**
   * Kaçırılanları yakala. Canlı yenileme yalnızca kanal AÇIKKEN gelen olayları
   * duyar; kanal kapalıyken (uyuyan telefon, tünelden geçen tren, arka plana
   * atılmış sekme) yapılan değişiklikler geri dönünce KENDİLİĞİNDEN gelmez —
   * ekran sessizce eskimiş kalıyordu. Bağlantı/sekme geri geldiğinde tam
   * yenileme yapılır. `force` kanal yeniden kurulduğunda kullanılır; sekme
   * değiştirmede eşik aranır, her sekme dönüşünde sunucuya gitmeyelim.
   */
  const RESYNC_MS = 15000;
  const resync = useCallback((force = false) => {
    if (!force && Date.now() - lastSyncRef.current < RESYNC_MS) return;
    reload();
    setTick((x) => x + 1);
  }, [reload]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const sync = () => {
      const on = navigator.onLine;
      setOnline(on);
      if (on) resync(true);   // çevrimdışıyken hiçbir şey duymadık
    };
    setOnline(navigator.onLine);
    const onVisible = () => { if (document.visibilityState === 'visible') resync(); };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [resync]);

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
    // Bir kez bağlandıysak, sonraki her bağlanma "yeniden bağlanma"dır.
    let everSubscribed = false;
    const unsub = repo.subscribe((table) => {
      if (['households', 'household_members', 'accounts', 'categories'].includes(table)) deep = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (deep) { deep = false; reload(); } else setTick((x) => x + 1);
      }, 400);
    }, (status) => {
      setChannel(status);
      // Kanal koptuktan sonra yeniden kuruldu: arada olan biteni duymadık.
      if (status !== 'SUBSCRIBED') return;
      if (everSubscribed) resync(true);
      everSubscribed = true;   // ilk bağlanmada zaten az önce yüklendi
    });
    return () => { clearTimeout(timer); if (typeof unsub === 'function') unsub(); };
  }, [repo, state.household?.id, reload, resync]);
  const value = useMemo(() => ({
    repo, ...state, tick, bump, reload, locale,
    memberById: (id) => state.members.find((m) => m.id === id),
    categoryById: (id) => state.categories.find((c) => c.id === id),
    accountById: (id) => state.accounts.find((a) => a.id === id),
    baseCurrency: state.household?.base_currency || 'CLP',
    openQuick: () => setQuickOpen(true),
  }), [repo, state, tick, bump, reload, locale]);

  const isAuthPage = pathname?.startsWith('/giris');
  // Hangi ekran çizilecek — karar lib/authState.js'te, tek yerde ve testli.
  // Özü: ŞİFRE EKRANI YALNIZCA OTURUM YOKKEN.
  const screen = authScreen(state, repo.mode);
  const needsAuth = screen === 'login' || screen === 'setup';
  const cantLoad = screen === 'retry';

  return (
    <AppCtx.Provider value={value}>
      <div className="shell">
        <main className="shell__main">
          {repo.mode === 'demo' && !isAuthPage && <div className="banner">{t('common.demoBanner')}</div>}
          {/* Sağlıklıyken hiçbir şey gösterilmez; kalıcı yeşil rozet gürültüdür.
              Yalnızca veriye güvenilemeyecek durumda uyarı çıkar. */}
          {!isAuthPage && !online && (
            <div className="banner banner--danger">
              <strong>{t('sync.offline')}</strong> — {t('sync.offlineHint')}
            </div>
          )}
          {/* Sunucuya ulaşılamadığı için önbellekten okundu. Çevrimdışı şeridiyle
              birlikte de çıkabilir: o şerit yazmanın engelli olduğunu,
              bu şerit görünen bilginin eski olduğunu söyler. */}
          {!isAuthPage && state.stale && (
            <div className="banner banner--danger">
              <strong>{t('sync.stale')}</strong> — {t('sync.staleHint', `${fmtDay(String(state.stale).slice(0, 10))} ${fmtTime(state.stale)}`)}
            </div>
          )}
          {!isAuthPage && online && !state.stale && repo.mode === 'supabase' && channel !== 'SUBSCRIBED' && (
            <div className="banner">
              <strong>{t('sync.reconnecting')}</strong> — {t('sync.reconnectingHint')}
            </div>
          )}
          {state.loading ? <div className="empty">{t('common.loading')}</div>
            : cantLoad && !isAuthPage ? (
              <div className="empty">
                <p>{t('sync.cantLoad')}</p>
                <button className="btn" onClick={() => reload()}>{t('sync.retry')}</button>
              </div>
            )
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
