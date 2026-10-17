import { describe, expect, it, vi } from "vitest";
import {
  createClockSkewRetryFetch,
  isIssuedAtFutureError,
} from "./clockSkewRetryFetch";

const future = JSON.stringify({
  code: "PGRST303",
  details: null,
  hint: null,
  message: "JWT issued at future",
});
const expired = JSON.stringify({
  code: "PGRST303",
  details: null,
  hint: null,
  message: "JWT expired",
});

const yanit = (status: number, body = "[]") => new Response(body, { status });

describe("jeton saat farkı", () => {
  it("yalnız 'issued at future' mesajını tanır", () => {
    expect(isIssuedAtFutureError(future)).toBe(true);
    expect(isIssuedAtFutureError(expired)).toBe(false);
    expect(isIssuedAtFutureError("<html>401</html>")).toBe(false);
  });

  it("gelecekten sayılan jetonda bekleyip aynı isteği yeniden gönderir", async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(yanit(401, future))
      .mockResolvedValueOnce(yanit(200, '[{"id":1}]'));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetcher = createClockSkewRetryFetch(base, { sleep });

    const res = await fetcher("https://x/rest/v1/t", { method: "GET" });

    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
    expect(base.mock.calls[1]).toEqual(base.mock.calls[0]);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("süresi dolmuş jetonu ve diğer 401'leri yeniden denemez", async () => {
    for (const body of [expired, '{"code":"42501"}']) {
      const base = vi.fn().mockResolvedValue(yanit(401, body));
      const fetcher = createClockSkewRetryFetch(base, {
        sleep: () => Promise.resolve(),
      });
      const res = await fetcher("https://x/rest/v1/t");
      expect(res.status).toBe(401);
      expect(base).toHaveBeenCalledTimes(1);
      // Gövde çağırana okunabilir halde kalır.
      expect(await res.text()).toBe(body);
    }
  });

  it("deneme sayısı tükenince son 401'i döndürür", async () => {
    const base = vi
      .fn()
      .mockImplementation(() => Promise.resolve(yanit(401, future)));
    const fetcher = createClockSkewRetryFetch(base, {
      maxRetries: 3,
      sleep: () => Promise.resolve(),
    });
    const res = await fetcher("https://x/rest/v1/t");
    expect(res.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(4);
  });

  it("başarılı yanıta dokunmaz", async () => {
    const base = vi.fn().mockResolvedValue(yanit(200));
    const res = await createClockSkewRetryFetch(base)("https://x");
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(1);
  });
});
