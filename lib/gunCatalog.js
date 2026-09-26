// lib/gunCatalog.js — Günüm için hazır bloklar ve hedefler.
//
// İSTEK: "Günüm blokların şekli hoşuma gitmedi; kategorileştirirsen seçim
// daha kolay olur." Boş bir "Blok adı / Başlangıç / Bitiş" formu yerine,
// meyve-sebze ve takviye ızgaralarındaki gibi: bölüm seç, dokun, saatler
// hazır gelsin; istersen değiştir.
//
// Saatler yalnızca ÖNERİ. Seçince form doluyor, kullanıcı onaylamadan hiçbir
// şey eklenmiyor. Gece yarısını aşan blok yok (0021 kısıtı: ends_at > starts_at).

export const BLOCK_GROUPS = [
  { key: 'morning', emoji: '🌅', tr: 'Sabah',     es: 'Mañana' },
  { key: 'work',    emoji: '💼', tr: 'İş',        es: 'Trabajo' },
  { key: 'body',    emoji: '💪', tr: 'Hareket',   es: 'Movimiento' },
  { key: 'mind',    emoji: '🧘', tr: 'İç huzur',  es: 'Calma' },
  { key: 'learn',   emoji: '📚', tr: 'Öğrenme',   es: 'Aprender' },
  { key: 'family',  emoji: '👨‍👩‍👧', tr: 'Aile',      es: 'Familia' },
  { key: 'home',    emoji: '🏠', tr: 'Ev',        es: 'Casa' },
  { key: 'evening', emoji: '🌙', tr: 'Akşam',     es: 'Noche' },
];

export const BLOCK_CATALOG = [
  // Sabah
  { key: 'wake',       group: 'morning', emoji: '⏰', tr: 'Uyanış',              es: 'Despertar',            from: '06:30', to: '07:00' },
  { key: 'am_routine', group: 'morning', emoji: '🚿', tr: 'Sabah rutini',        es: 'Rutina matinal',       from: '07:00', to: '07:30' },
  { key: 'breakfast',  group: 'morning', emoji: '🥣', tr: 'Kahvaltı',            es: 'Desayuno',             from: '07:30', to: '08:00' },
  { key: 'school_run', group: 'morning', emoji: '🎒', tr: 'Okula bırakma',       es: 'Llevar al colegio',    from: '07:45', to: '08:30' },
  { key: 'commute_am', group: 'morning', emoji: '🚇', tr: 'Yol (gidiş)',         es: 'Trayecto (ida)',       from: '08:15', to: '09:00' },
  { key: 'plan_day',   group: 'morning', emoji: '📝', tr: 'Günü planla',         es: 'Planificar el día',    from: '08:45', to: '09:00' },
  // İş
  { key: 'deep_work',  group: 'work', emoji: '🎯', tr: 'Derin çalışma',          es: 'Trabajo profundo',     from: '09:00', to: '12:00' },
  { key: 'meetings',   group: 'work', emoji: '👥', tr: 'Toplantılar',            es: 'Reuniones',            from: '10:00', to: '11:00' },
  { key: 'email',      group: 'work', emoji: '📧', tr: 'E-posta / mesajlar',     es: 'Correos / mensajes',   from: '12:00', to: '12:30' },
  { key: 'lunch',      group: 'work', emoji: '🍽️', tr: 'Öğle yemeği',            es: 'Almuerzo',             from: '13:00', to: '14:00' },
  { key: 'pm_work',    group: 'work', emoji: '💻', tr: 'Öğleden sonra çalışma',  es: 'Trabajo de tarde',     from: '14:00', to: '17:30' },
  { key: 'lab',        group: 'work', emoji: '🔬', tr: 'Laboratuvar / saha',     es: 'Laboratorio / terreno', from: '14:00', to: '17:00' },
  { key: 'commute_pm', group: 'work', emoji: '🚗', tr: 'Yol (dönüş)',            es: 'Trayecto (vuelta)',    from: '17:30', to: '18:15' },
  // Hareket
  { key: 'am_sport',   group: 'body', emoji: '🏃', tr: 'Sabah koşusu',           es: 'Trote matinal',        from: '06:30', to: '07:15' },
  { key: 'gym',        group: 'body', emoji: '🏋️', tr: 'Spor salonu',            es: 'Gimnasio',             from: '18:30', to: '19:30' },
  { key: 'padel',      group: 'body', emoji: '🎾', tr: 'Padel / tenis',          es: 'Pádel / tenis',        from: '19:00', to: '20:30' },
  { key: 'walk',       group: 'body', emoji: '🚶', tr: 'Yürüyüş',                es: 'Caminata',             from: '18:00', to: '18:30' },
  { key: 'bike',       group: 'body', emoji: '🚴', tr: 'Bisiklet',               es: 'Bicicleta',            from: '07:00', to: '08:00' },
  { key: 'swim',       group: 'body', emoji: '🏊', tr: 'Yüzme',                  es: 'Natación',             from: '19:00', to: '20:00' },
  { key: 'stretch',    group: 'body', emoji: '🤸', tr: 'Esneme / yoga',          es: 'Estiramiento / yoga',  from: '21:00', to: '21:20' },
  { key: 'hike',       group: 'body', emoji: '⛰️', tr: 'Doğa yürüyüşü',          es: 'Trekking',             from: '09:00', to: '13:00' },
  // İç huzur — hiçbiri kendiliğinden eklenmez.
  { key: 'meditate',   group: 'mind', emoji: '🧘', tr: 'Meditasyon',             es: 'Meditación',           from: '06:45', to: '07:00' },
  { key: 'journal',    group: 'mind', emoji: '📓', tr: 'Günlük yazma',           es: 'Escribir diario',      from: '22:00', to: '22:15' },
  { key: 'quiet',      group: 'mind', emoji: '🕊️', tr: 'Sessiz / manevi zaman',  es: 'Tiempo de silencio',   from: '06:00', to: '06:20' },
  { key: 'breathe',    group: 'mind', emoji: '🌬️', tr: 'Nefes molası',           es: 'Pausa para respirar',  from: '15:00', to: '15:10' },
  { key: 'nature',     group: 'mind', emoji: '🌳', tr: 'Açık havada mola',       es: 'Pausa al aire libre',  from: '12:30', to: '13:00' },
  // Öğrenme
  { key: 'reading',    group: 'learn', emoji: '📖', tr: 'Kitap okuma',           es: 'Lectura',              from: '21:00', to: '21:30' },
  { key: 'thesis',     group: 'learn', emoji: '🎓', tr: 'Tez / makale yazma',    es: 'Tesis / artículo',     from: '09:00', to: '11:00' },
  { key: 'language',   group: 'learn', emoji: '🗣️', tr: 'Dil çalışması',         es: 'Idiomas',              from: '20:30', to: '21:00' },
  { key: 'course',     group: 'learn', emoji: '🧑‍💻', tr: 'Online kurs',            es: 'Curso online',         from: '20:00', to: '21:00' },
  { key: 'podcast',    group: 'learn', emoji: '🎧', tr: 'Podcast',               es: 'Podcast',              from: '08:15', to: '08:45' },
  { key: 'music',      group: 'learn', emoji: '🎸', tr: 'Müzik / enstrüman',     es: 'Música / instrumento', from: '19:30', to: '20:00' },
  // Aile
  { key: 'kids_play',  group: 'family', emoji: '🧸', tr: 'Çocuklarla oyun',      es: 'Jugar con los niños',  from: '18:30', to: '19:30' },
  { key: 'homework',   group: 'family', emoji: '✏️', tr: 'Ödev saati',           es: 'Hora de tareas',       from: '17:00', to: '18:00' },
  { key: 'dinner',     group: 'family', emoji: '🍲', tr: 'Aile akşam yemeği',    es: 'Cena en familia',      from: '19:30', to: '20:30' },
  { key: 'bedtime',    group: 'family', emoji: '📚', tr: 'Uyku öncesi masal',    es: 'Cuento antes de dormir', from: '20:30', to: '21:00' },
  { key: 'couple',     group: 'family', emoji: '💞', tr: 'Baş başa zaman',       es: 'Tiempo en pareja',     from: '21:00', to: '22:00' },
  { key: 'call_family', group: 'family', emoji: '📞', tr: 'Aileyi ara',          es: 'Llamar a la familia',  from: '12:30', to: '13:00' },
  { key: 'outing',     group: 'family', emoji: '🌳', tr: 'Aile gezmesi',         es: 'Paseo familiar',       from: '11:00', to: '14:00' },
  // Ev
  { key: 'cook',       group: 'home', emoji: '👩‍🍳', tr: 'Yemek hazırlığı',       es: 'Cocinar',              from: '18:30', to: '19:30' },
  { key: 'tidy',       group: 'home', emoji: '🧹', tr: 'Toparlama',              es: 'Ordenar',              from: '20:30', to: '21:00' },
  { key: 'laundry',    group: 'home', emoji: '🧺', tr: 'Çamaşır',                es: 'Lavado de ropa',       from: '10:00', to: '10:30' },
  { key: 'groceries',  group: 'home', emoji: '🛒', tr: 'Market alışverişi',      es: 'Supermercado',         from: '10:00', to: '11:00' },
  { key: 'meal_prep',  group: 'home', emoji: '🥡', tr: 'Haftalık yemek hazırlığı', es: 'Preparar comidas',   from: '16:00', to: '18:00' },
  { key: 'plants',     group: 'home', emoji: '🪴', tr: 'Bitkiler / bahçe',       es: 'Plantas / jardín',     from: '09:00', to: '09:30' },
  // Akşam
  { key: 'no_screen',  group: 'evening', emoji: '📵', tr: 'Ekransız saat',       es: 'Hora sin pantallas',   from: '21:30', to: '22:30' },
  { key: 'plan_tmrw',  group: 'evening', emoji: '🗒️', tr: 'Yarını hazırla',      es: 'Preparar mañana',      from: '21:45', to: '22:00' },
  { key: 'wind_down',  group: 'evening', emoji: '🛁', tr: 'Gevşeme',             es: 'Relajarse',            from: '22:00', to: '22:30' },
  { key: 'sleep',      group: 'evening', emoji: '😴', tr: 'Uyku',                es: 'Dormir',               from: '22:30', to: '23:00' },
];

/** "Örnek bir gün kur": boş şablona tek dokunuşla makul bir iskelet. */
export const STARTER_DAY = {
  weekday: ['wake', 'breakfast', 'deep_work', 'lunch', 'pm_work', 'gym', 'dinner', 'reading', 'sleep'],
  weekend: ['wake', 'breakfast', 'outing', 'kids_play', 'dinner', 'couple', 'sleep'],
};

export const GOAL_GROUPS = [
  { key: 'learn',  emoji: '📚', tr: 'Öğrenme', es: 'Aprender' },
  { key: 'body',   emoji: '💪', tr: 'Hareket', es: 'Movimiento' },
  { key: 'family', emoji: '👨‍👩‍👧', tr: 'Aile',    es: 'Familia' },
  { key: 'habit',  emoji: '✨', tr: 'Alışkanlık', es: 'Hábitos' },
];

// kind: daily (her gün miktar) · weekly (haftada kaç gün) · total (dönem toplamı)
export const GOAL_CATALOG = [
  { key: 'read_daily',  group: 'learn',  emoji: '📖', tr: 'Her gün oku',          es: 'Leer cada día',         kind: 'daily',  target: 30, unitTr: 'dakika', unitEs: 'minutos' },
  { key: 'books_year',  group: 'learn',  emoji: '📚', tr: 'Yılda kitap',          es: 'Libros al año',         kind: 'total',  target: 12, unitTr: 'kitap',  unitEs: 'libros' },
  { key: 'pages',       group: 'learn',  emoji: '📄', tr: 'Günlük sayfa',         es: 'Páginas diarias',       kind: 'daily',  target: 20, unitTr: 'sayfa',  unitEs: 'páginas' },
  { key: 'writing',     group: 'learn',  emoji: '✍️', tr: 'Yazı / tez',           es: 'Escritura / tesis',     kind: 'daily',  target: 60, unitTr: 'dakika', unitEs: 'minutos' },
  { key: 'language',    group: 'learn',  emoji: '🗣️', tr: 'Dil pratiği',          es: 'Práctica de idioma',    kind: 'daily',  target: 15, unitTr: 'dakika', unitEs: 'minutos' },
  { key: 'sport_week',  group: 'body',   emoji: '🏋️', tr: 'Haftada spor',         es: 'Deporte semanal',       kind: 'weekly', target: 3,  unitTr: 'gün',    unitEs: 'días' },
  { key: 'steps',       group: 'body',   emoji: '👟', tr: 'Günlük adım',          es: 'Pasos diarios',         kind: 'daily',  target: 8000, unitTr: 'adım', unitEs: 'pasos' },
  { key: 'run_km',      group: 'body',   emoji: '🏃', tr: 'Aylık koşu',           es: 'Trote mensual',         kind: 'total',  target: 50, unitTr: 'km',     unitEs: 'km' },
  { key: 'stretch',     group: 'body',   emoji: '🤸', tr: 'Esneme',               es: 'Estirar',               kind: 'weekly', target: 5,  unitTr: 'gün',    unitEs: 'días' },
  { key: 'kids_time',   group: 'family', emoji: '🧸', tr: 'Çocuklarla oyun',      es: 'Jugar con los niños',   kind: 'daily',  target: 30, unitTr: 'dakika', unitEs: 'minutos' },
  { key: 'date_night',  group: 'family', emoji: '💞', tr: 'Baş başa akşam',       es: 'Cita en pareja',        kind: 'weekly', target: 1,  unitTr: 'kez',    unitEs: 'vez' },
  { key: 'call_parents', group: 'family', emoji: '📞', tr: 'Aileyi arama',        es: 'Llamar a la familia',   kind: 'weekly', target: 2,  unitTr: 'kez',    unitEs: 'veces' },
  { key: 'family_meal', group: 'family', emoji: '🍲', tr: 'Birlikte akşam yemeği', es: 'Cenar juntos',         kind: 'weekly', target: 5,  unitTr: 'gün',    unitEs: 'días' },
  { key: 'water',       group: 'habit',  emoji: '💧', tr: 'Su iç',                es: 'Tomar agua',            kind: 'daily',  target: 8,  unitTr: 'bardak', unitEs: 'vasos' },
  { key: 'meditate',    group: 'habit',  emoji: '🧘', tr: 'Meditasyon',           es: 'Meditación',            kind: 'daily',  target: 10, unitTr: 'dakika', unitEs: 'minutos' },
  { key: 'no_screen',   group: 'habit',  emoji: '📵', tr: 'Ekransız akşam',       es: 'Noche sin pantallas',   kind: 'weekly', target: 4,  unitTr: 'gün',    unitEs: 'días' },
  { key: 'early_sleep', group: 'habit',  emoji: '😴', tr: 'Erken yat',            es: 'Dormir temprano',       kind: 'weekly', target: 5,  unitTr: 'gün',    unitEs: 'días' },
  { key: 'journal',     group: 'habit',  emoji: '📓', tr: 'Günlük yaz',           es: 'Escribir diario',       kind: 'weekly', target: 5,  unitTr: 'gün',    unitEs: 'días' },
  { key: 'save',        group: 'habit',  emoji: '🐷', tr: 'Harcamasız gün',       es: 'Día sin gastos',        kind: 'weekly', target: 2,  unitTr: 'gün',    unitEs: 'días' },
];

const isEs = (locale) => String(locale || '').startsWith('es');
export const itemName = (item, locale) => (isEs(locale) ? item.es : item.tr);
export const goalUnit = (item, locale) => (isEs(locale) ? item.unitEs : item.unitTr);
export const findBlock = (key) => BLOCK_CATALOG.find((b) => b.key === key) || null;

/** "HH:MM" → dakika. */
export const dakika = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** İki zaman aralığı üst üste biniyor mu (uçlar değiyorsa binmiyor). */
export const cakisiyor = (a1, a2, b1, b2) => dakika(a1) < dakika(b2) && dakika(b1) < dakika(a2);

/** Süre etiketi: 90 → "1 sa 30 dk" / "1 h 30 min". */
export const sure = (from, to, locale) => {
  const d = Math.max(0, dakika(to) - dakika(from));
  const h = Math.floor(d / 60); const m = d % 60;
  const [H, M] = isEs(locale) ? ['h', 'min'] : ['sa', 'dk'];
  return [h ? `${h} ${H}` : '', m ? `${m} ${M}` : ''].filter(Boolean).join(' ') || `0 ${M}`;
};
