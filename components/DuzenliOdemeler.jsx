'use client';
// components/DuzenliOdemeler.jsx — Bütçe → Hesaplar: düzenli ödemeler (0033).
//
// Kira, okul, aidat gibi ödemeler. Otomatik yazılmayanlar vade gelince
// "✓ Ödendi" ya da "Atla" denene kadar bekler (gecikmiş görünür); ödendi
// deyince harcama yazılır ve vade bir sonraki döneme geçer. Bildirimden
// gelindiyse (?ode=<id>) o satırın onayı kendiliğinden açılır.
import { useEffect, useState } from 'react';
import { useApp } from './AppShell.jsx';
import { Card, Row, Chips, Sheet, Field, Money } from './ui.jsx';
import { useT, useLocale } from '../lib/i18n/context.jsx';
import { today, fmtDay, relativeLabel, daysBetween } from '../lib/dates.js';
import { formatMoney, parseAmount, minorToDecimal, CURRENCY_CODES } from '../lib/money.js';
import { DUZENLI_ONERILER, presetName, presetCategoryId } from '../lib/expenseCatalog.js';

const FREKANSLAR = ['MONTHLY', 'WEEKLY', 'YEARLY'];
const frekansi = (rrule) => FREKANSLAR.find((f) => String(rrule || '').toUpperCase().includes('FREQ=' + f)) || 'MONTHLY';

export default function DuzenliOdemeler({ bills, baseCurrency, odeId }) {
  const { repo, bump, categoryById, accounts } = useApp();
  const t = useT();
  const T = today();
  const [form, setForm] = useState(null);     // null | {} | {rule}
  const [onay, setOnay] = useState(odeId || null);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState('');

  useEffect(() => { if (odeId) setOnay(odeId); }, [odeId]);

  const ode = async (b) => {
    setBusy(true); setHata('');
    try { await repo.recurring.pay(b.id); setOnay(null); bump(); }
    catch (e) { setHata(e.message); } finally { setBusy(false); }
  };
  const atla = async (b) => {
    setBusy(true); setHata('');
    try { await repo.recurring.skip(b.id); setOnay(null); bump(); }
    catch (e) { setHata(e.message); } finally { setBusy(false); }
  };

  const sirali = [...(bills || [])].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on));

  return (
    <Card title={`🔁 ${t('bills.title')}`}
      action={<button type="button" className="btn btn--sm" onClick={() => setForm({})}>＋ {t('bills.addShort')}</button>}>
      {sirali.length === 0 && (
        <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('bills.empty')}</div>
      )}
      {sirali.map((b) => {
        const kalan = daysBetween(T, b.next_due_on);
        const gecikti = b.kind === 'expense' && !b.auto_post && kalan < 0;
        const yakin = b.kind === 'expense' && !b.auto_post && kalan <= Math.max(b.reminder_days || 0, 3);
        const cat = categoryById(b.category_id);
        return (
          <Row key={b.id} icon={cat?.icon || '🧾'} title={b.name} onClick={() => setForm({ rule: b })}
            sub={`${fmtDay(b.next_due_on)} · ${relativeLabel(b.next_due_on)}${b.auto_post ? ' · ⚙︎ ' + t('money.autoPost') : ''}`}
            end={<div style={{ textAlign: 'right' }}>
              <Money amount={b.amount} currency={b.currency} kind={b.kind} />
              {gecikti && <div><span className="tag tag--danger">{t('bills.overdue')}</span></div>}
            </div>}>
            {yakin && (onay === b.id ? (
              <div className="bill-onay" onClick={(e) => e.stopPropagation()}>
                <div className="faint">{t('bills.confirm', b.name, formatMoney(b.amount, b.currency))}</div>
                <div className="inline" style={{ marginTop: 'var(--sp-2)' }}>
                  <button type="button" className="btn btn--sm" disabled={busy} onClick={() => ode(b)}>✓ {t('bills.yesPaid')}</button>
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => atla(b)}>{t('bills.skip')}</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOnay(null)}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              <div className="inline" style={{ marginTop: 'var(--sp-2)' }} onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setOnay(b.id)}>✓ {t('bills.paid')}</button>
              </div>
            ))}
          </Row>
        );
      })}
      {hata && <div className="banner banner--danger">{hata}</div>}
      {sirali.length > 0 && (
        <>
          <div className="spacer" />
          <div className="between muted"><span>{t('money.monthlyFixed')}</span><span className="money">{formatMoney(sirali.filter((b) => b.kind === 'expense' && b.currency === baseCurrency && frekansi(b.rrule) === 'MONTHLY').reduce((s, b) => s + Number(b.amount), 0), baseCurrency)}</span></div>
        </>
      )}
      {form && (
        <Sheet onClose={() => setForm(null)} title={form.rule ? t('bills.edit') : t('bills.add')}>
          <DuzenliForm rule={form.rule} baseCurrency={baseCurrency} accounts={accounts} onDone={() => { setForm(null); bump(); }} />
        </Sheet>
      )}
    </Card>
  );
}

function DuzenliForm({ rule, baseCurrency, accounts, onDone }) {
  const { repo, categories } = useApp();
  const t = useT();
  const { locale } = useLocale();
  const [name, setName] = useState(rule?.name || '');
  const [amount, setAmount] = useState(rule ? String(Number(rule.amount)) : '');
  const [currency, setCurrency] = useState(rule?.currency || baseCurrency);
  const [accountId, setAccountId] = useState(rule?.account_id || accounts?.[0]?.id || '');
  const [categoryId, setCategoryId] = useState(rule?.category_id || '');
  const [freq, setFreq] = useState(frekansi(rule?.rrule));
  const [due, setDue] = useState(rule?.next_due_on || today());
  const [remind, setRemind] = useState(String(rule?.reminder_days ?? 1));
  const [auto, setAuto] = useState(Boolean(rule?.auto_post));
  const [secili, setSecili] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [silOnay, setSilOnay] = useState(false);

  const sec = (p) => {
    setSecili(p.key); setName(presetName(p, locale)); setFreq(p.freq);
    const c = presetCategoryId(p, categories); if (c) setCategoryId(c);
  };

  const gider = (categories || []).filter((c) => c.kind === 'expense');
  const ust = gider.filter((c) => !c.parent_id);

  const kaydet = async (e) => {
    e.preventDefault(); setErr('');
    const minor = parseAmount(amount, currency);
    if (!name.trim()) { setErr(t('bills.errName')); return; }
    if (!minor) { setErr(t('money.errAmount')); return; }
    setBusy(true);
    try {
      const row = {
        name: name.trim(), kind: 'expense', amount: minorToDecimal(minor, currency), currency,
        account_id: accountId || null, category_id: categoryId || null, rrule: 'FREQ=' + freq,
        next_due_on: due, reminder_days: Number(remind), auto_post: auto,
      };
      if (rule) await repo.recurring.update(rule.id, row);
      else await repo.recurring.create({ ...row, is_active: true });
      onDone();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const sil = async () => {
    setBusy(true);
    try { await repo.recurring.remove(rule.id); onDone(); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={kaydet}>
      {!rule && (
        <>
          <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('bills.pickHint')}</div>
          <div className="chips-wrap" style={{ marginBottom: 'var(--sp-3)' }}>
            {DUZENLI_ONERILER.map((p) => (
              <button key={p.key} type="button" className={'chip' + (secili === p.key ? ' chip--active' : '')} onClick={() => sec(p)}>
                {p.emoji} {presetName(p, locale)}
              </button>
            ))}
          </div>
        </>
      )}
      <Field label={t('bills.name')}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label={t('money.amount')}>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t('money.currency')}>
          <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('bills.freq')}>
        <Chips value={freq} onChange={setFreq} options={FREKANSLAR.map((f) => ({ value: f, label: t('bills.freqs.' + f) }))} />
      </Field>
      <div className="grid-2">
        <Field label={t('bills.nextDue')}>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label={t('bills.remind')}>
          <select className="select" value={remind} onChange={(e) => setRemind(e.target.value)}>
            {['0', '1', '3', '7'].map((d) => <option key={d} value={d}>{t('bills.remindOpt.' + d)}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label={t('money.account')}>
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {(accounts || []).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
        </Field>
        <Field label={t('money.category')}>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">—</option>
            {ust.map((c) => (
              <optgroup key={c.id} label={`${c.icon} ${c.name}`}>
                <option value={c.id}>{c.icon} {c.name}</option>
                {gider.filter((x) => x.parent_id === c.id).map((x) => <option key={x.id} value={x.id}>↳ {x.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>
      <label className="inline" style={{ margin: 'var(--sp-2) 0' }}>
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} style={{ width: 22, height: 22 }} />
        <span>{t('bills.auto')}<br /><span className="faint">{auto ? t('bills.autoOn') : t('bills.autoOff')}</span></span>
      </label>
      {err && <div className="banner banner--danger">{err}</div>}
      <button className="btn btn--block" disabled={busy}>{t('common.save')}</button>
      {rule && (silOnay ? (
        <div className="grid-2" style={{ marginTop: 'var(--sp-2)' }}>
          <button type="button" className="btn btn--ghost" onClick={() => setSilOnay(false)}>{t('common.cancel')}</button>
          <button type="button" className="btn btn--danger" disabled={busy} onClick={sil}>{t('common.yesDelete')}</button>
        </div>
      ) : (
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setSilOnay(true)}>🗑️ {t('bills.remove')}</button>
      ))}
    </form>
  );
}
