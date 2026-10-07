import { describe, expect, it } from "vitest";
import {
  removeLegacyAuthTokens,
  TAB_ID_STORAGE_KEY,
  tabAuthStorageKey,
} from "./tabSessionKey";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
    data,
  };
}

describe("tabAuthStorageKey", () => {
  it("iki ayrı sekme iki ayrı anahtar alır (duyuru kanalı ayrılır)", () => {
    const a = tabAuthStorageKey(memoryStorage(), () => "a1");
    const b = tabAuthStorageKey(memoryStorage(), () => "b2");
    expect(a).toBe("orbit-oturum-a1");
    expect(b).toBe("orbit-oturum-b2");
    expect(a).not.toBe(b);
  });

  it("aynı sekme yenilenince aynı anahtarı kullanır (oturum kalır)", () => {
    const storage = memoryStorage();
    const ilk = tabAuthStorageKey(storage, () => "x9");
    const yenileme = tabAuthStorageKey(storage, () => "yeni");
    expect(yenileme).toBe(ilk);
    expect(storage.data.get(TAB_ID_STORAGE_KEY)).toBe("x9");
  });

  it("sekme belleği kullanılamazsa yine sekmeye özgü anahtar üretir", () => {
    const bozuk = {
      getItem: () => {
        throw new Error("erişim yok");
      },
      setItem: () => undefined,
    };
    expect(tabAuthStorageKey(bozuk, () => "z1")).toBe("orbit-oturum-z1");
  });
});

describe("removeLegacyAuthTokens", () => {
  it("yalnız eski ortak anahtarlı jetonu siler", () => {
    const storage = memoryStorage({
      "sb-vlduk-auth-token": "{}",
      "orbit-oturum-a1": "{}",
      "orbit:last-activity": "1",
    });
    removeLegacyAuthTokens(storage);
    expect(Array.from(storage.data.keys()).sort()).toEqual([
      "orbit-oturum-a1",
      "orbit:last-activity",
    ]);
  });
});
