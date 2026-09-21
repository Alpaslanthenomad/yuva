'use client';
// components/icons.jsx — alt menü ikonları. Emoji yerine çizgi ikon:
// emoji her işletim sisteminde farklı görünüyor ve oyuncak gibi duruyordu.
// Tek bileşen, tek yol: renk `currentColor`'dan gelir (tokens.css yönetir).

const PATHS = {
  today: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
  calendar: 'M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  money: 'M3.5 7.5h17v11h-17zM3.5 11h17M7 15h3',
  plans: 'M12 21s6.5-6 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15 12 21 12 21zM12 10.5h.01',
  family: 'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 20c0-3 2.7-5 6-5s6 2 6 5M16 15c2.9.2 5.5 2 5.5 5',
};

export default function Icon({ name, size = 22 }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
