// lib/data/demoSeed.js — Demo hane verisi (TR / ES). Gerçek Supabase'e ASLA seed edilmez (CLAUDE.md).
// Kullanıcı verisi çevrilmez; demo ilk kurulduğu dilde kalır. Sıfırlamak: Ayarlar › Veri.
import { today, addDays, addMonths, periodOf, startOfWeek } from '../dates.js';

const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9);

const L = {
  tr: {
    household: 'Bizim Ev',
    dad: 'Baba', mom: 'Anne',
    acc: { cash: 'Nakit', bank: 'Banka (CLP)', card: 'Kredi kartı', tr: 'Türkiye hesabı', usd: 'Birikim (USD)' },
    cat: {
      ev: 'Ev', kira: 'Kira', fatura: 'Faturalar', market: 'Market', gida: 'Gıda', ulasim: 'Ulaşım', yakit: 'Yakıt',
      cocuk: 'Çocuklar', okul: 'Okul', kurs: 'Kurs & Aktivite', saglik: 'Sağlık', yeme: 'Yeme-İçme',
      eglence: 'Eğlence & Sosyal', abone: 'Abonelikler', hediye: 'Hediye', seyahat: 'Seyahat', giyim: 'Giyim',
      diger: 'Diğer', maas: 'Maaş', danis: 'Danışmanlık',
    },
    tx: {
      maas: 'Maaş', danisFatura: 'Danışmanlık faturası', kira: 'Kira', elektrik: 'Enel elektrik',
      okulTaksit: 'Okul taksidi', yuzme: 'Yüzme kursu', cicek: 'Anneanneye çiçek', pizza: 'Pizza gecesi',
      kirtasiye: 'Kırtasiye', eczane: 'Eczane', ucak: 'Uçak bileti ön ödeme',
      marketAy: 'Market (ay toplamı)', restoran: 'Restoranlar', yakitAy: 'Yakıt', kislik: 'Çocuk kışlıkları',
    },
    rec: { kira: 'Kira', isapre: 'Isapre sağlık sigortası', okul: 'Okul taksidi', destek: 'Anneanne desteği', maas: 'Maaş' },
    plan: {
      izmir: 'İzmir yaz tatili', izmirDest: 'İzmir, Türkiye',
      party: "Deniz'in 10. yaş partisi", partyDest: 'Ev',
      araba: 'Araba peşinatı', mutfak: 'Mutfak yenileme',
    },
    pi: {
      ucak: 'SCL → IST uçak', cesme: 'Çeşme kiralık ev (7 gece)',
      ist: 'İstanbul — 2 gün aile ziyareti', izmir: 'İzmir — Alaçatı, Efes, Şirince',
      pasaport: 'Pasaportlar (Mira: süre kontrolü!)', sigorta: 'Seyahat sigortası',
      bavul: 'Bavul: çocuk mayoları, güneş kremi',
      g1: 'Lucas (okuldan)', g2: 'Sofía', g3: 'Matías',
      pasta: 'Pasta siparişi (çikolatalı)', balon: 'Balon + süs', davetiye: 'Davetiyeleri gönder',
      aylik: 'Her ay 500 USD aktarılıyor',
    },
    occ: {
      dad: 'Baba doğum günü', mom: 'Anne doğum günü', deniz: 'Deniz doğum günü', mira: 'Mira doğum günü',
      anniv: 'Evlilik yıldönümü', grandma: 'Anneanne doğum günü', grandmaName: 'Anneanne',
      gDeniz: 'Lego Technic, kaykay', gAnniv: 'Akşam yemeği — Boragó?', gGrandma: 'Çiçek + görüntülü arama',
    },
    doc: { miraPas: 'Pasaport — Mira', denizPas: 'Pasaport — Deniz', arac: 'Araç sigortası', kira: 'Kira sözleşmesi', ehliyet: 'Ehliyet — Baba' },
    task: { cop: 'Çöpü çıkar', oyuncak: 'Oyuncakları topla', sigorta: 'Araç sigortasını yenile', pasta: 'Pasta siparişi ver', bulasik: 'Bulaşık makinesini boşalt' },
    list: { market: 'Market', eczane: 'Eczane' },
    item: { sut: 'Süt (2 L)', yumurta: 'Yumurta', avokado: 'Avokado', ekmek: 'Ekmek', deterjan: 'Deterjan', krem: 'Güneş kremi (çocuk)' },
    ev: {
      okul: 'Okul', anaokulu: 'Anaokulu', yuzme: 'Yüzme kursu', lab: 'Lab — Viveros toplantısı',
      dis: 'Diş randevusu — Deniz', yemek: 'Aile yemeği — Sofía & Pablo', pilates: 'Pilates',
      veli: 'Veli toplantısı', arama: 'Türkiye ile görüntülü arama', party: "Deniz'in doğum günü partisi",
      haftalik: 'Haftalık plan toplantısı', tatil: 'İzmir tatili',
      colegio: 'Colegio Los Andes', club: 'Club Providencia', meet: 'Google Meet', clinica: 'Clínica Alemana', home: 'Evde',
    },
    notif: {
      isapre: 'Isapre vadesine 3 gün kaldı', isapreBody: '$210.000 · Banka (CLP)',
      pas: 'Mira pasaportu 40 gün içinde doluyor', pasBody: 'İzmir seyahati için yenile',
      budget: "Yeme-İçme bütçesinin %80'i harcandı", budgetBody: '$62.300 / $150.000',
    },
  },
  es: {
    household: 'Nuestra casa',
    dad: 'Papá', mom: 'Mamá',
    acc: { cash: 'Efectivo', bank: 'Banco (CLP)', card: 'Tarjeta de crédito', tr: 'Cuenta en Turquía', usd: 'Ahorros (USD)' },
    cat: {
      ev: 'Casa', kira: 'Arriendo', fatura: 'Cuentas', market: 'Supermercado', gida: 'Alimentos', ulasim: 'Transporte', yakit: 'Bencina',
      cocuk: 'Niños', okul: 'Colegio', kurs: 'Talleres y actividades', saglik: 'Salud', yeme: 'Comer fuera',
      eglence: 'Ocio y social', abone: 'Suscripciones', hediye: 'Regalos', seyahat: 'Viajes', giyim: 'Ropa',
      diger: 'Otros', maas: 'Sueldo', danis: 'Asesorías',
    },
    tx: {
      maas: 'Sueldo', danisFatura: 'Boleta de asesoría', kira: 'Arriendo', elektrik: 'Enel electricidad',
      okulTaksit: 'Mensualidad del colegio', yuzme: 'Taller de natación', cicek: 'Flores para la abuela', pizza: 'Noche de pizza',
      kirtasiye: 'Librería', eczane: 'Farmacia', ucak: 'Abono pasajes de avión',
      marketAy: 'Supermercado (total del mes)', restoran: 'Restaurantes', yakitAy: 'Bencina', kislik: 'Ropa de invierno niños',
    },
    rec: { kira: 'Arriendo', isapre: 'Isapre', okul: 'Mensualidad del colegio', destek: 'Apoyo a la abuela', maas: 'Sueldo' },
    plan: {
      izmir: 'Vacaciones de verano en Esmirna', izmirDest: 'Esmirna, Turquía',
      party: 'Cumpleaños 10 de Deniz', partyDest: 'En casa',
      araba: 'Pie del auto', mutfak: 'Renovar la cocina',
    },
    pi: {
      ucak: 'Vuelo SCL → IST', cesme: 'Arriendo en Çeşme (7 noches)',
      ist: 'Estambul — 2 días con la familia', izmir: 'Esmirna — Alaçatı, Éfeso, Şirince',
      pasaport: 'Pasaportes (¡revisar el de Mira!)', sigorta: 'Seguro de viaje',
      bavul: 'Maletas: trajes de baño, bloqueador',
      g1: 'Lucas (del colegio)', g2: 'Sofía', g3: 'Matías',
      pasta: 'Encargar la torta (de chocolate)', balon: 'Globos y decoración', davetiye: 'Enviar las invitaciones',
      aylik: 'Se transfieren 500 USD cada mes',
    },
    occ: {
      dad: 'Cumpleaños de Papá', mom: 'Cumpleaños de Mamá', deniz: 'Cumpleaños de Deniz', mira: 'Cumpleaños de Mira',
      anniv: 'Aniversario de matrimonio', grandma: 'Cumpleaños de la abuela', grandmaName: 'Abuela',
      gDeniz: 'Lego Technic, skate', gAnniv: 'Cena — ¿Boragó?', gGrandma: 'Flores + videollamada',
    },
    doc: { miraPas: 'Pasaporte — Mira', denizPas: 'Pasaporte — Deniz', arac: 'Seguro del auto', kira: 'Contrato de arriendo', ehliyet: 'Licencia de conducir — Papá' },
    task: { cop: 'Sacar la basura', oyuncak: 'Ordenar los juguetes', sigorta: 'Renovar el seguro del auto', pasta: 'Encargar la torta', bulasik: 'Vaciar el lavavajillas' },
    list: { market: 'Supermercado', eczane: 'Farmacia' },
    item: { sut: 'Leche (2 L)', yumurta: 'Huevos', avokado: 'Paltas', ekmek: 'Pan', deterjan: 'Detergente', krem: 'Bloqueador (niños)' },
    ev: {
      okul: 'Colegio', anaokulu: 'Jardín infantil', yuzme: 'Taller de natación', lab: 'Lab — reunión Viveros',
      dis: 'Dentista — Deniz', yemek: 'Cena familiar — Sofía y Pablo', pilates: 'Pilates',
      veli: 'Reunión de apoderados', arama: 'Videollamada con Turquía', party: 'Cumpleaños de Deniz',
      haftalik: 'Reunión semanal de planificación', tatil: 'Vacaciones en Esmirna',
      colegio: 'Colegio Los Andes', club: 'Club Providencia', meet: 'Google Meet', clinica: 'Clínica Alemana', home: 'En casa',
    },
    notif: {
      isapre: 'Isapre vence en 3 días', isapreBody: '$210.000 · Banco (CLP)',
      pas: 'El pasaporte de Mira vence en 40 días', pasBody: 'Renovar antes del viaje a Esmirna',
      budget: 'Ya usaste el 80% del presupuesto de Comer fuera', budgetBody: '$62.300 / $150.000',
    },
  },
};

export function buildDemo(locale = 'tr') {
  const x = L[locale] || L.tr;
  const T = today();
  const thisPeriod = periodOf(T);
  const lastPeriod = periodOf(addMonths(T, -1));
  const hid = 'demo_household';

  const household = {
    id: hid, name: x.household, base_currency: 'CLP', timezone: 'America/Santiago',
    locale, week_starts_on: 1, holiday_countries: ['CL', 'TR'], join_code: 'YUVA2026',
  };

  const members = [
    { id: 'm_baba', household_id: hid, user_id: 'demo_user', display_name: x.dad, role: 'adult', color: '#4F7CAC', avatar_emoji: '🧔', birthdate: '1985-03-14', is_active: true },
    { id: 'm_anne', household_id: hid, user_id: 'demo_user_2', display_name: x.mom, role: 'adult', color: '#C96B8E', avatar_emoji: '👩', birthdate: '1987-11-02', is_active: true },
    { id: 'm_deniz', household_id: hid, user_id: null, display_name: 'Deniz', role: 'child', color: '#E9A23B', avatar_emoji: '🧒', birthdate: '2016-10-05', is_active: true },
    { id: 'm_mira', household_id: hid, user_id: null, display_name: 'Mira', role: 'child', color: '#5BA38E', avatar_emoji: '👧', birthdate: '2020-06-18', is_active: true },
  ];

  const accounts = [
    { id: 'a_nakit', household_id: hid, name: x.acc.cash, type: 'cash', currency: 'CLP', opening_balance: 120000, icon: '💵', is_archived: false },
    { id: 'a_bci', household_id: hid, name: x.acc.bank, type: 'bank', currency: 'CLP', opening_balance: 2400000, icon: '🏦', is_archived: false },
    { id: 'a_kart', household_id: hid, name: x.acc.card, type: 'card', currency: 'CLP', opening_balance: 0, icon: '💳', is_archived: false },
    { id: 'a_try', household_id: hid, name: x.acc.tr, type: 'bank', currency: 'TRY', opening_balance: 85000, icon: '🇹🇷', is_archived: false },
    { id: 'a_usd', household_id: hid, name: x.acc.usd, type: 'savings', currency: 'USD', opening_balance: 6200, icon: '🐖', is_archived: false },
  ];

  const cat = (id, name, kind, icon, parent = null, is_fixed = false) => ({ id, household_id: hid, name, kind, icon, parent_id: parent, is_fixed });
  const categories = [
    cat('c_ev', x.cat.ev, 'expense', '🏠', null, true),
    cat('c_kira', x.cat.kira, 'expense', '🔑', 'c_ev', true),
    cat('c_fatura', x.cat.fatura, 'expense', '💡', 'c_ev', true),
    cat('c_market', x.cat.market, 'expense', '🛒'),
    cat('c_gida', x.cat.gida, 'expense', '🥦', 'c_market'),
    cat('c_ulasim', x.cat.ulasim, 'expense', '🚗'),
    cat('c_yakit', x.cat.yakit, 'expense', '⛽', 'c_ulasim'),
    cat('c_cocuk', x.cat.cocuk, 'expense', '🧒'),
    cat('c_okul', x.cat.okul, 'expense', '🎒', 'c_cocuk', true),
    cat('c_kurs', x.cat.kurs, 'expense', '🎨', 'c_cocuk'),
    cat('c_saglik', x.cat.saglik, 'expense', '🩺'),
    cat('c_yeme', x.cat.yeme, 'expense', '🍽️'),
    cat('c_eglence', x.cat.eglence, 'expense', '🎉'),
    cat('c_abone', x.cat.abone, 'expense', '📺', 'c_eglence', true),
    cat('c_hediye', x.cat.hediye, 'expense', '🎁', 'c_eglence'),
    cat('c_seyahat', x.cat.seyahat, 'expense', '✈️'),
    cat('c_giyim', x.cat.giyim, 'expense', '👗'),
    cat('c_diger', x.cat.diger, 'expense', '🏷️'),
    cat('c_maas', x.cat.maas, 'income', '💼'),
    cat('c_danis', x.cat.danis, 'income', '🧪'),
  ];

  const rates = { USDCLP: 940, USDTRY: 44.5, USDEUR: 0.91 };
  const toBase = (amount, ccy) => ccy === 'CLP' ? amount : ccy === 'USD' ? amount * rates.USDCLP : ccy === 'TRY' ? amount / rates.USDTRY * rates.USDCLP : amount / rates.USDEUR * rates.USDCLP;

  const tx = (occurred_on, kind, account_id, amount, currency, category_id, merchant, extra = {}) => ({
    id: uid('t'), household_id: hid, kind, account_id, amount, currency,
    fx_rate: toBase(1, currency), amount_base: Math.round(toBase(amount, currency)),
    occurred_on, category_id, merchant, paid_by_member_id: 'm_baba', for_member_id: null, tags: [], ...extra,
  });
  const d = (n) => addDays(T, -n);
  const mStart = thisPeriod + '-01';
  const lmStart = lastPeriod + '-01';

  const transactions = [
    tx(mStart, 'income', 'a_bci', 2800000, 'CLP', 'c_maas', x.tx.maas),
    tx(addDays(mStart, 2), 'income', 'a_usd', 1500, 'USD', 'c_danis', x.tx.danisFatura),
    tx(addDays(mStart, 1), 'expense', 'a_bci', 950000, 'CLP', 'c_kira', x.tx.kira),
    tx(addDays(mStart, 3), 'expense', 'a_bci', 78000, 'CLP', 'c_fatura', x.tx.elektrik),
    tx(addDays(mStart, 4), 'expense', 'a_bci', 420000, 'CLP', 'c_okul', x.tx.okulTaksit, { for_member_id: 'm_deniz' }),
    tx(d(9), 'expense', 'a_kart', 86500, 'CLP', 'c_gida', 'Jumbo'),
    tx(d(7), 'expense', 'a_kart', 12990, 'CLP', 'c_abone', 'Netflix'),
    tx(d(6), 'expense', 'a_nakit', 38000, 'CLP', 'c_yakit', 'Copec'),
    tx(d(5), 'expense', 'a_kart', 45000, 'CLP', 'c_kurs', x.tx.yuzme, { for_member_id: 'm_mira' }),
    tx(d(4), 'expense', 'a_try', 1850, 'TRY', 'c_hediye', x.tx.cicek, { paid_by_member_id: 'm_anne' }),
    tx(d(3), 'expense', 'a_kart', 62300, 'CLP', 'c_yeme', x.tx.pizza, { paid_by_member_id: 'm_anne' }),
    tx(d(2), 'expense', 'a_kart', 54900, 'CLP', 'c_gida', 'Lider'),
    tx(d(1), 'expense', 'a_nakit', 6500, 'CLP', 'c_diger', x.tx.kirtasiye, { for_member_id: 'm_deniz' }),
    tx(T, 'expense', 'a_kart', 23400, 'CLP', 'c_saglik', x.tx.eczane),
    tx(d(2), 'expense', 'a_usd', 240, 'USD', 'c_seyahat', x.tx.ucak, { plan_id: 'p_izmir' }),
    // geçen ay
    tx(lmStart, 'income', 'a_bci', 2800000, 'CLP', 'c_maas', x.tx.maas),
    tx(addDays(lmStart, 1), 'expense', 'a_bci', 950000, 'CLP', 'c_kira', x.tx.kira),
    tx(addDays(lmStart, 3), 'expense', 'a_bci', 71000, 'CLP', 'c_fatura', x.tx.elektrik),
    tx(addDays(lmStart, 8), 'expense', 'a_kart', 312000, 'CLP', 'c_gida', x.tx.marketAy),
    tx(addDays(lmStart, 12), 'expense', 'a_kart', 98000, 'CLP', 'c_yeme', x.tx.restoran),
    tx(addDays(lmStart, 15), 'expense', 'a_nakit', 76000, 'CLP', 'c_yakit', x.tx.yakitAy),
    tx(addDays(lmStart, 20), 'expense', 'a_kart', 129000, 'CLP', 'c_giyim', x.tx.kislik, { for_member_id: 'm_mira' }),
  ];

  const budgets = [
    { id: uid('b'), household_id: hid, period: thisPeriod, category_id: 'c_market', amount_base: 400000, rollover: false },
    { id: uid('b'), household_id: hid, period: thisPeriod, category_id: 'c_yeme', amount_base: 150000, rollover: false },
    { id: uid('b'), household_id: hid, period: thisPeriod, category_id: 'c_ulasim', amount_base: 120000, rollover: false },
    { id: uid('b'), household_id: hid, period: thisPeriod, category_id: 'c_eglence', amount_base: 100000, rollover: false },
    { id: uid('b'), household_id: hid, period: thisPeriod, category_id: 'c_cocuk', amount_base: 500000, rollover: false },
    { id: uid('b'), household_id: hid, period: thisPeriod, category_id: null, amount_base: 2300000, rollover: false },
  ];

  const recurring = [
    { id: uid('r'), household_id: hid, name: x.rec.kira, kind: 'expense', amount: 950000, currency: 'CLP', account_id: 'a_bci', category_id: 'c_kira', rrule: 'FREQ=MONTHLY', next_due_on: addMonths(mStart, 1), reminder_days: 3, auto_post: true, is_active: true },
    { id: uid('r'), household_id: hid, name: 'Netflix', kind: 'expense', amount: 12990, currency: 'CLP', account_id: 'a_kart', category_id: 'c_abone', rrule: 'FREQ=MONTHLY', next_due_on: addDays(T, 23), reminder_days: 2, auto_post: true, is_active: true },
    { id: uid('r'), household_id: hid, name: x.rec.isapre, kind: 'expense', amount: 210000, currency: 'CLP', account_id: 'a_bci', category_id: 'c_saglik', rrule: 'FREQ=MONTHLY', next_due_on: addDays(T, 3), reminder_days: 5, auto_post: false, is_active: true },
    { id: uid('r'), household_id: hid, name: x.rec.okul, kind: 'expense', amount: 420000, currency: 'CLP', account_id: 'a_bci', category_id: 'c_okul', rrule: 'FREQ=MONTHLY', next_due_on: addMonths(addDays(mStart, 4), 1), reminder_days: 5, auto_post: false, is_active: true },
    { id: uid('r'), household_id: hid, name: x.rec.destek, kind: 'expense', amount: 5000, currency: 'TRY', account_id: 'a_try', category_id: 'c_diger', rrule: 'FREQ=MONTHLY', next_due_on: addDays(T, 6), reminder_days: 2, auto_post: false, is_active: true },
    { id: uid('r'), household_id: hid, name: x.rec.maas, kind: 'income', amount: 2800000, currency: 'CLP', account_id: 'a_bci', category_id: 'c_maas', rrule: 'FREQ=MONTHLY', next_due_on: addMonths(mStart, 1), reminder_days: 0, auto_post: true, is_active: true },
  ];

  const plans = [
    { id: 'p_izmir', household_id: hid, kind: 'trip', status: 'planned', title: x.plan.izmir, destination: x.plan.izmirDest, starts_on: addDays(T, 95), ends_on: addDays(T, 116), budget_amount: 4500, budget_currency: 'USD', icon: '🏖️', color: '#4F7CAC' },
    { id: 'p_dogumgunu', household_id: hid, kind: 'gathering', status: 'planned', title: x.plan.party, destination: x.plan.partyDest, starts_on: addDays(T, 15), ends_on: addDays(T, 15), budget_amount: 250000, budget_currency: 'CLP', icon: '🎂', color: '#E9A23B' },
    { id: 'p_araba', household_id: hid, kind: 'goal', status: 'active', title: x.plan.araba, target_amount: 8000, budget_currency: 'USD', target_account_id: 'a_usd', starts_on: addMonths(T, -6), ends_on: addMonths(T, 8), icon: '🚙', color: '#5BA38E' },
    { id: 'p_mutfak', household_id: hid, kind: 'project', status: 'idea', title: x.plan.mutfak, budget_amount: 3200000, budget_currency: 'CLP', icon: '🔨', color: '#8D6BC2' },
  ];

  const pi = (plan_id, kind, title, extra = {}) => ({ id: uid('pi'), plan_id, household_id: hid, kind, title, is_done: false, ...extra });
  const plan_items = [
    pi('p_izmir', 'booking', x.pi.ucak, { on_date: addDays(T, 95), amount: 2400, currency: 'USD', ref_code: 'TK-7XK2Q', is_done: true }),
    pi('p_izmir', 'booking', x.pi.cesme, { on_date: addDays(T, 100), amount: 900, currency: 'USD' }),
    pi('p_izmir', 'itinerary', x.pi.ist, { on_date: addDays(T, 96) }),
    pi('p_izmir', 'itinerary', x.pi.izmir, { on_date: addDays(T, 100) }),
    pi('p_izmir', 'checklist', x.pi.pasaport),
    pi('p_izmir', 'checklist', x.pi.sigorta),
    pi('p_izmir', 'checklist', x.pi.bavul),
    pi('p_dogumgunu', 'guest', x.pi.g1, { guest_name: 'Lucas', guest_count: 2, rsvp: 'yes' }),
    pi('p_dogumgunu', 'guest', x.pi.g2, { guest_name: 'Sofía', guest_count: 2, rsvp: 'maybe' }),
    pi('p_dogumgunu', 'guest', x.pi.g3, { guest_name: 'Matías', guest_count: 1, rsvp: 'invited' }),
    pi('p_dogumgunu', 'checklist', x.pi.pasta, { assignee_member_id: 'm_anne' }),
    pi('p_dogumgunu', 'checklist', x.pi.balon, { assignee_member_id: 'm_baba' }),
    pi('p_dogumgunu', 'checklist', x.pi.davetiye, { is_done: true }),
    pi('p_araba', 'note', x.pi.aylik),
  ];

  const occasions = [
    { id: uid('o'), household_id: hid, title: x.occ.dad, kind: 'birthday', month: 3, day: 14, year: 1985, member_id: 'm_baba', remind_days: 7 },
    { id: uid('o'), household_id: hid, title: x.occ.mom, kind: 'birthday', month: 11, day: 2, year: 1987, member_id: 'm_anne', remind_days: 7 },
    { id: uid('o'), household_id: hid, title: x.occ.deniz, kind: 'birthday', month: 10, day: 5, year: 2016, member_id: 'm_deniz', remind_days: 14, gift_ideas: x.occ.gDeniz },
    { id: uid('o'), household_id: hid, title: x.occ.mira, kind: 'birthday', month: 6, day: 18, year: 2020, member_id: 'm_mira', remind_days: 14 },
    { id: uid('o'), household_id: hid, title: x.occ.anniv, kind: 'anniversary', month: 9, day: 27, year: 2013, remind_days: 10, gift_ideas: x.occ.gAnniv },
    { id: uid('o'), household_id: hid, title: x.occ.grandma, kind: 'birthday', month: 10, day: 1, year: 1955, person_name: x.occ.grandmaName, remind_days: 7, gift_ideas: x.occ.gGrandma },
  ];

  const documents = [
    { id: uid('d'), household_id: hid, title: x.doc.miraPas, kind: 'passport', member_id: 'm_mira', expires_on: addDays(T, 40), remind_days: 90, number_hint: '…4471' },
    { id: uid('d'), household_id: hid, title: x.doc.denizPas, kind: 'passport', member_id: 'm_deniz', expires_on: addDays(T, 700), remind_days: 180 },
    { id: uid('d'), household_id: hid, title: x.doc.arac, kind: 'vehicle', expires_on: addDays(T, 18), remind_days: 30 },
    { id: uid('d'), household_id: hid, title: x.doc.kira, kind: 'contract', expires_on: addDays(T, 130), remind_days: 60 },
    { id: uid('d'), household_id: hid, title: x.doc.ehliyet, kind: 'license', member_id: 'm_baba', expires_on: addDays(T, 400), remind_days: 60 },
  ];

  const tasks = [
    { id: uid('k'), household_id: hid, title: x.task.cop, assignee_member_id: 'm_deniz', due_on: T, rrule: 'FREQ=WEEKLY;BYDAY=MO,TH', points: 2, is_done: false },
    { id: uid('k'), household_id: hid, title: x.task.oyuncak, assignee_member_id: 'm_mira', due_on: T, rrule: 'FREQ=DAILY', points: 1, is_done: true, done_at: new Date().toISOString() },
    { id: uid('k'), household_id: hid, title: x.task.sigorta, assignee_member_id: 'm_baba', due_on: addDays(T, 10), points: 0, is_done: false },
    { id: uid('k'), household_id: hid, title: x.task.pasta, assignee_member_id: 'm_anne', due_on: addDays(T, 8), points: 0, is_done: false, plan_id: 'p_dogumgunu' },
    { id: uid('k'), household_id: hid, title: x.task.bulasik, assignee_member_id: 'm_deniz', due_on: addDays(T, 1), points: 1, is_done: false },
  ];

  const shopping_lists = [
    { id: 'sl_market', household_id: hid, name: x.list.market, icon: '🛒', is_archived: false },
    { id: 'sl_eczane', household_id: hid, name: x.list.eczane, icon: '💊', is_archived: false },
  ];
  const shopping_items = [
    { id: uid('si'), list_id: 'sl_market', household_id: hid, name: x.item.sut, is_checked: false, added_by_member_id: 'm_anne' },
    { id: uid('si'), list_id: 'sl_market', household_id: hid, name: x.item.yumurta, is_checked: false, added_by_member_id: 'm_baba' },
    { id: uid('si'), list_id: 'sl_market', household_id: hid, name: x.item.avokado, is_checked: true, added_by_member_id: 'm_anne' },
    { id: uid('si'), list_id: 'sl_market', household_id: hid, name: x.item.ekmek, is_checked: false, added_by_member_id: 'm_deniz' },
    { id: uid('si'), list_id: 'sl_market', household_id: hid, name: x.item.deterjan, is_checked: false, added_by_member_id: 'm_anne' },
    { id: uid('si'), list_id: 'sl_eczane', household_id: hid, name: x.item.krem, is_checked: false, added_by_member_id: 'm_anne' },
  ];

  const at = (iso, h, m = 0) => new Date(iso + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00').toISOString();
  const ev = (title, starts_at, ends_at, category, attendees, extra = {}) => ({ id: uid('e'), household_id: hid, title, starts_at, ends_at, category, all_day: false, attendees, ...extra });
  const W = startOfWeek(T);
  const nextSunday = addDays(W, 6);
  const calendar_events = [
    ev(x.ev.okul, at(W, 8), at(W, 15, 30), 'school', ['m_deniz'], { rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', location: x.ev.colegio }),
    ev(x.ev.anaokulu, at(W, 8, 30), at(W, 13), 'school', ['m_mira'], { rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' }),
    ev(x.ev.yuzme, at(W, 17), at(W, 18), 'sport', ['m_mira'], { rrule: 'FREQ=WEEKLY;BYDAY=TU,TH', location: x.ev.club }),
    ev(x.ev.pilates, at(W, 19), at(W, 20), 'sport', ['m_anne'], { rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' }),
    ev(x.ev.lab, at(T, 10), at(T, 11, 30), 'work', ['m_baba'], { location: x.ev.meet }),
    ev(x.ev.dis, at(addDays(T, 1), 16), at(addDays(T, 1), 17), 'health', ['m_deniz', 'm_anne'], { location: x.ev.clinica }),
    ev(x.ev.yemek, at(addDays(T, 2), 20), at(addDays(T, 2), 23), 'social', ['m_baba', 'm_anne', 'm_deniz', 'm_mira'], { location: x.ev.home }),
    ev(x.ev.veli, at(addDays(T, 4), 18, 30), at(addDays(T, 4), 19, 30), 'school', ['m_baba', 'm_anne']),
    ev(x.ev.arama, at(addDays(T, 5), 15), at(addDays(T, 5), 16), 'social', ['m_baba', 'm_anne', 'm_deniz', 'm_mira']),
    ev(x.ev.party, at(addDays(T, 15), 15), at(addDays(T, 15), 19), 'social', ['m_baba', 'm_anne', 'm_deniz', 'm_mira'], { plan_id: 'p_dogumgunu', location: x.ev.home }),
    ev(x.ev.haftalik, at(nextSunday, 21), at(nextSunday, 21, 30), 'home', ['m_baba', 'm_anne'], { rrule: 'FREQ=WEEKLY;BYDAY=SU' }),
    ev(x.ev.tatil, at(addDays(T, 95), 0), at(addDays(T, 116), 23, 59), 'travel', ['m_baba', 'm_anne', 'm_deniz', 'm_mira'], { all_day: true, plan_id: 'p_izmir' }),
  ];

  const notifications = [
    { id: uid('n'), household_id: hid, member_id: null, title: x.notif.isapre, body: x.notif.isapreBody, kind: 'bill_due', fire_at: new Date().toISOString(), read_at: null },
    { id: uid('n'), household_id: hid, member_id: null, title: x.notif.pas, body: x.notif.pasBody, kind: 'doc_expiry', fire_at: new Date().toISOString(), read_at: null },
    { id: uid('n'), household_id: hid, member_id: null, title: x.notif.budget, body: x.notif.budgetBody, kind: 'budget', fire_at: new Date().toISOString(), read_at: null },
  ];

  return {
    version: 2, locale, household, members, me: members[0], accounts, categories, rates, transactions, budgets, recurring,
    plans, plan_items, occasions, documents, tasks, shopping_lists, shopping_items, calendar_events, notifications,
    goal_contributions: [{ id: uid('g'), plan_id: 'p_araba', household_id: hid, amount: 5400, currency: 'USD', on_date: T }],
  };
}
