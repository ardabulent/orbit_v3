import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPERATOR_LIMIT,
  DEFAULT_ORGANIZATION_LIMIT,
  createOrganizationErrorMessage,
  loadAuditEvents,
  loadOperators,
  loadOrganizations,
  organizationNotEmptyMessage,
} from "./platformService";

const fromMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
  },
}));

describe("organizationNotEmptyMessage", () => {
  it("engelleyen tabloları ve kayıt sayılarını mesaja yazar", () => {
    const message = organizationNotEmptyMessage([
      { table: "students", rows: 12 },
      { table: "classes", rows: 3 },
    ]);

    expect(message).toContain("students (12 kayıt)");
    expect(message).toContain("classes (3 kayıt)");
  });

  // Gerekçeyi gösterememek, silmeye izin vermek için sebep değildir: liste
  // hangi biçimde bozulursa bozulsun reddin kendisi bildirilmeye devam eder.
  it("liste okunamadığında reddi yine de bildirir", () => {
    const base = createOrganizationErrorMessage("organization_not_empty");

    expect(organizationNotEmptyMessage(null)).toBe(base);
    expect(organizationNotEmptyMessage([])).toBe(base);
    expect(organizationNotEmptyMessage("bozuk")).toBe(base);
    expect(organizationNotEmptyMessage([{ tablo: "students" }])).toBe(base);
  });

  it("okunabilen satırları alır, bozuk olanları atar", () => {
    const message = organizationNotEmptyMessage([
      { table: "exams", rows: 4 },
      { table: "payments", rows: "çok" },
    ]);

    expect(message).toContain("exams (4 kayıt)");
    expect(message).not.toContain("payments");
  });

  // "Tekrar deneyin" burada yanlış tavsiyedir: kayıtlar durdukça her deneme
  // reddedilir. Genel silme hatasından ayrı bir metin taşıdığı sabitleniyor.
  it("genel silme hatasıyla aynı metni taşımaz", () => {
    expect(createOrganizationErrorMessage("organization_not_empty")).not.toBe(
      createOrganizationErrorMessage("organization_delete_failed")
    );
    expect(
      createOrganizationErrorMessage("organization_not_empty")
    ).not.toMatch(/tekrar deneyin/i);
  });
});

describe("loadAuditEvents (v1.3-06 cursor pagination)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupPlatformAuditMocks(options: {
    rows?: Array<{
      id: number;
      actor_user_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      organization_id: string | null;
      created_at: string;
    }>;
    error?: Error | null;
  }) {
    const orderSpy = vi.fn();
    const ltSpy = vi.fn();
    const limitSpy = vi.fn();

    fromMock.mockImplementation((table: string) => {
      if (table === "platform_audit_events") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn((col: string, opts: { ascending: boolean }) => {
          orderSpy(col, opts);
          return chain;
        });
        chain.lt = vi.fn((col: string, val: number) => {
          ltSpy(col, val);
          return chain;
        });
        chain.limit = vi.fn((n: number) => {
          limitSpy(n);
          return Promise.resolve({
            data: options.error ? null : (options.rows ?? []),
            error: options.error ?? null,
          });
        });
        return chain;
      }
      if (table === "profiles") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockResolvedValue({
          data: [{ id: "user-1", display_name: "Kerem Aydın" }],
          error: null,
        });
        return chain;
      }
      if (table === "organizations") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockResolvedValue({
          data: [{ id: "org-1", name: "Örnek Akademi" }],
          error: null,
        });
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    return { orderSpy, ltSpy, limitSpy };
  }

  it("⛔ sorgu created_at'e göre sıralamaz; id'ye göre azalan sırada sıralar", async () => {
    const { orderSpy } = setupPlatformAuditMocks({ rows: [] });

    await loadAuditEvents(50);

    expect(orderSpy).toHaveBeenCalledWith("id", { ascending: false });
    expect(orderSpy).not.toHaveBeenCalledWith("created_at", expect.anything());
  });

  it("⛔ ilk sayfada .lt() çağrılmaz; ikinci sayfada imleçle çağrılır", async () => {
    const { ltSpy } = setupPlatformAuditMocks({ rows: [] });

    // İlk sayfa
    await loadAuditEvents(50);
    expect(ltSpy).not.toHaveBeenCalled();

    // İkinci sayfa (cursor: 990)
    await loadAuditEvents(50, 990);
    expect(ltSpy).toHaveBeenCalledWith("id", 990);
  });

  it("sunucudan limit + 1 satır istenir", async () => {
    const { limitSpy } = setupPlatformAuditMocks({ rows: [] });

    await loadAuditEvents(50);
    expect(limitSpy).toHaveBeenCalledWith(51);

    await loadAuditEvents(20);
    expect(limitSpy).toHaveBeenCalledWith(21);
  });

  it("limit + 1 satır geldiğinde: dönen satır sayısı limit, nextCursor son satırın id'sidir", async () => {
    const mockRows = [100, 99, 98, 97].map(id => ({
      id,
      actor_user_id: "user-1",
      action: "platform.organization_created",
      entity_type: "organization",
      entity_id: `org-${id}`,
      organization_id: `org-${id}`,
      created_at: "2026-09-09T10:00:00Z",
    }));

    setupPlatformAuditMocks({ rows: mockRows });

    const result = await loadAuditEvents(3);

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].id).toBe(100);
    expect(result.rows[2].id).toBe(98);
    expect(result.nextCursor).toBe(98);
  });

  it("⛔ limit kadar ya da daha az satır geldiğinde nextCursor null'dır", async () => {
    const mockRows = [100, 99, 98].map(id => ({
      id,
      actor_user_id: "user-1",
      action: "platform.organization_created",
      entity_type: "organization",
      entity_id: `org-${id}`,
      organization_id: `org-${id}`,
      created_at: "2026-09-09T10:00:00Z",
    }));

    // Tam limit kadar satır
    setupPlatformAuditMocks({ rows: mockRows });
    const resultExact = await loadAuditEvents(3);
    expect(resultExact.rows).toHaveLength(3);
    expect(resultExact.nextCursor).toBeNull();

    // Limitten az satır
    setupPlatformAuditMocks({ rows: mockRows.slice(0, 1) });
    const resultLess = await loadAuditEvents(3);
    expect(resultLess.rows).toHaveLength(1);
    expect(resultLess.nextCursor).toBeNull();

    // Boş
    setupPlatformAuditMocks({ rows: [] });
    const resultEmpty = await loadAuditEvents(3);
    expect(resultEmpty.rows).toHaveLength(0);
    expect(resultEmpty.nextCursor).toBeNull();
  });
});

describe("loadOrganizations (3.E bounded query)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("varsayılan limit (100) uygulanır ve sınır dolduğunda truncated true döner", async () => {
    const limitSpy = vi.fn();
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: `org-${i}`,
      name: `Kurum ${i}`,
      slug: `kurum-${i}`,
      code: 1000 + i,
      archived_at: null,
      created_at: "2026-09-09T10:00:00Z",
    }));

    fromMock.mockImplementation((table: string) => {
      if (table === "organizations") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn((limit: number) => {
          limitSpy(limit);
          return Promise.resolve({ data: rows, error: null });
        });
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await loadOrganizations();

    expect(limitSpy).toHaveBeenCalledWith(DEFAULT_ORGANIZATION_LIMIT);
    expect(result.rows).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });

  it("sınır dolmadığında truncated false döner", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "organizations") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockResolvedValue({
          data: [
            {
              id: "org-1",
              name: "Kurum 1",
              slug: "kurum-1",
              code: 1001,
              archived_at: null,
              created_at: "2026-09-09T10:00:00Z",
            },
          ],
          error: null,
        });
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await loadOrganizations(100);

    expect(result.rows).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });
});

describe("loadOperators (3.E bounded query)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("varsayılan limit (50) uygulanır ve sınır dolduğunda truncated true döner", async () => {
    const limitSpy = vi.fn();
    const rows = Array.from({ length: 50 }, (_, i) => ({
      user_id: `user-${i}`,
      role: "operator",
      status: "active",
      note: null,
      created_at: "2026-09-09T10:00:00Z",
    }));

    fromMock.mockImplementation((table: string) => {
      if (table === "platform_operators") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn((limit: number) => {
          limitSpy(limit);
          return Promise.resolve({ data: rows, error: null });
        });
        return chain;
      }
      if (table === "profiles") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockResolvedValue({ data: [], error: null });
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await loadOperators();

    expect(limitSpy).toHaveBeenCalledWith(DEFAULT_OPERATOR_LIMIT);
    expect(result.rows).toHaveLength(50);
    expect(result.truncated).toBe(true);
  });

  it("sınır dolmadığında truncated false döner", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "platform_operators") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockResolvedValue({
          data: [
            {
              user_id: "user-1",
              role: "owner",
              status: "active",
              note: null,
              created_at: "2026-09-09T10:00:00Z",
            },
          ],
          error: null,
        });
        return chain;
      }
      if (table === "profiles") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockResolvedValue({ data: [], error: null });
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await loadOperators(50);

    expect(result.rows).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });
});
