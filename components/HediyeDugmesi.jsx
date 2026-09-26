'use client';
// components/HediyeDugmesi.jsx — önemli gün satırında hediye planı kısayolu (0032).
// Plan varsa "✓ 🎁" (plana gider), yoksa "🎁 Hediye planı" (hazır doldurulmuş
// plan açar). Kişinin kendi doğum günü için gösterilmez.
import { hediyeUygun, hediyeLinki, hediyePlani } from '../lib/planCatalog.js';

export default function HediyeDugmesi({ o, plans, me, t }) {
  if (!hediyeUygun(o)) return o.gift_ideas ? <span className="tag">🎁</span> : null;
  if (me && o.member_id && o.member_id === me.id) return null;
  const plan = hediyePlani(plans, o);
  if (plan) {
    return <a className="tag tag--ok" href="/planlar/" onClick={(e) => e.stopPropagation()}>✓ 🎁</a>;
  }
  return (
    <a className="btn btn--outline btn--sm" href={hediyeLinki(o)} onClick={(e) => e.stopPropagation()}>
      🎁 {t('plans.giftPlan')}
    </a>
  );
}
