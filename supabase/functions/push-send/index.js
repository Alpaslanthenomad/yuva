// supabase/functions/push-send — kuyruktaki bildirimleri telefonlara gönderir.
//
// Kim çağırır:
//   • pg_cron → push_tick() → net.http_post (başlıkta x-cron-secret)
//   • Uygulama → "Deneme bildirimi" düğmesi (oturum açmış kullanıcının JWT'si)
// İkisinin dışında gelen istek reddedilir. Çağrı yan etkisiz sayılabilir:
// yalnızca zamanı gelmiş, gönderilmemiş kayıtları gönderir; aynı kayıt iki
// kez alınmaz (push_claim satırı kilitler ve işaretler).
//
// Gizli anahtarlar koda gömülü değil: VAPID ve cron sırrı Supabase Vault'ta,
// push_config() ile yalnızca service_role okuyabiliyor.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json' },
});

let config = null;
async function getConfig() {
  if (config) return config;
  const { data, error } = await admin.rpc('push_config');
  if (error || !data?.public || !data?.private) throw new Error('config');
  config = data;
  webpush.setVapidDetails('https://yuva-sage.vercel.app', data.public, data.private);
  return config;
}

async function yetkili(req, cfg) {
  const cron = req.headers.get('x-cron-secret');
  if (cron && cfg.cron && cron === cfg.cron) return true;
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return false;
  const { data, error } = await admin.auth.getUser(jwt);
  return !error && Boolean(data?.user);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let cfg;
  try { cfg = await getConfig(); } catch { return json({ error: 'config' }, 500); }
  if (!(await yetkili(req, cfg))) return json({ error: 'unauthorized' }, 401);

  const { data: rows, error } = await admin.rpc('push_claim', { p_limit: 200 });
  if (error) return json({ error: 'claim', detail: error.message }, 500);

  const sonuc = await Promise.all((rows || []).map(async (r) => {
    try {
      const res = await webpush.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        JSON.stringify(r.payload),
        { TTL: 3600, urgency: 'high' },
      );
      return { outbox_id: r.outbox_id, sub_id: r.sub_id, ok: true, status: String(res.statusCode) };
    } catch (e) {
      return { outbox_id: r.outbox_id, sub_id: r.sub_id, ok: false, status: String(e?.statusCode || 0), error: String(e?.body || e?.message || e).slice(0, 200) };
    }
  }));

  if (sonuc.length) await admin.rpc('push_report', { p: sonuc });
  return json({
    sent: sonuc.filter((x) => x.ok).length,
    failed: sonuc.filter((x) => !x.ok).length,
    errors: sonuc.filter((x) => !x.ok).map((x) => `${x.status} ${x.error || ''}`).slice(0, 5),
  });
});
