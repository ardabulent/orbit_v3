/*
 * Arayüz taşma denetimi (2026-10-15, analiz turu).
 *
 * NE YAPAR: Giriş yapılmış ORBIT sekmesinde her kenar çubuğu ekranını ve
 * Ayarlar'ın her kategorisini 390 / 768 / 1024 / 1280 px genişliğinde açar ve
 * sayfanın yana taşıp taşmadığını ölçer. Taşmayı yapan en dıştaki öğeyi ve
 * ekranda görünen "alınamadı / yüklenemedi" gibi hata cümlelerini yazar.
 * Kendi kutusunda yana kayan tablolar (overflow-x-auto) taşma sayılmaz.
 *
 * NASIL ÇALIŞTIRILIR:
 *   1. Uygulamaya denenecek rolle gir (yönetici, öğretmen, öğrenci, veli).
 *   2. F12 → Console, bu dosyanın tamamını yapıştır, Enter.
 *   3. Bitince tablo yazılır; `window.__tasmaSonuc` da ham sonucu tutar.
 *
 * Sekmeyi öne getirip açık tut: Chrome arka plandaki sekmenin zamanlayıcılarını
 * dakikada bire kadar yavaşlatır. Bekleme bu yüzden setTimeout ile değil,
 * yavaşlatılmayan MessageChannel ile yapılır.
 *
 * Neden 2026-10-14'te yazıldı: Ayarlar → Üyeler 1280 px'te sayfayı 284 px
 * taşırıyordu; üst çubuk yerinde kalıp içerik kaydığı için kenar çubuğu düğmesi
 * görünmez oluyordu. 82 ölçümde başka taşma yoktu — ama bunu bir kullanıcının
 * ekran görüntüsü buldu, bir kapı değil. Her sürümden önce koşulmalı.
 */
(async () => {
  const GENISLIKLER = [390, 768, 1024, 1280];
  const EKRAN_BEKLE = 2500;
  // Kurum paneli kenar çubuğuyla, operatör paneli üst sekmelerle gezilir.
  const EKRAN_DUGMESI = location.pathname.startsWith("/platform")
    ? "main nav button, nav button"
    : "aside button";

  const bekle = async ms => {
    const son = performance.now() + ms;
    while (performance.now() < son) {
      await new Promise(r => {
        const c = new MessageChannel();
        c.port1.onmessage = r;
        c.port2.postMessage(0);
      });
    }
  };

  const olc = doc => {
    const vw = doc.documentElement.clientWidth;
    const tasan = [];
    for (const el of doc.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.right <= vw + 2) continue;
      const ust = el.parentElement?.getBoundingClientRect();
      if (ust && ust.right > vw + 2) continue;
      const sinif = String(el.className?.baseVal ?? el.className ?? "");
      if (sinif.includes("absolute")) continue;
      tasan.push(
        `${el.tagName.toLowerCase()}.${sinif.split(" ").slice(0, 4).join(".")} sağ=${Math.round(r.right)}`
      );
    }
    const hata = (doc.body.innerText.match(
      /[^\n]*(Bir şeyler ters gitti|beklenmeyen|alınamadı|yüklenemedi|okunamadı)[^\n]*/i
    ) || [null])[0];
    return {
      tasma: doc.documentElement.scrollWidth - vw,
      oge: tasan.slice(0, 2).join(" | "),
      hata,
    };
  };

  const cerceve = async genislik => {
    document.getElementById("__tasma_ifr")?.remove();
    const f = document.createElement("iframe");
    f.id = "__tasma_ifr";
    f.src = location.pathname; // operatör paneli /platform'da
    f.style.cssText = `position:fixed;top:0;left:0;width:${genislik}px;height:720px;z-index:99999;background:#fff;border:2px solid #c2283b`;
    document.body.appendChild(f);
    await new Promise(r => (f.onload = r));
    // Uygulama yüklenene kadar bekle (kenar çubuğu çizilince hazırdır).
    for (let i = 0; i < 40; i++) {
      if (f.contentDocument?.querySelector(EKRAN_DUGMESI)) break;
      await bekle(250);
    }
    await bekle(1000);
    return f.contentDocument;
  };

  const tikla = (doc, secici, metin) =>
    [...doc.querySelectorAll(secici)].find(b =>
      b.textContent.trim().startsWith(metin)
    );

  const satirlar = [];
  for (const genislik of GENISLIKLER) {
    const doc = await cerceve(genislik);
    const ekranlar = [...doc.querySelectorAll(EKRAN_DUGMESI)]
      .map(b => b.textContent.trim())
      .filter(t => t && !/Çıkış|Hesap/.test(t));
    for (const ekran of ekranlar) {
      tikla(doc, EKRAN_DUGMESI, ekran)?.click();
      await bekle(EKRAN_BEKLE);
      satirlar.push({ genislik, ekran, ...olc(doc) });
      if (ekran === "Ayarlar") {
        // Ayarlar sayfası ayrı yüklenir; kategoriler gelene kadar bekle.
        for (let i = 0; i < 20; i++) {
          if (doc.querySelector("[data-settings-category]")) break;
          await bekle(250);
        }
        const kategoriler = [
          ...doc.querySelectorAll("[data-settings-category]"),
        ].map(b => b.getAttribute("data-settings-category"));
        for (const kategori of kategoriler) {
          doc.querySelector(`[data-settings-category="${kategori}"]`)?.click();
          await bekle(1500);
          satirlar.push({
            genislik,
            ekran: `Ayarlar › ${kategori}`,
            ...olc(doc),
          });
        }
      }
    }
  }
  document.getElementById("__tasma_ifr")?.remove();

  window.__tasmaSonuc = satirlar;
  const sorunlu = satirlar.filter(s => s.tasma > 0 || s.hata);
  console.log(
    `Taşma denetimi: ${satirlar.length} ölçüm, ${sorunlu.length} sorunlu.`
  );
  console.table(sorunlu.length ? sorunlu : satirlar);
})();
