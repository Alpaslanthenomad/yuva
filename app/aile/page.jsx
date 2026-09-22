'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Row, Chips, Empty, Sheet, Field, Avatar } from '../../components/ui.jsx';
import { TaskForm, ShoppingForm, ExpenseForm } from '../../components/QuickAdd.jsx';
import { useT } from '../../lib/i18n/context.jsx';
import { today, fmtDay, relativeLabel, weekDays, startOfWeek, nextOccurrence } from '../../lib/dates.js';

const TABS = ['members', 'occasions', 'documents', 'tasks', 'shopping'];

/**
 * Alışverişi harcamaya çevirirken kategoriyi tahmin et.
 * Kategori adları haneye göre TR veya ES tohumlandığı için isimden bakılır;
 * bulunamazsa boş döner ve kullanıcı kendi seçer.
 */
function guessGroceryCategory(categories) {
  const re = /market|süpermarket|supermercado|gıda|alimento/i;
  return categories.find((c) => c.kind === 'expense' && re.test(c.name))?.id || '';
}
const DOC_ICON = { passport: '🛂', id: '🪪', license: '🚗', visa: '🛃', insurance: '🛡️', contract: '📄', vehicle: '🔧', other: '📎' };

export default function FamilyPage() {
  const { repo, members, household, memberById, tick, bump, me, categories } = useApp();
  const t = useT();
  const [tab, setTab] = useState('members');
  const [d, setD] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [editing, setEditing] = useState(null);   // düzenlenen üye; null ise yeni kayıt
  const [toExpense, setToExpense] = useState(null);   // harcamaya çevrilecek alışveriş kalemleri

  useEffect(() => { try { const x = new URLSearchParams(window.location.search).get('tab'); if (x && TABS.includes(x)) setTab(x); } catch { /* */ } }, []);
  useEffect(() => {
    if (!household) return;
    Promise.all([repo.occasions.list(), repo.documents.list(), repo.tasks.list(), repo.shopping.lists(), repo.shopping.items(),
      repo.tasks.completions(startOfWeek(today()))])
      .then(([occasions, documents, tasks, lists, items, completions]) => setD({ occasions, documents, tasks, lists, items, completions }));
  }, [repo, household, tick]);

  if (!d) return <Empty>{t('common.loading')}</Empty>;
  const T = today();
  const wk = weekDays(T);

  return (
    <>
      <div className="page-head"><h1 className="h1">{t('family.title')}</h1><span className="faint">{household.name}</span></div>
      <Chips value={tab} onChange={setTab} options={TABS.map((k) => ({ value: k, label: t('family.' + k) }))} />
      <div className="spacer" />

      {tab === 'members' && (
        <>
          <Card>
            {members.map((m) => {
              // Puan tamamlama kaydından okunur: tekrarlayan görevde satır "bitti"
              // kalmadığı için is_done/done_at üstünden saymak sıfır gösterirdi (0010).
              const pts = (d.completions || []).filter((c) => c.member_id === m.id && c.done_on >= wk[0]).reduce((s, c) => s + (c.points || 0), 0);
              return (
                <Row key={m.id} icon={<Avatar member={m} />} title={m.display_name} sub={`${t('family.roles.' + m.role)}${m.birthdate ? ' · ' + fmtDay(m.birthdate) + ' ' + m.birthdate.slice(0, 4) : ''}`}
                  onClick={() => { setEditing(m); setSheet('member'); }}
                  end={m.role === 'child'
                    ? <span className="tag tag--ok">⭐ {pts} {t('family.weeklyStars')}</span>
                    : <span className="faint" aria-hidden>›</span>} />
              );
            })}
          </Card>
          <button className="btn btn--outline btn--block" onClick={() => { setEditing(null); setSheet('member'); }}>+ {t('family.addMember')}</button>
          <div className="spacer" />
          {household.join_code && <div className="faint">{t('settings.joinCode')}: <span className="mono">{household.join_code}</span> — {t('family.childrenNoAccount')}</div>}
        </>
      )}

      {tab === 'occasions' && (
        <>
          <Card>
            {d.occasions.map((o) => (
              <Row key={o.id} icon={o.kind === 'birthday' ? '🎂' : o.kind === 'anniversary' ? '💍' : o.kind === 'memorial' ? '🕯️' : '📌'} title={o.title}
                sub={`${fmtDay(o.date)} · ${relativeLabel(o.date)}${o.year && o.kind === 'birthday' ? ' · ' + t('family.turns', Number(o.date.slice(0, 4)) - o.year) : ''}${o.gift_ideas ? ' · 🎁 ' + o.gift_ideas : ''}`}
                end={<span className={'tag' + (o.daysLeft <= o.remind_days ? ' tag--warn' : '')}>{t('family.daysShort', o.daysLeft)}</span>} />
            ))}
            {d.occasions.length === 0 && <Empty>{t('common.empty')}</Empty>}
          </Card>
          <button className="btn btn--outline btn--block" onClick={() => setSheet('occasion')}>+ {t('family.addOccasion')}</button>
        </>
      )}

      {tab === 'documents' && (
        <>
          <Card>
            {d.documents.map((x) => (
              <Row key={x.id} icon={DOC_ICON[x.kind]} title={x.title}
                sub={`${t('family.docKinds.' + x.kind)}${x.member_id ? ' · ' + memberById(x.member_id)?.display_name : ''}${x.number_hint ? ' · ' + x.number_hint : ''}`}
                end={x.expires_on ? <span className={'tag ' + (x.daysLeft < 0 ? 'tag--danger' : x.daysLeft <= x.remind_days ? 'tag--warn' : '')}>{x.daysLeft < 0 ? t('family.expired') : fmtDay(x.expires_on) + ' ' + x.expires_on.slice(0, 4)}</span> : null} />
            ))}
            {d.documents.length === 0 && <Empty>{t('common.empty')}</Empty>}
          </Card>
          <button className="btn btn--outline btn--block" onClick={() => setSheet('document')}>+ {t('family.addDocument')}</button>
        </>
      )}

      {tab === 'tasks' && (
        <>
          <Card>
            {d.tasks.map((k) => <TaskRow key={k.id} task={k} t={t} repo={repo} bump={bump} members={members} memberById={memberById} />)}
            {d.tasks.length === 0 && <Empty>{t('common.empty')}</Empty>}
          </Card>
          <Card title={t('family.addTask')}><TaskForm /></Card>
        </>
      )}

      {tab === 'shopping' && d.lists.length === 0 && (
        <Card><Empty>{t('family.noList')}</Empty></Card>
      )}
      {tab === 'shopping' && d.lists.map((l) => {
        const items = d.items.filter((i) => i.list_id === l.id);
        const checked = items.filter((i) => i.is_checked);
        return (
          <Card key={l.id} title={`${l.icon} ${l.name}`} action={checked.length > 0 && <button className="btn btn--ghost btn--sm" onClick={async () => { await repo.shopping.clearChecked(l.id); bump(); }}>{t('family.clearChecked')}</button>}>
            {items.map((i) => (
              <Row key={i.id} icon={<input type="checkbox" checked={i.is_checked} onChange={async () => { await repo.shopping.toggleItem(i.id); bump(); }} style={{ width: 22, height: 22 }} />} title={i.name} done={i.is_checked} sub={memberById(i.added_by_member_id)?.display_name} />
            ))}
            <div className="spacer" />
            <ShoppingForm listId={l.id} />
            {checked.length > 0 && (
              <>
                <div className="spacer" />
                <button className="btn btn--outline btn--block" onClick={() => setToExpense({ list: l, items: checked })}>
                  🧾 {t('family.toExpense', checked.length)}
                </button>
              </>
            )}
          </Card>
        );
      })}

      {sheet === 'member' && (
        <Sheet onClose={() => { setSheet(null); setEditing(null); }} title={editing ? t('family.editMember') : t('family.addMember')}>
          <MemberForm t={t} member={editing} isSelf={Boolean(editing && me && editing.id === me.id)}
                      onDone={() => { setSheet(null); setEditing(null); }} />
        </Sheet>
      )}
      {toExpense && (
        <Sheet onClose={() => setToExpense(null)} title={t('family.toExpense', toExpense.items.length)}>
          <div className="faint" style={{ marginBottom: 'var(--sp-3)' }}>
            {toExpense.items.map((i) => i.name).join(', ')}
          </div>
          <ExpenseForm
            preset={{ merchant: toExpense.list.name, categoryId: guessGroceryCategory(categories) }}
            onDone={async () => {
              // Harcama kaydedildi; işaretli kalemler listeden temizlenir.
              await repo.shopping.clearChecked(toExpense.list.id);
              setToExpense(null); bump();
            }} />
        </Sheet>
      )}
      {sheet === 'occasion' && <Sheet onClose={() => setSheet(null)} title={t('family.addOccasion')}><OccasionForm t={t} onDone={() => setSheet(null)} /></Sheet>}
      {sheet === 'document' && <Sheet onClose={() => setSheet(null)} title={t('family.addDocument')}><DocumentForm t={t} onDone={() => setSheet(null)} /></Sheet>}
    </>
  );
}

/**
 * Üye ekleme ve düzenleme aynı form.
 * `member` verilirse düzenleme kipi: kaydet günceller, ayrıca "Haneden çıkar" çıkar.
 * Çıkarma kalıcı silme değil (`is_active: false`) — eski harcama ve olaylar korunur.
 */
function MemberForm({ t, member, isSelf, onDone }) {
  const { repo, reload } = useApp();
  const [f, setF] = useState(member
    ? { display_name: member.display_name || '', role: member.role || 'adult', birthdate: member.birthdate || '', avatar_emoji: member.avatar_emoji || '🙂', color: member.color || '#4F7CAC' }
    : { display_name: '', role: 'child', birthdate: '', avatar_emoji: '🧒', color: '#E9A23B' });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);   // iki adımlı çıkarma
  const [err, setErr] = useState('');
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.display_name.trim() || busy) return;
    setBusy(true);
    try {
      const patch = { ...f, display_name: f.display_name.trim(), birthdate: f.birthdate || null };
      if (member) await repo.members.update(member.id, patch);
      else await repo.members.create(patch);
      await reload();
      onDone();
    } finally { setBusy(false); }
  };

  // Tarayıcının confirm() kutusu yerine kart içinde iki adım: telefonda
  // sistem uyarısı kaba duruyor ve iOS'ta sayfayı dondurabiliyor.
  const remove = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try { await repo.members.update(member.id, { is_active: false }); await reload(); onDone(); }
    catch (ex) { setErr(ex?.message || t('auth.errGeneric')); setConfirming(false); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <Field label={t('family.memberName')}><input className="input" autoFocus value={f.display_name} onChange={up('display_name')} /></Field>
      <div className="grid-3">
        <Field label={t('family.role')}><select className="select" value={f.role} onChange={up('role')}>{['adult', 'child'].map((r) => <option key={r} value={r}>{t('family.roles.' + r)}</option>)}</select></Field>
        <Field label={t('family.emoji')}><input className="input" value={f.avatar_emoji} onChange={up('avatar_emoji')} /></Field>
        <Field label={t('family.color')}><input className="input" type="color" value={f.color} onChange={up('color')} /></Field>
      </div>
      <Field label={t('family.birthdate')}>
        <input className="input" type="date" value={f.birthdate} onChange={up('birthdate')} />
        <span className="faint">{t('family.birthdateHint')}</span>
      </Field>
      <button className="btn btn--block" disabled={busy}>{t('common.save')}</button>
      {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
      {member && (
        <>
          <div className="spacer" />
          {isSelf ? (
            <div className="faint">{t('family.cannotRemoveSelf')}</div>
          ) : confirming ? (
            <>
              <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>
                {t('family.removeMemberConfirm', member.display_name)}
              </div>
              <div className="grid-2">
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirming(false)}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="btn btn--danger" disabled={busy} onClick={remove}>
                  {busy ? t('common.loading') : t('family.removeConfirmYes')}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--danger btn--block" disabled={busy} onClick={() => setConfirming(true)}>
              {t('family.removeMember')}
            </button>
          )}
        </>
      )}
    </form>
  );
}

function OccasionForm({ t, onDone }) {
  const { repo, bump, members } = useApp();
  const [f, setF] = useState({ title: '', kind: 'custom', date: '', member_id: '', gift_ideas: '', remind_days: 7 });
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); if (!f.title.trim() || !f.date) return;
    const [y, m, dd] = f.date.split('-').map(Number);
    await repo.occasions.create({ title: f.title.trim(), kind: f.kind, month: m, day: dd, year: y > 1900 ? y : null, member_id: f.member_id || null, gift_ideas: f.gift_ideas || null, remind_days: Number(f.remind_days) });
    bump(); onDone();
  };
  return (
    <form onSubmit={submit}>
      <Field label={t('calendar.titleField')}><input className="input" autoFocus value={f.title} onChange={up('title')} /></Field>
      <div className="grid-2">
        <Field label={t('family.occasionKind')}><select className="select" value={f.kind} onChange={up('kind')}>{['birthday', 'anniversary', 'memorial', 'custom'].map((k) => <option key={k} value={k}>{t('family.kinds.' + k)}</option>)}</select></Field>
        <Field label={t('family.firstYear')}><input className="input" type="date" value={f.date} onChange={up('date')} /></Field>
      </div>
      <div className="grid-2">
        <Field label={t('family.member')}><select className="select" value={f.member_id} onChange={up('member_id')}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></Field>
        <Field label={t('family.remindDays')}><input className="input" type="number" value={f.remind_days} onChange={up('remind_days')} /></Field>
      </div>
      <Field label={`🎁 ${t('family.giftIdeas')}`}><input className="input" value={f.gift_ideas} onChange={up('gift_ideas')} /></Field>
      <button className="btn btn--block">{t('common.save')}</button>
    </form>
  );
}

function DocumentForm({ t, onDone }) {
  const { repo, bump, members } = useApp();
  const [f, setF] = useState({ title: '', kind: 'passport', member_id: '', expires_on: '', remind_days: 90, number_hint: '' });
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); if (!f.title.trim()) return; await repo.documents.create({ ...f, member_id: f.member_id || null, expires_on: f.expires_on || null, remind_days: Number(f.remind_days) }); bump(); onDone(); };
  return (
    <form onSubmit={submit}>
      <Field label={t('calendar.titleField')}><input className="input" autoFocus value={f.title} onChange={up('title')} /></Field>
      <div className="grid-2">
        <Field label={t('family.occasionKind')}><select className="select" value={f.kind} onChange={up('kind')}>{Object.entries(t('family.docKinds')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label={t('family.member')}><select className="select" value={f.member_id} onChange={up('member_id')}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></Field>
      </div>
      <div className="grid-2">
        <Field label={t('family.expires')}><input className="input" type="date" value={f.expires_on} onChange={up('expires_on')} /></Field>
        <Field label={t('family.remindDays')}><input className="input" type="number" value={f.remind_days} onChange={up('remind_days')} /></Field>
      </div>
      <Field label={t('family.numberHint')}><input className="input" maxLength={8} value={f.number_hint} onChange={up('number_hint')} placeholder="…4471" /></Field>
      <button className="btn btn--block">{t('common.save')}</button>
    </form>
  );
}

/**
 * Görev satırı. Tekrarlayan görevde onay kutusu görevi "bitti" yapmaz; vadeyi
 * bir sonraki tekrara taşır (0010). Ertele/atla/sorumlu değiştir eylemleri
 * yalnızca satıra dokununca açılır — liste kalabalıklaşmasın.
 */
function TaskRow({ task: k, t, repo, bump, members, memberById }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = k.rrule && k.due_on ? nextOccurrence(k.rrule, k.due_on) : null;

  const run = async (fn) => { setBusy(true); try { await fn(); bump(); } finally { setBusy(false); } };

  return (
    <>
      <Row
        icon={<input type="checkbox" checked={k.is_done} disabled={busy}
          onChange={() => run(() => (k.is_done ? repo.tasks.uncomplete(k.id) : repo.tasks.complete(k.id, next)))}
          style={{ width: 22, height: 22 }} />}
        title={k.title} done={k.is_done}
        sub={[memberById(k.assignee_member_id)?.display_name, k.due_on && relativeLabel(k.due_on),
          k.rrule && '↻', k.plan_id && '🧭'].filter(Boolean).join(' · ')}
        onClick={() => setOpen((x) => !x)}
        end={k.points ? <span className="tag tag--ok">⭐ {k.points}</span> : null} />
      {open && (
        <div style={{ padding: '0 var(--sp-3) var(--sp-3)' }}>
          {next && <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('tasks.nextOn', relativeLabel(next))}</div>}
          <div className="chips" style={{ marginBottom: 'var(--sp-2)' }}>
            <button type="button" className="chip" disabled={busy} onClick={() => run(() => repo.tasks.postpone(k.id, 1))}>{t('tasks.postponeDay')}</button>
            <button type="button" className="chip" disabled={busy} onClick={() => run(() => repo.tasks.postpone(k.id, 7))}>{t('tasks.postponeWeek')}</button>
            {next && <button type="button" className="chip" disabled={busy} onClick={() => run(() => repo.tasks.skip(k.id, next))}>{t('tasks.skip')}</button>}
          </div>
          <Field label={t('tasks.assignee')}>
            <select className="select" value={k.assignee_member_id || ''} disabled={busy}
              onChange={(e) => run(() => repo.tasks.update(k.id, { assignee_member_id: e.target.value || null }))}>
              <option value="">{t('tasks.unassigned')}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.avatar_emoji} {m.display_name}</option>)}
            </select>
          </Field>
        </div>
      )}
    </>
  );
}
