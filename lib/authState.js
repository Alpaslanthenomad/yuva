// lib/authState.js — açılışta hangi ekranın çizileceği.
//
// NEDEN AYRI DOSYA: bu karar bir kez yanlış kuruldu ve en can sıkıcı hatayı
// üretti. Açılış çağrısı (app_bootstrap) herhangi bir sebeple patlayınca —
// telefonda ağ bir saniye kesilse bile — oturum da düşürülüyor ve kullanıcı
// GEÇERLİ OTURUMU VARKEN şifre ekranına atılıyordu. Karar artık tek yerde
// ve testli.
//
// TEMEL KURAL: ŞİFRE EKRANI YALNIZCA OTURUM YOKKEN.
// Oturum varken bilgi yüklenemediyse doğru cevap "tekrar dene"dir; şifre
// sormak yanlıştır, çünkü kullanıcı zaten girişlidir.

/**
 * @param {Object} state AppShell durumu
 * @param {string} mode repo kipi ('supabase' | 'demo')
 * @returns {'loading'|'login'|'retry'|'setup'|'app'}
 *   loading — açılış sürüyor
 *   login   — oturum yok, giriş gerekiyor
 *   retry   — oturum var ama bilgiler yüklenemedi (şifre SORULMAZ)
 *   setup   — oturum var, hanesi yok; hane kurma/katılma
 *   app     — her şey yerinde
 */
export function authScreen(state = {}, mode = 'supabase') {
  if (state?.loading) return 'loading';
  if (mode !== 'supabase') return 'app';          // demo kipinde giriş yok
  if (state?.household) return 'app';
  if (!state?.user) return 'login';
  return state?.bootstrapFailed ? 'retry' : 'setup';
}
