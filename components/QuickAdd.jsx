'use client';
import { useEffect, useState } from 'react';
import { useApp } from './AppShell.jsx';
import ShoppingPicker from './ShoppingPicker.jsx';
import { Sheet, Field } from './ui.jsx';
import { useT, useLocale } from '../lib/i18n/context.jsx';
import { parseAmount, minorToDecimal, CURRENCY_CODES, CURRENCIES } from '../lib/money.js';
import { today, buildRRule, freqKeyOf } from '../lib/dates.js';
import { EXPENSE_PRESETS, presetName, presetCategoryId } from '../lib/expenseCatalog.js';

const TABS = [
  { key: 'expense', icon: '💸' }, { key: 'event', icon: '📅' }, { key: 'task', icon: '✅' }, { key: 'shopping', icon: '🛒' },
];
const LAST_KEY = 'yuva:quick:last';

export default function QuickAdd({ onClose, initial = 'expense' }) {
  const t = useT();
  const [tab, setTab] = useState(initial);
  const [done, setDone] = useState(null);
  return (
    <Sheet onClose={onClose} title={t('quick.title')}>
      <div className="quick-grid" style={{ marginBottom: 'var(--sp-4)' }}>
        {TABS.map((x) => (
          <button key={x.key} className={'quick-btn' + (tab === x.key ? ' quick-btn--active' : '')} onClick={() => { setTab(x.key); setDone(null); }}>
            <span className="quick-btn__icon">{x.icon}</span>{t('quick.' + x.key)}
          </button>
        ))}
      </div>
      {done && <div className="banner" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-ink)' }}>✓ {t('quick.added')}: {done}</div>}
      {tab === 'expense' && <ExpenseForm onDone={(m) => setDone(m)} />}
      {tab === 'event' && <EventForm onDone={(m) => setDone(m)} />}
      {tab === 'task' && <TaskForm onDone={(m) => setDone(m)} />}
      {tab === 'shopping' && <ShoppingQuickPick onDone={(m) => setDone(m)} />}
    </Sheet>
  );
}

function useLast() {
  const [last, setLast] = useState({});
  useEffect(() => { try { setLast(JSON.parse(localStorage.getItem(LAST_KEY) || '{}')); } catch { /* */ } }, []);
  const remember = (patch) => { const n = { ...last, ...patch }; setLast(n); try { localStorage.setItem(LAST_KEY, JSON.stringify(n)); } catch { /* */ } };
  return [last, remember];
}

/**
 * Harcama / gelir / transfer formu.
 * `txn` verilirse düzenleme kipi: alanlar dolu gelir, kaydet günceller,
 * altta iki adımlı silme çıkar.
 */
export function ExpenseForm({ onDone, planId, txn, preset, checkoutListId }) {
  const { repo, accounts, categories, members, me, bump, baseCurrency } = useApp();
  const t = useT();
  const { locale } = useLocale();
  const [last, remember] = useLast();
  const editing = Boolean(txn);
  const [kind, setKind] = useState(txn?.kind || 'expense');
  const [amount, setAmount] = useState(txn ? String(txn.amount) : '');
  const [currency, setCurrency] = useState(txn?.currency || baseCurrency);
  const [accountId, setAccountId] = useState(txn?.account_id || '');
  const [toAccountId, setToAccountId] = useState(txn?.transfer_account_id || '');
  const [categoryId, setCategoryId] = useState(txn?.category_id || preset?.categoryId || '');
  const [merchant, setMerchant] = useState(txn?.merchant || preset?.merchant || '');
  const [forMember, setForMember] = useState(txn?.for_member_id || '');
  const [date, setDate] = useState(txn?.occurred_on || today());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [quick, setQuick] = useState('');   // seçili hazır harcama (Uber, Metro…)

  useEffect(() => {
    if (editing) return;   // düzenlemede alanlar işlemden gelir, son kullanılandan değil
    if (!accountId && accounts.length) {
      const a = accounts.find((x) => x.id === last.accountId) || accounts[0];
      setAccountId(a.id); setCurrency(a.currency);
    }
    if (!categoryId && last.categoryId && categories.find((c) => c.id === last.categoryId)) setCategoryId(last.categoryId);
  }, [accounts, categories, last, accountId, categoryId, editing]);

  const onAccount = (id) => { setAccountId(id); const a = accounts.find((x) => x.id === id); if (a) setCurrency(a.currency); };

  /**
   * Hazır harcama seçimi: "nereye" ve kategoriyi birlikte doldurur.
   * Tekrar dokunmak seçimi kaldırır ve doldurduğu alanları temizler —
   * yanlış dokunan, iki alanı elle silmek zorunda kalmasın.
   * Kategori eşleşmezse boş bırakılır (bkz. lib/expenseCatalog.js).
   */
  // Seçili hazır KATEGORİ. Kullanıcının isteği: "harcama tek başlık, alt
  // sekmeler kategoriler olacak; market alışverişi de benzin de hepsi
  // harcamanın içinde olmalı." Önceki hâlde 24 hazır seçim tek sırada yan
  // yanaydı ve market zincirlerinin adları en üstte duruyordu — oysa onlar
  // yalnızca birer örnekti, başlık değil.
  const [hizliKat, setHizliKat] = useState('');

  const pickQuick = (pr) => {
    if (quick === pr.key) { setQuick(''); setMerchant(''); setCategoryId(''); return; }
    setQuick(pr.key);
    setMerchant(presetName(pr, locale));
    setCategoryId(presetCategoryId(pr, categories));
  };
  const cats = categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));
  const parents = cats.filter((c) => !c.parent_id);
  const childrenOf = (pid) => cats.filter((c) => c.parent_id === pid);

  /** Kategoriye dokununca kategori dolar; ikinci dokunuş seçimi kaldırır. */
  const pickKat = (c) => {
    if (hizliKat === c.id) { setHizliKat(''); setCategoryId(''); setQuick(''); setMerchant(''); return; }
    setHizliKat(c.id); setCategoryId(c.id); setQuick(''); setMerchant('');
  };

  // Seçili kategorinin (ve alt kategorilerinin) hazır yerleri. Market'e
  // dokunmadan Lider/Jumbo görünmüyor; ekran sade kalıyor.
  const altIdleri = hizliKat ? childrenOf(hizliKat).map((x) => x.id) : [];
  const hazirAdlar = hizliKat
    ? EXPENSE_PRESETS.filter((pr) => {
        const id = presetCategoryId(pr, categories);
        return id === hizliKat || altIdleri.includes(id);
      })
    : [];

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    const minor = parseAmount(amount, currency);
    if (!minor) { setErr(t('money.errAmount')); return; }
    if (kind === 'transfer' && !toAccountId) { setErr(t('money.errToAccount')); return; }
    setBusy(true);
    try {
      const row = {
        kind, amount: minorToDecimal(minor, currency), currency, account_id: accountId,
        transfer_account_id: kind === 'transfer' ? toAccountId : null,
        category_id: kind === 'transfer' ? null : categoryId || null, merchant: merchant || null,
        for_member_id: forMember || null, occurred_on: date,
      };
      if (editing) {
        await repo.transactions.update(txn.id, row);
        bump(); onDone?.(`${merchant || t('money.' + kind)} · ${amount} ${currency}`);
      } else {
        if (checkoutListId) {
          // Alışverişi harcamaya çevirme: harcama ve işaretlilerin temizlenmesi
          // tek işlemde olmalı, yoksa ikincisi patlayınca aynı alışveriş
          // yeniden çevrilebiliyor (0016).
          await repo.shopping.checkout(checkoutListId, row);
        } else {
          await repo.transactions.create({ ...row, paid_by_member_id: me?.id, plan_id: planId || null });
        }
        remember({ accountId, categoryId });
        bump(); onDone?.(`${merchant || t('money.' + kind)} · ${amount} ${currency}`);
        setAmount(''); setMerchant('');
      }
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setErr('');
    try { await repo.transactions.remove(txn.id); bump(); onDone?.(null); }
    catch (ex) { setErr(ex.message); setConfirming(false); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <div className="seg" style={{ display: 'flex', marginBottom: 'var(--sp-3)' }}>
        {['expense', 'income', 'transfer'].map((k) => (
          <button type="button" key={k} className={'seg__btn' + (kind === k ? ' seg__btn--active' : '')} style={{ flex: 1 }} onClick={() => setKind(k)}>{t('money.' + k)}</button>
        ))}
      </div>
      <input className="input input--amount" inputMode="decimal" placeholder="0" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={t('money.amount')} />
      <div className="chips" style={{ margin: 'var(--sp-2) 0 var(--sp-4)', justifyContent: 'center' }}>
        {CURRENCY_CODES.map((c) => (
          <button type="button" key={c} className={'chip' + (currency === c ? ' chip--active' : '')} onClick={() => setCurrency(c)} title={t('currencies.' + c)}>{CURRENCIES[c].flag} {c}</button>
        ))}
      </div>
      {/* Hazır harcamalar. Tutarı yazdıktan sonra tek dokunuş: "nereye" ve
          kategori birlikte dolar. Yalnızca giderde anlamlı. */}
      {kind === 'expense' && (
        <div style={{ margin: '0 0 var(--sp-4)' }}>
          <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('money.quickPick')}</div>
          <div className="chips">
            {parents.map((c) => (
              <button type="button" key={c.id}
                className={'chip' + (hizliKat === c.id ? ' chip--active' : '')}
                onClick={() => pickKat(c)}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
          {hazirAdlar.length > 0 && (
            <div className="chips" style={{ marginTop: 'var(--sp-2)' }}>
              {hazirAdlar.map((pr) => (
                <button type="button" key={pr.key}
                  className={'chip' + (quick === pr.key ? ' chip--active' : '')}
                  onClick={() => pickQuick(pr)}>
                  {pr.emoji} {presetName(pr, locale)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid-2">
        <Field label={kind === 'transfer' ? t('money.fromAccount') : t('money.account')}>
          <select className="select" value={accountId} onChange={(e) => onAccount(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name} ({a.currency})</option>)}
          </select>
        </Field>
        {kind === 'transfer' ? (
          <Field label={t('money.toAccount')}>
            <select className="select" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
          </Field>
        ) : (
          <Field label={t('money.category')}>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {parents.map((p) => {
                const kids = childrenOf(p.id);
                return kids.length ? (
                  <optgroup key={p.id} label={`${p.icon} ${p.name}`}>
                    <option value={p.id}>{p.icon} {p.name}</option>
                    {kids.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </optgroup>
                ) : <option key={p.id} value={p.id}>{p.icon} {p.name}</option>;
              })}
            </select>
          </Field>
        )}
      </div>
      <Field label={t('money.merchant')}>
        <input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={t('money.merchantHint')} />
      </Field>
      <div className="grid-2">
        <Field label={t('money.forWhom')}>
          <select className="select" value={forMember} onChange={(e) => setForMember(e.target.value)}>
            <option value="">{t('common.shared')}</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.avatar_emoji} {m.display_name}</option>)}
          </select>
        </Field>
        <Field label={t('money.date')}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
      <button className="btn btn--block" disabled={busy}>{t('common.save')}</button>
      {editing && (
        <>
          <div className="spacer" />
          {confirming ? (
            <>
              <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>
                {t('common.confirmDelete', merchant || t('money.' + kind))}
              </div>
              <div className="grid-2">
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
                <button type="button" className="btn btn--danger" disabled={busy} onClick={remove}>{t('common.yesDelete')}</button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--danger btn--block" disabled={busy} onClick={() => setConfirming(true)}>
              {t('money.deleteTxn')}
            </button>
          )}
        </>
      )}
    </form>
  );
}

/** Tekrar seçenekleri; karşılıkları lib/dates.js'te (buildRRule / freqKeyOf). */
const REPEAT_KEYS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const hhmm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/**
 * Olay formu. `event` verilirse düzenleme kipi: alanlar dolu gelir ve
 * kaydet mevcut olayı günceller.
 */
export function EventForm({ onDone, planId, date0, event }) {
  const { repo, members, bump } = useApp();
  const t = useT();
  const editing = Boolean(event);
  const [title, setTitle] = useState(event?.title || '');
  const [date, setDate] = useState(event?.date || date0 || today());
  const [start, setStart] = useState(event && !event.all_day ? hhmm(event.starts_at) : '10:00');
  const [end, setEnd] = useState(event && !event.all_day ? hhmm(event.ends_at) : '11:00');
  const [allDay, setAllDay] = useState(event?.all_day || false);
  const [category, setCategory] = useState(event?.category || 'other');
  const [repeat, setRepeat] = useState(freqKeyOf(event?.rrule));
  const [att, setAtt] = useState(event?.attendees || []);
  const [location, setLocation] = useState(event?.location || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toggle = (id) => setAtt((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const submit = async (e) => {
    e.preventDefault(); if (!title.trim()) return; setBusy(true); setErr('');
    try {
      const s = new Date(`${date}T${allDay ? '00:00' : start}:00`).toISOString();
      const en = new Date(`${date}T${allDay ? '23:59' : end}:00`).toISOString();
      const row = { title: title.trim(), starts_at: s, ends_at: en, all_day: allDay, category, rrule: buildRRule(repeat, date), location: location || null };
      if (editing) {
        await repo.events.update(event.id, row);
        bump(); onDone?.(title);
      } else {
        await repo.events.create({ ...row, attendees: att, plan_id: planId || null });
        bump(); onDone?.(title); setTitle('');
      }
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <Field label={t('calendar.titleField')}><input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="grid-2">
        <Field label={t('money.date')}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t('calendar.category')}>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(t('calendar.categories')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <label className="inline" style={{ marginBottom: 'var(--sp-3)' }}><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> {t('calendar.allDay')}</label>
      {!allDay && (
        <div className="grid-2">
          <Field label={t('calendar.start')}><input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={t('calendar.end')}><input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
      )}
      {!editing && (
        <Field label={t('calendar.attendees')}>
          <div className="chips">
            {members.map((m) => (
              <button type="button" key={m.id} className={'chip' + (att.includes(m.id) ? ' chip--active' : '')} onClick={() => toggle(m.id)}>{m.avatar_emoji} {m.display_name}</button>
            ))}
          </div>
        </Field>
      )}
      <div className="grid-2">
        <Field label={t('calendar.repeat')}>
          <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            {REPEAT_KEYS.map((k) => <option key={k} value={k}>{t('calendar.repeats.' + k)}</option>)}
          </select>
        </Field>
        <Field label={t('calendar.location')}><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      </div>
      {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
      <button className="btn btn--block" disabled={busy}>{t('common.save')}</button>
    </form>
  );
}

/**
 * Görev formu. Tekrar seçeneği vadeye çapalanır: "her ay" seçilip vade ayın
 * 31'i ise kural BYMONTHDAY=31 olur ve seri şubattan sonra 31'e geri döner
 * (bkz. lib/dates.js buildRRule). Tekrar seçildiğinde vade zorunludur —
 * vadesiz bir tekrar kuralının tutunacağı gün yok.
 */
export function TaskForm({ onDone, planId }) {
  const { repo, members, bump } = useApp();
  const t = useT();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState(today());
  const [points, setPoints] = useState(0);
  const [repeat, setRepeat] = useState('none');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); if (!title.trim()) return;
    if (repeat !== 'none' && !due) { setErr(t('tasks.repeatNeedsDue')); return; }
    setErr('');
    await repo.tasks.create({ title: title.trim(), assignee_member_id: assignee || null, due_on: due || null,
      points: Number(points) || 0, rrule: buildRRule(repeat, due), plan_id: planId || null });
    bump(); onDone?.(title); setTitle(''); setRepeat('none');
  };
  return (
    <form onSubmit={submit}>
      <Field label={t('quick.taskTitle')}><input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="grid-3">
        <Field label={t('family.assign')}>
          <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">—</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.avatar_emoji} {m.display_name}</option>)}
          </select>
        </Field>
        <Field label={t('family.due')}><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label={t('family.points')}><input className="input" type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} /></Field>
      </div>
      <Field label={t('calendar.repeat')}>
        <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
          {REPEAT_KEYS.map((k) => <option key={k} value={k}>{t('calendar.repeats.' + k)}</option>)}
        </select>
      </Field>
      {repeat !== 'none' && due && <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('tasks.repeatHint')}</div>}
      {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
      <button className="btn btn--block">{t('common.save')}</button>
    </form>
  );
}

export function ShoppingForm({ onDone, listId, autoFocus = false }) {
  const { repo, bump } = useApp();
  const t = useT();
  const [name, setName] = useState('');
  const submit = async (e) => {
    e.preventDefault(); if (!name.trim()) return;
    await repo.shopping.addItem({ name: name.trim(), ...(listId ? { list_id: listId } : {}) });
    bump(); onDone?.(name); setName('');
  };
  return (
    <form onSubmit={submit} className="inline" style={{ flexWrap: 'nowrap' }}>
      <input className="input" autoFocus={autoFocus} placeholder={t('quick.shoppingItem')} value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn">{t('common.add')}</button>
    </form>
  );
}

/**
 * Hızlı ekle > Alışveriş: EMOJİ IZGARASI ÖNCE, yazı kutusu altta.
 *
 * NEDEN DEĞİŞTİ: ızgara yalnızca Aile > Alışveriş ekranında, bir düğmenin
 * arkasındaydı. Kullanıcı onu bir kez buldu, sonra en çok kullanılan yere —
 * alttaki "+" düğmesine — bastığında karşısında yine yazı kutusu çıktı ve
 * özelliğin kaybolduğunu sandı. İsteğin kendisi zaten "yazma işi olmasın"dı;
 * en sık kullanılan girişte yazı kutusu bırakmak o isteği boşa çıkarıyordu.
 *
 * Yazı kutusu SİLİNMEDİ, altta duruyor: katalogda olmayan bir şey (bir marka,
 * bir ilaç adı) yazmanın yolu kapanmamalı.
 *
 * Klavye artık kendiliğinden açılmıyor: açılsaydı ızgarayı örterdi.
 */
export function ShoppingQuickPick({ onDone }) {
  const { repo, tick } = useApp();
  const [listId, setListId] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const lists = await repo.shopping.lists();
        const l = (lists || [])[0];
        const its = await repo.shopping.items(l?.id);
        if (!iptal) { setListId(l?.id || null); setItems(its || []); }
      } catch { /* liste okunamazsa ızgara yine çalışır; eklemede liste DB'de çözülüyor */ }
    })();
    return () => { iptal = true; };
  }, [repo, tick]);

  return (
    <>
      <ShoppingPicker listId={listId} items={items} />
      <div className="spacer" />
      <ShoppingForm onDone={onDone} listId={listId} />
    </>
  );
}
