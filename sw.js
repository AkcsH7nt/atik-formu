/* Atık Saha Formu: uygulama dosyalarını internetsiz açılış için saklar.
   Vaka kayıtlarına dokunmaz; onlar IndexedDB'dedir ve sunucuya gönderilmez. */
const CACHE = 'atik-saha-v1';
const KOK = self.registration.scope;
const MANIFEST = new URL('manifest.json', KOK).href;
const INDEX = new URL('index.html', KOK).href;

const UYGULAMA_ADI = 'Atık Saha Formu';

async function gecerliMi(adres, yanit) {
  if (!yanit.ok || yanit.redirected || yanit.type !== 'basic') return false;
  const kopya = yanit.clone();
  if (adres === KOK) return (await kopya.text()).includes(`<title>${UYGULAMA_ADI}</title>`);
  return (await kopya.json()).name === UYGULAMA_ADI;
}

/* Hata sayfası, yönlendirme veya başka bir sayfa önbelleğe yazılırsa uygulama açılmaz olur. */
async function tazele(adres) {
  const yanit = await fetch(adres, { cache: 'no-cache' });
  if (!await gecerliMi(adres, yanit)) throw new Error(`Saklanamadı: ${adres}`);
  const depo = await caches.open(CACHE);
  await depo.put(adres, yanit);
}

function anahtarBul(istek) {
  if (istek.method !== 'GET') return null;
  const adres = new URL(istek.url);
  adres.search = '';
  adres.hash = '';
  if (adres.href === KOK || adres.href === INDEX) return KOK;
  return adres.href === MANIFEST ? MANIFEST : null;
}

self.addEventListener('install', (olay) => {
  // Çevrimdışı açılış için uygulama şarttır; manifest yalnız kurulumda gerekir, sonraki açılışta yeniden alınır.
  olay.waitUntil(tazele(KOK).then(() => tazele(MANIFEST).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (olay) => {
  olay.waitUntil((async () => {
    const adlar = await caches.keys();
    await Promise.all(adlar.filter((ad) => ad.startsWith('atik-saha-') && ad !== CACHE).map((ad) => caches.delete(ad)));
    await self.clients.claim();
  })());
});

/* Saklı sürüm hemen açılır; internet varsa yeni sürüm arka planda alınır ve sonraki açılışta görünür.
   Böylece index.html değişince burada sürüm numarası artırmak gerekmez. */
self.addEventListener('fetch', (olay) => {
  const anahtar = anahtarBul(olay.request);
  if (!anahtar) return;
  olay.respondWith(caches.match(anahtar).then((saklı) => saklı || fetch(olay.request).catch(() => new Response(
    'Uygulama bu cihaza henüz alınmadı. İnternete bağlanıp yeniden açın.',
    { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
  ))));
  // İnternetsiz sahada bu istek zaten başarısız olur; saklı sürüm kullanılmaya devam eder.
  olay.waitUntil(tazele(anahtar).catch(() => {}));
});
