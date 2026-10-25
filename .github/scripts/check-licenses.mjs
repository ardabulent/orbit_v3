import fs from "node:fs";

// Girdi dosyasını belirle (varsayılan: licenses.json)
const filePath = process.argv[2] || "licenses.json";

if (!fs.existsSync(filePath)) {
  console.error(`❌ Hata: Lisans dosyası bulunamadı: ${filePath}`);
  process.exit(1);
}

let licensesData;
try {
  // BOM temizleniyor: bazı kabuklar yönlendirmede dosyanın başına ekliyor
  // ve `JSON.parse` onu ayrıştıramıyor.
  //
  // UTF-16 tespiti KASITLI olarak yok. Teslimde vardı ve gerekçesi
  // "PowerShell UTF-16 üretebilir" idi; ölçüldü, üretmiyor — hem CI
  // (ubuntu/bash) hem yerel kabuk UTF-8 veriyor (ilk bayt `7b` = `{`).
  // Üstelik dallardan biri `toString("utf16be")` çağırıyordu ve Node öyle
  // bir kodlama TANIMIYOR (`TypeError: Unknown encoding`). Ulaşılsaydı,
  // okunabilir bir dosya için "geçerli JSON değil" diye yanıltıcı bir
  // hatayla kapı kırmızıya dönerdi. Ulaşılamayan ve yanlış olan kod,
  // olmayan koddan kötüdür.
  const content = fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");
  licensesData = JSON.parse(content);
} catch (error) {
  console.error(
    `❌ Hata: ${filePath} dosyası okunamadı veya geçerli JSON değil:`,
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}

// Yasaklı kopyasol lisans anahtar desenleri (büyük/küçük harf duyarsız).
// 'GPL' deseni; GPL, LGPL, AGPL gibi türevleri yakalar.
// 'AGPL' ve 'SSPL' de açıkça kontrol edilir.
const FORBIDDEN_PATTERNS = ["GPL", "AGPL", "SSPL"];

function isForbiddenLicense(license) {
  const upper = license.toUpperCase();
  return FORBIDDEN_PATTERNS.some(pattern => upper.includes(pattern));
}

function isUnknownLicense(license) {
  return license.trim().toLowerCase() === "unknown";
}

// Lisans başına paket sayılarını hesapla ve azalan sırada sırala
const summary = Object.entries(licensesData)
  .map(([license, packages]) => ({
    license,
    count: Array.isArray(packages) ? packages.length : 0,
    packages: Array.isArray(packages) ? packages : [],
  }))
  .sort((a, b) => b.count - a.count || a.license.localeCompare(b.license));

// Özet çıktısını ekrana bas
console.log("\n============================================================");
console.log("             ÜRETİM BAĞIMLILIKLARI LİSANS ÖZETİ");
console.log("============================================================");
console.log(`${"Adet".padEnd(8)} | Lisans`);
console.log("---------+--------------------------------------------------");
for (const entry of summary) {
  console.log(`${String(entry.count).padEnd(8)} | ${entry.license}`);
}
console.log("============================================================\n");

// Yasaklı ve bilinmeyen lisansları topla
const forbiddenViolations = [];
const unknownPackages = [];

for (const entry of summary) {
  if (isForbiddenLicense(entry.license)) {
    for (const pkg of entry.packages) {
      const versionStr = Array.isArray(pkg.versions)
        ? pkg.versions.join(", ")
        : pkg.version || "belirtilmemiş";
      forbiddenViolations.push({
        license: entry.license,
        name: pkg.name,
        version: versionStr,
      });
    }
  }

  if (isUnknownLicense(entry.license)) {
    for (const pkg of entry.packages) {
      const versionStr = Array.isArray(pkg.versions)
        ? pkg.versions.join(", ")
        : pkg.version || "belirtilmemiş";
      unknownPackages.push({
        name: pkg.name,
        version: versionStr,
      });
    }
  }
}

// Bilinmeyen lisans da düşürür (2026-10-25, ana plan 5.5). Lisans beyan
// etmeyen paket hukuken "izin verilmemiş" demektir. Önceden yalnız uyarıydı,
// çünkü listede bir tane vardı (`khroma`, `mermaid` üzerinden) ve düşürmek
// bütün işi durdururdu; paket 2026-09-07'de (68ac85c) kullanılmayan
// `streamdown` ile birlikte gitti, liste temiz. Yeni bir lisanssız paket artık
// sessizce giremez: ya yukarı akışta lisans sorulur, ya paket değiştirilir, ya
// da bilinçli kabul edilip PLATFORM_SETTINGS §5'e yazılır.
if (unknownPackages.length > 0) {
  console.error("❌ HATA: Lisansı tespit edilemeyen (Unknown) paketler:");
  for (const pkg of unknownPackages) {
    console.error(`    - ${pkg.name} (${pkg.version})`);
  }
  console.error(
    `Lisans kontrolü BAŞARISIZ (${unknownPackages.length} paket lisans beyan etmiyor).\n`
  );
  process.exit(1);
}

// Yasaklı lisanslar bulunduysa ayrıntıları bas ve 1 ile çık
if (forbiddenViolations.length > 0) {
  console.error(
    "❌ HATA: İzin verilmeyen (kopyasol) lisansa sahip paketler bulundu:"
  );
  for (const v of forbiddenViolations) {
    console.error(`    - ${v.name} (${v.version}) -> Lisans: ${v.license}`);
  }
  console.error(
    "\nBu lisanslar (GPL, AGPL, SSPL, LGPL) web istemcisine paketlenemez."
  );
  console.error(
    `Lisans kontrolü BAŞARISIZ (${forbiddenViolations.length} paket kural dışı).\n`
  );
  process.exit(1);
}

console.log(
  "✅ Lisans kontrolü BAŞARILI: Yasaklı kopyasol lisans bulunamadı.\n"
);
process.exit(0);
