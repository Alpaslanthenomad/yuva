'use client';
import { useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Row, Field, Empty } from '../../components/ui.jsx';
import { useT, useLocale, LanguageSwitch } from '../../lib/i18n/context.jsx';
import { LOCALES } from '../../lib/i18n/index.js';
import { CURRENCIES, CURRENCY_CODES } from '../../lib/money.js';

export default function SettingsPage() {
  const { repo, household, accounts, categories, rates, reload } = useApp();
  const t = useT();
  const { locale } = useLocale();
  const [f, setF] = useState(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  if (!household) return <Empty>{t('common.loading')}</Empty>;

  const form = f || {
    name: household.name, base_currency: household.base_currency, timezone: household.timezone,
    holiday_countries: household.holiday_countries || [], locale: (household.locale || 'tr').slice(0, 2),
  };
  const up = (k) => (e) => setF({ ...form, [k]: e.target.value });
  const toggleCountry = (c) => setF({ ...form, holiday_countries: form.holiday_countries.includes(c) ? form.holiday_countries.filter((x) => x !== c) : [...form.holiday_countries, c] });
  const save = async (e) => { e.preventDefault(); await repo.household.update(form); await reload(); setF(null); };

  return (
    <>
      <div className="page-head"><h1 className="h1">{t('settings.title')}</h1><span className="tag">{repo.mode === 'supabase' ? '☁️ ' + t('settings.connected') : '📱 ' + t('settings.demo')}</span></div>

      {/* Dil — en üstte, çünkü aranan ilk şey bu */}
      <Card title={`🌐 ${t('settings.language')}`}>
        <LanguageSwitch block />
        <div className="faint" style={{ marginTop: 'var(--sp-3)' }}>{t('settings.languageHint')}</div>
      </Card>

      <Card title={t('settings.household')}>
        <form onSubmit={save}>
          <Field label={t('settings.name')}><input className="input" value={form.name} onChange={up('name')} /></Field>
          <div className="grid-2">
            <Field label={t('settings.baseCurrency')}>
              <select className="select" value={form.base_currency} onChange={up('base_currency')}>
                {CURRENCY_CODES.map((c) => <option key={c} value={c}>{CURRENCIES[c].flag} {c} — {t('currencies.' + c)}</option>)}
              </select>
            </Field>
            <Field label={t('settings.timezone')}>
              <select className="select" value={form.timezone} onChange={up('timezone')}>{['America/Santiago', 'Europe/Istanbul', 'Europe/Tallinn', 'UTC'].map((z) => <option key={z}>{z}</option>)}</select>
            </Field>
          </div>
          <Field label={t('settings.householdLanguage')}>
            <select className="select" value={form.locale} onChange={up('locale')}>
              {Object.values(LOCALES).map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
            </select>
            <span className="faint">{t('settings.householdLanguageHint')}</span>
          </Field>
          <Field label={t('settings.holidays')}>
            <div className="chips">
              {['CL', 'TR'].map((c) => <button type="button" key={c} className={'chip' + (form.holiday_countries.includes(c) ? ' chip--active' : '')} onClick={() => toggleCountry(c)}>{c === 'CL' ? '🇨🇱' : '🇹🇷'} {t('countries.' + c)}</button>)}
            </div>
          </Field>
          <button className="btn btn--block" disabled={!f}>{t('common.save')}</button>
        </form>
      </Card>

      {/* Kod yalnızca yetişkine döner (0007); misafirde alan hiç gelmez. */}
      {household.join_code && (
      <Card title={t('settings.joinCode')}>
        <div className="between">
          <span className="mono" style={{ fontSize: 'var(--fs-xl)', letterSpacing: '.1em' }}>{household.join_code}</span>
          <button className="btn btn--ghost btn--sm" onClick={() => { navigator.clipboard?.writeText(household.join_code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? '✓ ' + t('common.copied') : t('common.copy')}
          </button>
        </div>
        <div className="faint" style={{ marginTop: 'var(--sp-2)' }}>{t('settings.joinCodeHint')}</div>
        <div className="faint" style={{ marginTop: 'var(--sp-1)' }}>
          {household.join_code_uses_left === 0 ? t('settings.joinCodeSpent') : t('settings.joinCodeLimit')}
        </div>
        <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 'var(--sp-2)' }}
          disabled={rotating}
          onClick={async () => { setRotating(true); try { await repo.household.rotateJoinCode(); await reload(); } finally { setRotating(false); } }}>
          {t('settings.newCode')}
        </button>
      </Card>
      )}

      <Card title={t('settings.accounts')}>
        {accounts.map((a) => <Row key={a.id} icon={a.icon} title={a.name} sub={`${a.currency} · ${t('currencies.' + a.currency)}`} />)}
      </Card>

      <Card title={t('settings.rates')}>
        {Object.entries(rates).map(([k, v]) => <Row key={k} title={`1 ${k.slice(0, 3)} = ${v.toLocaleString(LOCALES[locale].intl)} ${k.slice(3)}`} />)}
        <div className="faint">{t('settings.ratesHint')}</div>
      </Card>

      <Card title={t('settings.categories')}>
        <div className="inline">{categories.filter((c) => !c.parent_id).map((c) => <span key={c.id} className="tag">{c.icon} {c.name}</span>)}</div>
      </Card>

      {repo.mode === 'supabase' && <PasswordCard t={t} repo={repo} />}

      <Card title={t('settings.data')}>
        <div className="inline">
          <button className="btn btn--outline btn--sm" onClick={() => exportCsv(repo)}>{t('settings.exportCsv')}</button>
          {repo.mode === 'demo' && <button className="btn btn--outline btn--sm" onClick={() => { repo.reset(); location.reload(); }}>{t('settings.resetDemo')}</button>}
          {repo.mode === 'supabase' && <button className="btn btn--danger btn--sm" onClick={async () => { await repo.auth.signOut(); location.href = '/giris/'; }}>{t('settings.signOut')}</button>}
        </div>
      </Card>

      <Card title={t('settings.connect')} className="card--flat">
        <p className="faint">{repo.mode === 'supabase' ? t('settings.connectedHint') : t('settings.demoHint')}</p>
      </Card>
    </>
  );
}

/** Şifre değiştirme — yalnızca Supabase modunda anlamlı. */
function PasswordCard({ t, repo }) {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    if (pw.length < 6) { setErr(t('auth.errShort')); return; }
    setBusy(true);
    try {
      await repo.auth.changePassword(pw);
      setPw(''); setMsg(t('settings.passwordChanged'));
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Card title={`🔑 ${t('settings.password')}`}>
      <form onSubmit={submit}>
        <Field label={t('settings.newPassword')}>
          <input className="input" type="password" minLength={6} autoComplete="new-password"
                 value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {msg && <div className="banner" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-ink)' }}>{msg}</div>}
        {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
        <button className="btn btn--outline" disabled={busy || !pw}>{t('settings.changePassword')}</button>
      </form>
    </Card>
  );
}

async function exportCsv(repo) {
  const rows = await repo.transactions.list({ limit: 10000 });
  const head = ['occurred_on', 'kind', 'amount', 'currency', 'amount_base', 'merchant', 'category_id', 'account_id', 'for_member_id', 'tags'];
  const csv = [head.join(','), ...rows.map((r) => head.map((h) => JSON.stringify(Array.isArray(r[h]) ? r[h].join('|') : r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'yuva.csv'; a.click();
}
