import { describe, expect, it, vi } from "vitest";
import { PagedReadError, READ_PAGE_SIZE, readAllPages } from "./pagedRead";

const source = (n: number) => Array.from({ length: n }, (_, i) => i);

const pager = (rows: number[]) =>
  vi.fn((from: number, to: number) =>
    Promise.resolve({ data: rows.slice(from, to + 1), error: null })
  );

describe("sayfalı okuma (2026-10-05)", () => {
  it("sayfa boyu sunucu tavanının (1000) altında", () => {
    expect(READ_PAGE_SIZE).toBeLessThan(1000);
  });

  it("bütün satırları sayfa sayfa toplar, son yarım sayfada durur", async () => {
    const fetchPage = pager(source(1234));
    const result = await readAllPages<number>(fetchPage, 5000);
    expect(result.rows).toHaveLength(1234);
    expect(result.truncated).toBe(false);
    expect(fetchPage.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
  });

  it("tam sayfa bitince bir boş sayfa daha sorar (kesilmeyi sezmek için)", async () => {
    const fetchPage = pager(source(1000));
    const result = await readAllPages<number>(fetchPage, 5000);
    expect(result.rows).toHaveLength(1000);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("toplam tavana ulaşınca durur ve kesildiğini söyler", async () => {
    const result = await readAllPages<number>(pager(source(800)), 600);
    expect(result.rows).toHaveLength(600);
    expect(result.truncated).toBe(true);
  });

  it("hata özgün hatayı taşıyarak fırlatılır", async () => {
    const boom = { code: "42501" };
    await expect(
      readAllPages(() => Promise.resolve({ data: null, error: boom }), 100)
    ).rejects.toMatchObject({ cause: boom });
    await expect(
      readAllPages(() => Promise.resolve({ data: null, error: boom }), 100)
    ).rejects.toBeInstanceOf(PagedReadError);
  });
});
