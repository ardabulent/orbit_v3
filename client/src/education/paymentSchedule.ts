/**
 * Ödeme planı taksit tablosunun hesabı (2026-09-30, tek ekran).
 *
 * Saf hesap: ağa ve veritabanına dokunmaz. Ekran bu tabloyu gösterir,
 * yönetici satırları düzeltebilir; son sözü `save_payment_plan` söyler
 * (toplam paket tutarına eşit değilse kaydetmez).
 */

export type ScheduleRow = {
  /** "YYYY-MM-DD" */
  dueDate: string;
  amount: number;
  /** Peşinat satırı mı (yalnız gösterim için). */
  isDownPayment?: boolean;
};

export type ScheduleInput = {
  total: number;
  downPayment: number;
  downPaymentDate: string | null;
  installmentCount: number;
  firstDueDate: string;
};

/** "YYYY-MM-DD" + n ay; o ayda olmayan gün ayın son gününe çekilir (31 Ocak + 1 ay = 28/29 Şubat). */
export function addMonthsIso(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${target.getUTCFullYear()}-${mm}-${dd}`;
}

/** Kuruş hassasiyetinde toplam (kayan nokta hatası birikmesin). */
export function sumAmounts(rows: { amount: number }[]): number {
  return Math.round(rows.reduce((s, r) => s + r.amount * 100, 0)) / 100;
}

/**
 * Peşinat (varsa) + eşit taksitler. Taksitler tam lira; bölünmeyen kalan
 * (lira ve kuruş) son taksite eklenir, toplam her zaman paket tutarına eşit
 * çıkar. Girdi geçersizse boş liste döner — ekran nedenini ayrıca söyler.
 */
export function buildSchedule(input: ScheduleInput): ScheduleRow[] {
  const total = Math.round(input.total * 100) / 100;
  const down = Math.round((input.downPayment || 0) * 100) / 100;
  const count = Math.floor(input.installmentCount);
  if (!(total > 0) || down < 0 || down > total || !input.firstDueDate)
    return [];

  const rows: ScheduleRow[] = [];
  if (down > 0) {
    rows.push({
      dueDate: input.downPaymentDate || input.firstDueDate,
      amount: down,
      isDownPayment: true,
    });
  }

  const remaining = Math.round((total - down) * 100) / 100;
  if (remaining <= 0) return rows;
  if (count < 1) return [];

  const base = Math.floor(remaining / count);
  for (let i = 0; i < count; i++) {
    rows.push({ dueDate: addMonthsIso(input.firstDueDate, i), amount: base });
  }
  const last = rows[rows.length - 1];
  last.amount = Math.round((remaining - base * (count - 1)) * 100) / 100;
  // Kalan taksit sayısından küçükse (ör. 2 lira, 3 taksit) ilk taksitler 0
  // çıkar; sıfır taksit kaydedilemez, böyle bir bölüşüm geçersizdir.
  if (rows.some(r => r.amount <= 0)) return [];
  return rows;
}
