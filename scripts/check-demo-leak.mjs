// Üretim paketinde demo verisi var mı? (2026-10-17, Hız 2)
//
// #144'te demo verisi üretim paketinden çıkarılmıştı: `isDemoMode` derleme
// anında `false`'a katlanıyor, `isDemoMode ? demoX : []` kalıbındaki veri
// ulaşılamaz kalıp eleniyordu. Vite 8 ile gelen paketleyici (Rolldown) başka
// modülden gelen sabiti ağaç sarsmasından önce katlamıyor; dizi "kullanılıyor"
// sayılıp paketin içinde kaldı ve bunu hiçbir kontrol fark etmedi. Ölçüldü:
// öğrenci, ödeme ve program dizileri giriş paketindeydi.
//
// Bu betik `pnpm build`'den sonra çalışır (CI) ve aşağıdaki işaretlerden biri
// paketteki bir JavaScript dosyasında geçerse hata verir. İşaretler yalnız
// `client/src/components/education/demoData.ts`'te geçen metinlerdir; arayüz
// metni olarak da kullanılan adlar ("Örn. Zeynep Kaya" yer tutucusu) bilerek
// listede yok.
//
// Kullanım: node scripts/check-demo-leak.mjs [dist-klasörü]
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const MARKERS = [
  "stu-001",
  "plan-demo-001",
  "yonetici@orbit.edu.tr",
  "Merve Karaca",
  "Seda Kılıç",
  "YKS Sayısal Paket",
  "demo123",
];

const root = path.resolve(process.argv[2] ?? "dist");

function jsFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return jsFiles(full);
    return name.endsWith(".js") ? [full] : [];
  });
}

let files;
try {
  files = jsFiles(root);
} catch (error) {
  console.error(
    `[demo-sızıntısı] ${root} okunamadı; önce derleme yapılmalı.`,
    String(error)
  );
  process.exit(2);
}
if (files.length === 0) {
  console.error(`[demo-sızıntısı] ${root} içinde JavaScript dosyası yok.`);
  process.exit(2);
}

const leaks = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const marker of MARKERS) {
    if (text.includes(marker))
      leaks.push(`${path.relative(root, file)}: "${marker}"`);
  }
}

if (leaks.length > 0) {
  console.error("[demo-sızıntısı] Üretim paketinde demo verisi bulundu:");
  for (const leak of leaks) console.error("  - " + leak);
  console.error(
    "Demo verisini kullanan dosyada koşulu derleme sabitine bağlayın (`DEMO_BUILD`, bkz. educationData.ts)."
  );
  process.exit(1);
}
console.log(`[demo-sızıntısı] ${files.length} dosya tarandı, demo verisi yok.`);
