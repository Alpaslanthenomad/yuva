'use client';
import { useEffect, useState } from 'react';
import { useApp } from './AppShell.jsx';
import { Chips } from './ui.jsx';
import { useT, useLocale } from '../lib/i18n/context.jsx';
import { SHOPPING_GROUPS, SHOPPING_CATALOG, catalogName, normalizeName } from '../lib/shoppingCatalog.js';

const FAV = 'fav';   // sanal reyon: sık alınanlar

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
  const [group, setGroup] = useState(FAV);
  const [busy, setBusy] = useState(null);
  const [favs, setFavs] = useState([]);   // [{catalog_key, uses}] — DB'de sayılıyor (0019)
  // Sunucu yanıtı gelene kadar ekranda tutulan geçici durum.
  const [pending, setPending] = useState({});

  // Sık alınanlar elle işaretlenmiyor, ekledikçe sayılıyor (0019). İlk hafta
  // boş olur; o yüzden boşken sekme hiç çizilmiyor ve meyveyle açılıyor.
  useEffect(() => {
    let iptal = false;
    repo.shopping.favorites?.(12)
      .then((r) => { if (!iptal) setFavs(Array.isArray(r) ? r : []); })
      .catch(() => { if (!iptal) setFavs([]); });
    return () => { iptal = true; };
  }, [repo]);

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
      if (next) await repo.shopping.addItem({ name: catalogName(item, locale), list_id: listId, catalog_key: item.key });
      else if (existing) await repo.shopping.removeItem(existing.id);
      bump();
    } catch {
      setPending((p) => { const c = { ...p }; delete c[item.key]; return c; });
    } finally { setBusy(null); }
  };

  const favKeys = favs.map((f) => f.catalog_key);
  const favRows = favKeys
    .map((k) => SHOPPING_CATALOG.find((x) => x.key === k))
    .filter(Boolean);
  // Sanal sekmenin adı i18n'den; reyon adları katalogda (veri, arayüz metni değil).
  const tabs = favRows.length
    ? [{ key: FAV, emoji: '⭐', label: t('shopping.favorites') }, ...SHOPPING_GROUPS]
    : SHOPPING_GROUPS;
  const tabLabel = (x) => x.label || (es ? x.es : x.tr);
  // Favori yoksa ilk sekme meyve olsun; boş ızgara açılışı kötü karşılama.
  const activeTab = tabs.some((x) => x.key === group) ? group : tabs[0].key;
  const rows = activeTab === FAV ? favRows : SHOPPING_CATALOG.filter((x) => x.group === activeTab);
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

      <Chips value={activeTab} onChange={setGroup}
        options={tabs.map((x) => ({ value: x.key, label: `${x.emoji} ${tabLabel(x)}` }))} />

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
