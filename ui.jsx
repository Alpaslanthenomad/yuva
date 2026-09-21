'use client';
// components/ui.jsx — küçük, durumsuz yapı taşları
import { formatMoney } from '../lib/money.js';

export function Sheet({ onClose, children, title }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__handle" />
        {title && <div className="between" style={{ marginBottom: 'var(--sp-3)' }}><h2 className="h2">{title}</h2><button className="btn btn--ghost btn--sm" onClick={onClose}>✕</button></div>}
        {children}
      </div>
    </>
  );
}

export function Avatar({ member, size }) {
  if (!member) return <span className={'avatar' + (size === 'sm' ? ' avatar--sm' : '')} style={{ background: 'var(--color-text-3)' }}>?</span>;
  return (
    <span className={'avatar' + (size === 'sm' ? ' avatar--sm' : '')} style={{ background: member.color }} title={member.display_name}>
      {member.avatar_emoji || member.display_name[0]}
    </span>
  );
}

export function Avatars({ members, size = 'sm' }) {
  return <span className="avatars">{members.map((m) => <Avatar key={m.id} member={m} size={size} />)}</span>;
}

export function Money({ amount, currency, kind, compact, sign }) {
  const cls = 'money' + (kind ? ` money--${kind}` : '');
  const v = kind === 'expense' ? -Math.abs(amount) : kind === 'income' ? Math.abs(amount) : amount;
  return <span className={cls}>{formatMoney(v, currency, { compact, sign: sign ?? Boolean(kind) })}</span>;
}

export function Bar({ pct, state }) {
  const cls = 'bar__fill' + (state === 'over' ? ' bar__fill--over' : state === 'warn' ? ' bar__fill--warn' : '');
  return <div className="bar"><div className={cls} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>;
}

export function Chips({ value, onChange, options }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.value} className={'chip' + (o.value === value ? ' chip--active' : '')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={'seg__btn' + (o.value === value ? ' seg__btn--active' : '')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Row({ icon, iconStyle, title, sub, end, onClick, done, wrap, children }) {
  return (
    <div className={'row' + (done ? ' row--done' : '')} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {icon !== undefined && <div className="row__icon" style={iconStyle}>{icon}</div>}
      <div className="row__body">
        <div className={'row__title' + (wrap ? ' row__title--wrap' : '')}>{title}</div>
        {sub && <div className={'row__sub' + (wrap ? ' row__sub--wrap' : '')}>{sub}</div>}
        {children}
      </div>
      {end !== undefined && <div className="row__end">{end}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', style }) {
  return (
    <section className={'card ' + className} style={style}>
      {(title || action) && <div className="card__head"><div className="card__title">{title}</div>{action}</div>}
      {children}
    </section>
  );
}

export function Empty({ children }) { return <div className="empty">{children}</div>; }

export function Field({ label, children }) {
  return <label className="field"><span className="field__label">{label}</span>{children}</label>;
}
