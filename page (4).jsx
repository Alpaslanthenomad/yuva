'use client';
import { useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Field } from '../../components/ui.jsx';
import { useT, useLocale, LanguageSwitch } from '../../lib/i18n/context.jsx';

/**
 * Giriş: e-posta + şifre. Bilinçli olarak sihirli bağlantı (magic link) YOK.
 * Gerekçe: iki kişilik bir hane için her girişte e-posta beklemek, bağlantıya
 * tıklamak ve yönlendirme adresi ayarlamak gereksiz sürtünme yaratıyordu.
 * Şifre; Windows, Mac ve telefonda aynı çalışır, tarayıcı kaydeder.
 */
export default function LoginPage() {
  const { repo, user, household, reload } = useApp();
  const t = useT();
  const { locale } = useLocale();

  const [mode, setMode] = useState('signin');      // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Hane kurulum ekranı alanları
  const [name, setName] = useState('');
  const [hname, setHname] = useState('');
  const [code, setCode] = useState('');

  /** Supabase'in İngilizce hata metinlerini kullanıcı diline çevirir. */
  const humanError = (ex) => {
    const m = String(ex?.message || '').toLowerCase();
    if (m.includes('invalid login credentials')) return t('auth.errWrong');
    if (m.includes('email not confirmed')) return t('auth.errNeedsConfirm');
    if (m.includes('already registered') || m.includes('already been registered')) return t('auth.errExists');
    if (m.includes('password should be at least')) return t('auth.errShort');
    return ex?.message || t('auth.errGeneric');
  };

  const submitAuth = async (e) => {
    e.preventDefault();
    setErr('');
    if (password.length < 6) { setErr(t('auth.errShort')); return; }
    setBusy(true);
    try {
      if (mode === 'signup') await repo.auth.signUp(email.trim(), password);
      else await repo.auth.signIn(email.trim(), password);
      const s = await reload();
      // Hane varsa uygulamaya gir; yoksa bu sayfa kurulum adımına düşer.
      if (s?.household) location.href = '/';
    } catch (ex) {
      setErr(humanError(ex));
    } finally {
      setBusy(false);
    }
  };

  const wrap = (fn) => async (e) => {
    e.preventDefault(); setErr('');
    try { await fn(); } catch (ex) { setErr(humanError(ex)); }
  };

  // ---- Demo mod: Supabase bağlı değil ----
  if (repo.mode === 'demo') {
    return (
      <Card style={{ marginTop: 'var(--sp-8)' }}>
        <h1 className="h1">{t('app.name')}</h1>
        <p className="muted" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>{t('app.tagline')}</p>
        <div style={{ marginBottom: 'var(--sp-4)' }}><LanguageSwitch /></div>
        <a className="btn btn--block" href="/">{t('auth.demoEnter')}</a>
      </Card>
    );
  }

  // ---- Giriş yapıldı ama henüz hane yok ----
  if (user && !household) {
    return (
      <>
        <div className="page-head" style={{ marginTop: 'var(--sp-6)' }}>
          <h1 className="h1">{t('common.welcome')} 👋</h1>
          <LanguageSwitch />
        </div>
        <Card title={t('auth.createHousehold')}>
          <form onSubmit={wrap(async () => {
            await repo.auth.createHousehold({
              name: hname || t('app.name'), base_currency: 'CLP',
              timezone: 'America/Santiago', display_name: name || null, locale,
            });
            await reload(); location.href = '/';
          })}>
            <Field label={t('auth.yourName')}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t('settings.name')}>
              <input className="input" value={hname} onChange={(e) => setHname(e.target.value)}
                     placeholder={locale === 'es' ? 'Nuestra casa' : 'Bizim Ev'} />
            </Field>
            <button className="btn btn--block">{t('auth.createHousehold')}</button>
          </form>
        </Card>
        <Card title={t('auth.joinHousehold')}>
          <form onSubmit={wrap(async () => {
            await repo.auth.joinHousehold(code, name || null);
            await reload(); location.href = '/';
          })}>
            <Field label={t('auth.code')}>
              <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
            </Field>
            <button className="btn btn--outline btn--block">{t('auth.joinHousehold')}</button>
          </form>
        </Card>
        {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
      </>
    );
  }

  // ---- E-posta + şifre ----
  return (
    <Card style={{ marginTop: 'var(--sp-8)' }}>
      <h1 className="h1">{t('app.name')}</h1>
      <p className="muted" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>{t('app.tagline')}</p>
      <div style={{ marginBottom: 'var(--sp-4)' }}><LanguageSwitch /></div>

      <div className="seg" style={{ display: 'flex', marginBottom: 'var(--sp-4)' }}>
        {[['signin', 'tabSignIn'], ['signup', 'tabSignUp']].map(([m, key]) => (
          <button type="button" key={m} style={{ flex: 1 }}
            className={'seg__btn' + (mode === m ? ' seg__btn--active' : '')}
            onClick={() => { setMode(m); setErr(''); }}>
            {t('auth.' + key)}
          </button>
        ))}
      </div>

      <form onSubmit={submitAuth}>
        <Field label={t('auth.email')}>
          <input className="input" type="email" required autoComplete="username"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('auth.password')}>
          <input className="input" type="password" required minLength={6}
                 autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                 value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="faint">{t('auth.passwordHint')}</span>
        </Field>
        {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
        <button className="btn btn--block" disabled={busy}>
          {busy ? t('common.loading') : t(mode === 'signup' ? 'auth.signUp' : 'auth.signIn')}
        </button>
      </form>
    </Card>
  );
}
