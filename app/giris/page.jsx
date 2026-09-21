'use client';
import { useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Field } from '../../components/ui.jsx';
import { useT, useLocale, LanguageSwitch } from '../../lib/i18n/context.jsx';
import { LOCALES } from '../../lib/i18n/index.js';

export default function LoginPage() {
  const { repo, user, household, reload } = useApp();
  const t = useT();
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [hname, setHname] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const wrap = (fn) => async (e) => { e.preventDefault(); setErr(''); try { await fn(); } catch (ex) { setErr(ex.message); } };
  const langRow = <div style={{ marginBottom: 'var(--sp-4)' }}><LanguageSwitch /></div>;

  if (repo.mode === 'demo') {
    return (
      <Card style={{ marginTop: 'var(--sp-8)' }}>
        <h1 className="h1">{t('app.name')}</h1>
        <p className="muted" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>{t('app.tagline')}</p>
        {langRow}
        <a className="btn btn--block" href="/">{t('auth.demoEnter')}</a>
      </Card>
    );
  }

  if (user && !household) {
    return (
      <>
        <div className="page-head" style={{ marginTop: 'var(--sp-6)' }}>
          <h1 className="h1">{t('common.welcome')} 👋</h1>
          <LanguageSwitch />
        </div>
        <Card title={t('auth.createHousehold')}>
          <form onSubmit={wrap(async () => {
            await repo.auth.createHousehold({ name: hname || t('app.name'), base_currency: 'CLP', timezone: 'America/Santiago', display_name: name || null, locale });
            await reload(); location.href = '/';
          })}>
            <Field label={t('auth.yourName')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t('settings.name')}><input className="input" value={hname} onChange={(e) => setHname(e.target.value)} placeholder={LOCALES[locale].code === 'es' ? 'Nuestra casa' : 'Bizim Ev'} /></Field>
            <button className="btn btn--block">{t('auth.createHousehold')}</button>
          </form>
        </Card>
        <Card title={t('auth.joinHousehold')}>
          <form onSubmit={wrap(async () => { await repo.auth.joinHousehold(code, name || null); await reload(); location.href = '/'; })}>
            <Field label={t('auth.code')}><input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} /></Field>
            <button className="btn btn--outline btn--block">{t('auth.joinHousehold')}</button>
          </form>
        </Card>
        {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
      </>
    );
  }

  return (
    <Card style={{ marginTop: 'var(--sp-8)' }}>
      <h1 className="h1">{t('app.name')}</h1>
      <p className="muted" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>{t('app.tagline')}</p>
      {langRow}
      {sent ? <div className="banner" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-ink)' }}>{t('auth.sent')}</div> : (
        <form onSubmit={wrap(async () => { await repo.auth.signInWithEmail(email); setSent(true); })}>
          <Field label={t('auth.email')}><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn btn--block">{t('auth.sendLink')}</button>
        </form>
      )}
      {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
    </Card>
  );
}
