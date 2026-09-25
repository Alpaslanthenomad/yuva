// lib/sonGiris.js — en son giriş yapılan e-posta, o cihazda.
//
// NEDEN: iki kişilik bir hanede e-posta hiç değişmiyor ama her giriş
// ekranında baştan yazılıyordu. Telefonda e-posta yazmak, girişi asıl
// yorucu yapan kısım. Şifreyi zaten telefonun şifre yöneticisi dolduruyor
// (formda autoComplete işaretleri var); e-posta da hazır gelirse giriş tek
// dokunuşa iner.
//
// YALNIZCA E-POSTA SAKLANIR, ŞİFRE ASLA. Şifreyi saklamak tarayıcının ve
// işletim sisteminin işi; uygulama onu kendi deposuna yazmaz.
//
// Yalnızca BAŞARILI girişten sonra yazılır: yanlış yazılmış bir adres
// kalıcılaşıp her açılışta geri gelmesin.

export const SON_EPOSTA_ANAHTAR = 'yuva:son-eposta';

/** @returns {string} kayıtlı e-posta ya da '' */
export function okuSonEposta() {
  try { return localStorage.getItem(SON_EPOSTA_ANAHTAR) || ''; } catch { return ''; }
}

export function yazSonEposta(eposta) {
  const e = String(eposta || '').trim();
  if (!e) return;
  try { localStorage.setItem(SON_EPOSTA_ANAHTAR, e); } catch { /* özel mod */ }
}

/** Çıkışta silinir: ortak bir cihazda sıradaki kişiye adres bırakmayalım. */
export function silSonEposta() {
  try { localStorage.removeItem(SON_EPOSTA_ANAHTAR); } catch { /* özel mod */ }
}
