import { describe, expect, it, vi } from "vitest";
import {
  createErrorReporter,
  REPEAT_WINDOW_MS,
  SESSION_REPORT_CAP,
} from "./errorReporter";

function setup(start = 0) {
  let clock = start;
  const send = vi.fn().mockResolvedValue(undefined);
  const report = createErrorReporter({
    send,
    now: () => clock,
    path: () => "/odevler?ara=78018106",
    appVersion: "abc1234",
    userAgent: "Mozilla/5.0",
  });
  return {
    send,
    report,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("createErrorReporter", () => {
  it("hatayı ayıklanmış hâliyle gönderir", () => {
    const { send, report } = setup();
    report("error", new Error("ayse@example.test bulunamadı"));
    expect(send).toHaveBeenCalledTimes(1);
    const input = send.mock.calls[0][0];
    expect(input.message).toBe("[e-posta] bulunamadı");
    expect(input.path).toBe("/odevler");
    expect(input.appVersion).toBe("abc1234");
    expect(input.kind).toBe("error");
  });

  it("aynı mesajı 10 dakika içinde tekrar göndermez", () => {
    const { send, report, advance } = setup();
    report("error", new Error("x"));
    report("error", new Error("x"));
    expect(send).toHaveBeenCalledTimes(1);
    advance(REPEAT_WINDOW_MS);
    report("error", new Error("x"));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("açılış başına en fazla 20 kayıt", () => {
    const { send, report } = setup();
    for (let i = 0; i < SESSION_REPORT_CAP + 5; i++) {
      report("error", new Error(`hata ${i}`));
    }
    expect(send).toHaveBeenCalledTimes(SESSION_REPORT_CAP);
  });

  it("Error olmayan değerleri de anlatır", () => {
    const { send, report } = setup();
    report("unhandledrejection", "zaman aşımı");
    report("unhandledrejection", { garip: true });
    expect(send.mock.calls.map(c => c[0].message)).toEqual([
      "zaman aşımı",
      "Tanımsız hata",
    ]);
  });
});
