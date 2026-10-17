/**
 * Yeni jetonun "gelecekten" sayılması — girişte ilk isteğin 401'i (2026-10-16).
 *
 * Ölçüldü (üretim, 15 ve 16 Ekim): şifreyle giriş jetonu üretir, hemen
 * ardından gelen ilk veri isteği PostgREST'ten `401 PGRST303` ("JWT issued at
 * future") alır. Jetonun `iat` değeri giriş sunucusunun saatiyle yazılıyor;
 * PostgREST'in saati bir saniyeden az geride kaldığında aynı saniyede gelen
 * jetonu reddediyor. Uygulama bunu kimlik okunamadı sayıp oturumu kapatıyor,
 * kullanıcı "giriş doğrulanamadı" görüp ikinci kez deniyor ve o zaman geçiyor.
 *
 * Sunucunun saatine dokunamayız; yapılabilecek tek şey bu özel hatada kısa bir
 * bekleyişten sonra aynı isteği yeniden göndermek. Yalnız bu mesajda yeniden
 * denenir: süresi dolmuş jeton (yine PGRST303, "JWT expired") ve diğer bütün
 * 401'ler olduğu gibi döner — onlarda beklemek bir şey değiştirmez.
 */

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const CLOCK_SKEW_RETRY_DELAY_MS = 1000;
export const CLOCK_SKEW_MAX_RETRIES = 3;

/** PostgREST yanıt gövdesi "jeton gelecekten" mi diyor. */
export function isIssuedAtFutureError(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { code?: unknown; message?: unknown };
    return (
      parsed.code === "PGRST303" &&
      typeof parsed.message === "string" &&
      /issued at future/i.test(parsed.message)
    );
  } catch {
    // JSON olmayan 401 gövdesi (ağ geçidi sayfası vb.) bu hata değildir.
    return false;
  }
}

export function createClockSkewRetryFetch(
  baseFetch: FetchLike,
  options: {
    delayMs?: number;
    maxRetries?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): FetchLike {
  const delayMs = options.delayMs ?? CLOCK_SKEW_RETRY_DELAY_MS;
  const maxRetries = options.maxRetries ?? CLOCK_SKEW_MAX_RETRIES;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));

  return async (input, init) => {
    // `Request` nesnesinin gövdesi bir kez okunur; yeniden gönderilemez.
    // supabase-js adres + `init` ile çağırıyor, bu yol pratikte kullanılmıyor.
    const replayable =
      typeof Request === "undefined" || !(input instanceof Request);

    for (let attempt = 0; ; attempt++) {
      const response = await baseFetch(input, init);
      if (response.status !== 401 || !replayable || attempt >= maxRetries) {
        return response;
      }
      const body = await response.clone().text();
      if (!isIssuedAtFutureError(body)) return response;
      console.warn(
        `[ORBIT] Jeton sunucu saatinde henüz geçerli değil; ${delayMs} ms sonra yeniden deneniyor (${attempt + 1}/${maxRetries}).`
      );
      await sleep(delayMs);
    }
  };
}
