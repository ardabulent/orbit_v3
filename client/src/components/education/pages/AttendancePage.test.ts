import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AttendancePage } from "./AttendancePage";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/auth/runtime", () => ({
  isDemoMode: false,
}));

describe("AttendancePage (v1.4 kapanış taraması #304)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("K-23: yoklama oturumunun varsayılan tarihi getOrbitToday()'den gelir (gece 01:30'da bugünün takvim gününü verir)", () => {
    // Sabit referans anı: 2026-09-13T22:30:00Z
    // UTC'de 13 Eylül 22:30 iken, Türkiye (Europe/Istanbul UTC+3) saatinde 14 Eylül 01:30'dur.
    // Yasaklanan `new Date().toISOString().split("T")[0]` dünkü tarihi ("2026-09-13") verir.
    // Kuralın gerektirdiği `getOrbitToday()` ise bugünün takvim gününü ("2026-09-14") verir.
    const midnightAfterUtc = new Date("2026-09-13T22:30:00.000Z");
    vi.setSystemTime(midnightAfterUtc);

    const html = renderToStaticMarkup(
      createElement(AttendancePage, {
        role: "teacher",
        attendances: {},
        setAttendances: vi.fn(),
        isDemo: false,
      })
    );

    // 2026-09-28: sınıf/tarih formu kalktı (Bugün listesi). Sayfanın "bugün"ü
    // başlıkta yazılıdır ve Türkiye saatindeki takvim günü olmalıdır.
    expect(html).toContain("Bugün: 14 Eylül 2026");
    expect(html).not.toContain("13 Eylül 2026");
  });
});
