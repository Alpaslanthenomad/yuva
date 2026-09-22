'use client';
import { useState } from 'react';
import { useApp } from './AppShell.jsx';
import { Chips } from './ui.jsx';
import { useT, useLocale } from '../lib/i18n/context.jsx';
import { SHOPPING_GROUPS, SHOPPING_CATALOG, catalogName, normalizeName } from '../lib/shoppingCatalog.js';

/**
 * Yazmadan sepet: reyon seç, ürüne dokun, listeye düşsün.
 *
 * TASARIM KARARLARI
 * - Dokunma AÇMA/KAPAMA. Listede olan ürün işaretli görünür; tekrar dokunmak
 *   onu listeden çıkarır. Ayrı bir "çıkar" yolu olsaydı yanlış dokunmanın
 *   geri dönüşü zor olurdu.
 * - Markette İŞARETLENMİŞ kalem buradan silinmez. Sepete attığın bir şeyi
 *   yanlışlıkla düşürmek, markette unutmak demek. O dokunma yok sayılır;
 *   listedeki onay kutusu zaten doğru yer.
 * - İyimser çizim: sunucu yanıtı beklenmeden ürün işaretli görünür. Ağ
 *   yavaşken art arda dokunup aynı şeyi iki kez eklemenin önüne geçer.
 *   Çağrı patlarsa işaret geri alınır.
 * - Reyonlar tek tek gösteriliyor, hepsi alt alta değil: 85 ürünü telefonda
 *   kaydırarak gezmek yazmaktan yavaş olurdu.
 */
export default function ShoppingPicker({ listId, items = [] }) {
  const { repo, bump } = useApp();
  const t = useT();
  const { locale } = useLocale();
  const es = String(locale || '').startsWith('es');
  const [group, setGroup] = useState(SHOPPING_GROUPS[0].key);
  const [busy, setBusy] = useState(null);
  // Sunucu yanıtı gelene kadar ekranda tutulan geçici durum.
  const [pending, setPending] = useState({});

  // Listedeki adlar → hangi katalog ürünü işaretli görünecek.
  const onList = new Map(items.map((i) => [normalizeName(i.name), i]));
  const rowOf = (item) => onList.get(normalizeName(catalogName(item, locale)))
                       || onList.get(normalizeName(item.tr))
                       || onList.get(normalizeName(item.es));

  const isPicked = (item) => {
    const p = pending[item.key];
    return p !== undefined ? p : Boolean(rowOf(item));
  };

  const toggle = async (item) => {
    if (busy) return;
    const existing = rowOf(item);
    if (existing?.is_checked) return;   // markette işaretlenmişi düşürme

    const next = !isPicked(item);
    setPending((p) => ({ ...p, [item.key]: next }));
    setBusy(item.key);
    try {
      if (next) await repo.shopping.addItem({ name: catalogName(item, locale), list_id: listId });
      else if (existing) await repo.shopping.removeItem(existing.id);
      bump();
    } catch {
      setPending((p) => { const c = { ...p }; delete c[item.key]; return c; });
    } finally { setBusy(null); }
  };

  const rows = SHOPPING_CATALOG.filter((x) => x.group === group);
  const pickedCount = SHOPPING_CATALOG.filter(isPicked).length;

  return (
    <div>
      {/* İpucu ile sayaç dar ekranda yan yana sıkışıyordu; sayaç üstte,
          ipucu altında tam satır. */}
      {pickedCount > 0 && (
        <div style={{ marginBottom: 'var(--sp-2)' }}>
          <span className="tag tag--ok">{t('shopping.picked', pickedCount)}</span>
        </div>
      )}
      <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('shopping.pickHint')}</div>

      <Chips value={group} onChange={setGroup}
        options={SHOPPING_GROUPS.map((x) => ({ value: x.key, label: `${x.emoji} ${es ? x.es : x.tr}` }))} />

      <div className="picker">
        {rows.map((item) => {
          const picked = isPicked(item);
          // Markette alınmış kalem: dokunuş yok sayılıyor, bu yüzden ayrı
          // görünüyor. Aksi halde "dokundum, bir şey olmadı" hissi verirdi.
          const done = Boolean(rowOf(item)?.is_checked);
          return (
            <button key={item.key} type="button"
              className={'picker__item' + (picked ? ' picker__item--on' : '') + (done ? ' picker__item--done' : '')}
              disabled={busy === item.key || done} aria-pressed={picked}
              onClick={() => toggle(item)}>
              <span className="picker__emoji" aria-hidden="true">{item.emoji}</span>
              <span className="picker__name">{catalogName(item, locale)}</span>
              {picked && <span className="picker__tick" aria-hidden="true">{done ? '🛒' : '✓'}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
