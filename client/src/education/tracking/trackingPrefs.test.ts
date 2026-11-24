import { describe, expect, it, vi } from "vitest";
import { readTrackingPrefs, writeTrackingPrefs } from "./trackingPrefs";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    map,
  };
};

describe("trackingPrefs", () => {
  it("yazılan tercih aynı kişi için geri okunur, aynı kurumdaki başka kişiye geçmez", () => {
    const storage = memory();
    const prefs = {
      criterion: "attendance_pct" as const,
      limits: { attendance_pct: { risk: 75, safe: 85 } },
      weeks: 8 as const,
    };
    expect(writeTrackingPrefs(storage, "org-1:uye-1", prefs)).toBe(true);
    expect(readTrackingPrefs(storage, "org-1:uye-1")).toEqual(prefs);
    expect(readTrackingPrefs(storage, "org-1:uye-2")).toBeNull();
  });

  it("bozuk ya da yabancı kayıt yok sayılır", () => {
    const storage = memory();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    storage.setItem("orbit:takip:org-1", "{bozuk");
    expect(readTrackingPrefs(storage, "org-1")).toBeNull();
    storage.setItem(
      "orbit:takip:org-1",
      JSON.stringify({ criterion: "uydurma", limits: {} })
    );
    expect(readTrackingPrefs(storage, "org-1")).toBeNull();
    warn.mockRestore();
  });

  it("geçersiz sınırlar ayıklanır, geçerliler kalır", () => {
    const storage = memory();
    storage.setItem(
      "orbit:takip:org-1",
      JSON.stringify({
        criterion: "overall",
        limits: {
          attendance_pct: { risk: 80, safe: 90 },
          late_count: { risk: "3", safe: 1 },
          uydurma: { risk: 1, safe: 2 },
        },
      })
    );
    expect(readTrackingPrefs(storage, "org-1")).toEqual({
      criterion: "overall",
      limits: { attendance_pct: { risk: 80, safe: 90 } },
    });
  });

  it("depo yoksa ya da hata verirse okunmaz, yazma false döner", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readTrackingPrefs(undefined, "org-1")).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("engelli");
      },
      setItem: () => {
        throw new Error("dolu");
      },
    };
    expect(readTrackingPrefs(broken, "org-1")).toBeNull();
    expect(
      writeTrackingPrefs(broken, "org-1", { criterion: "overall", limits: {} })
    ).toBe(false);
    warn.mockRestore();
  });
});
