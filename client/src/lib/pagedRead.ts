/**
 * Sayfalı okuma (2026-10-05, kapsamlı analiz turu 2. madde).
 *
 * Öğrenci, veli, ödeme ve ödev listeleri tek sorguda 100 satırla
 * sınırlıydı: 300 öğrencili bir kurumda listeler eksik görünüyor, öğrenci
 * listesine dayanan seçim kutuları da aynı 100'de kalıyordu. Bu yardımcı
 * aynı sorguyu sayfa sayfa (`range`) çeker, toplam tavana kadar.
 *
 * Kurallar:
 *  - Sayfa boyu sunucu tavanının (`POSTGREST_MAX_ROWS`, 1000) ALTINDA:
 *    eşit olsaydı ve tavan bir gün düşürülseydi her sayfa eksik gelir, döngü
 *    onu "son sayfa" sanıp sessizce dururdu. Kapı: `postgrestLimits.test.ts`.
 *  - Çağıranın sıralaması `id` gibi tekil bir sütunla bitmeli; aksi halde
 *    eşit sıralı satırlar sayfalar arasında kayıp bir satır iki kez, bir
 *    başkası hiç gelmeyebilir.
 *  - `truncated`: toplam tavana ulaşıldı (kesildiği söylenmeden liste
 *    kesilmez — `DECISION_LOG`).
 */

export const READ_PAGE_SIZE = 500;

export type PagedRead<T> = { rows: T[]; truncated: boolean };

/** Sayfa okuma hatası; özgün hata `cause`'da, çağıran onu çevirir. */
export class PagedReadError extends Error {
  constructor(public readonly cause: unknown) {
    super("Sayfalı okuma başarısız");
  }
}

export async function readAllPages<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  totalCap: number
): Promise<PagedRead<T>> {
  const rows: T[] = [];
  while (rows.length < totalCap) {
    const from = rows.length;
    const to = Math.min(from + READ_PAGE_SIZE, totalCap) - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new PagedReadError(error);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < to - from + 1) break;
  }
  return { rows, truncated: rows.length >= totalCap };
}
