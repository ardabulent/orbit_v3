/**
 * Türkçe takvim ve tarih yardımcıları (v1.3-01 · E parçası & K-06).
 *
 * Sınav ve ödeme modülleri aynı tarih biçimlendiriciyi paylaşır.
 * İki ayrı modülde aynı kuralın kopyalanması önlenir (K-06).
 */

export const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

export const TR_MONTHS_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
] as const;

/**
 * ISO tarih dizgesini (YYYY-MM-DD) Türkçe arayüz formatına çevirir (ör. "14 Ağustos 2026", "5 Eylül 2026").
 *
 * Başında tek sıfır olan günleri sayıya çevirir ("5 Eylül", "05 Eylül" değil).
 * Geçersiz veya boş değerlerde güvenli davranır (K-04).
 */
export function formatTrDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (Number.isNaN(day) || Number.isNaN(monthIdx)) {
    return dateStr;
  }

  const monthName = TR_MONTHS[monthIdx] || parts[1];
  return `${day} ${monthName} ${year}`;
}

/**
 * ISO tarih dizgesini (YYYY-MM-DD) kısa gün ve ay formatına çevirir (ör. "24 Ağu", "7 Eyl").
 *
 * Rapor ekranı haftalık grafik eksenlerinde kullanılır (v1.4-16 / K-06).
 */
export function formatTrWeekLabel(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (Number.isNaN(day) || Number.isNaN(monthIdx)) {
    return dateStr;
  }

  const monthShort = TR_MONTHS_SHORT[monthIdx] || parts[1];
  return `${day} ${monthShort}`;
}

/**
 * Bir **anın** kurum saatindeki (Europe/Istanbul) takvim günü — SQL
 * `orbit_local_date(timestamptz)`'in istemci ikizi (v1.5-09).
 *
 * `timestamptz` bir **an**dır ve JSON'a UTC olarak iner
 * (`2026-09-18T22:00:00Z`). O dizgeden ilk on karakteri kesmek **UTC günü**
 * verir; Türkiye UTC+3 olduğu için gece 00:00-03:00 arasındaki her an
 * **dünkü** tarihi gösterir. Sorunun tek doğru cevabı ana saat dilimini
 * uygulamaktır ve veritabanı tam bunu yapıyor (`orbit_local_date(paid_at)`).
 *
 * ⚠️ Adı bilerek SQL fonksiyonuyla aynı: aynı soruya iki ad verildiği sürece
 * biri yanlış cevaplanıyor (**K-06**). Ölçüldü (2026-09-18): `startsAt`
 * `dayPlanHelpers`'ta doğru, `CalendarEventFormDialog`'da yanlış
 * çevriliyordu — takvim ızgarası etkinliği doğru güne koyup düzenleme formu
 * yanlış günle açılıyordu.
 *
 * Çözümlenemeyen veya boş değerde `""` döner (**K-04**): olmayan bir günü
 * uydurmaktansa hiç yazmamak (`formatTrDate` aynı davranışta).
 */
export function orbitLocalDate(moment?: string | Date | null): string {
  if (!moment) return "";

  const parsed = moment instanceof Date ? moment : new Date(moment);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

/**
 * Kurum saatindeki **bugün**, ISO formatında (YYYY-MM-DD) — SQL
 * `orbit_today()`'in istemci ikizi (v1.3-15).
 *
 * Sunucunun TimeZone ayarı UTC olduğu için her gece 00:00-03:00 arası
 * `current_date` Türkiye'nin bir gün gerisindedir.
 *
 * SQL tarafında `orbit_today()` = `orbit_local_date(now())`; buradaki ayrım
 * da birebir onun aynası. İleride kurum saat dilimi ayarlanabilir olursa
 * ayarı okuması gereken tek yer `orbitLocalDate` (K-06).
 */
export function getOrbitToday(referenceDate: Date = new Date()): string {
  return orbitLocalDate(referenceDate);
}

/** "YYYY-MM-DD" + gün; saat dilimine dokunmadan (UTC takvim aritmetiği). */
export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(moved.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(moved.getUTCDate()).padStart(2, "0");
  return `${moved.getUTCFullYear()}-${mm}-${dd}`;
}
