import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import { AuditLogPage } from "@/components/education/pages/AuditLogPage";
import { auditKeys, useOrganizationAuditEvents } from "./auditQueries";
import { loadOrganizationAuditEvents } from "./auditService";

const mockUseInfiniteQuery = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: unknown) => mockUseInfiniteQuery(options),
  // Sayfa "Kim yaptı" süzgeci için kişi listesini de ister (2026-09-29).
  useQuery: () => ({ data: [] }),
}));

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("./auditService", async importOriginal => {
  const actual = await importOriginal<typeof import("./auditService")>();
  return {
    ...actual,
    loadOrganizationAuditEvents: vi.fn(),
  };
});

describe("auditKeys (K-19 ve Cache İzolasyonu)", () => {
  it("genel anahtar kökünü doğru üretir", () => {
    expect(auditKeys.all).toEqual(["audit"]);
  });

  it("kurum denetim kaydı anahtarı [alan, kaynak, kapsam] sözleşmesine uyar ve kurumu taşır", () => {
    const key = auditKeys.events("org-999");
    expect(key).toEqual([
      "audit",
      "events",
      {
        organizationId: "org-999",
        actorUserId: null,
        actionKind: null,
        entityType: null,
        from: null,
        to: null,
      },
    ]);
  });

  it("süzgeç anahtara girer: farklı süzgeç farklı önbellek demektir", () => {
    const hepsi = auditKeys.events("org-1");
    const guncellemeler = auditKeys.events("org-1", {
      actorUserId: null,
      actionKind: "updated",
      entityType: null,
      from: null,
      to: null,
    });
    expect(guncellemeler).not.toEqual(hepsi);
    expect(guncellemeler[2]).toMatchObject({
      organizationId: "org-1",
      actionKind: "updated",
    });
  });
});

describe("useOrganizationAuditEvents (TanStack useInfiniteQuery)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("kurum kimliği yokken sorgu çalıştırılmaz (enabled: false)", () => {
    mockUseAuth.mockReturnValue({
      identity: null,
    });

    useOrganizationAuditEvents();

    expect(mockUseInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        initialPageParam: null,
      })
    );
  });

  it("kurum kimliği varken sorgu useInfiniteQuery ile çalıştırılır (enabled: true)", () => {
    mockUseAuth.mockReturnValue({
      identity: {
        membership: { organizationId: "org-123" },
      },
    });

    useOrganizationAuditEvents();

    expect(mockUseInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: auditKeys.events("org-123"),
        enabled: true,
        initialPageParam: null,
        getNextPageParam: expect.any(Function),
      })
    );
  });

  it("getNextPageParam son sayfanın nextCursor değerini döndürür", () => {
    mockUseAuth.mockReturnValue({
      identity: {
        membership: { organizationId: "org-123" },
      },
    });

    useOrganizationAuditEvents();

    const options = mockUseInfiniteQuery.mock.calls[0][0];
    const getNextPageParam = options.getNextPageParam;

    expect(getNextPageParam({ rows: [], nextCursor: 1234 })).toBe(1234);
    expect(getNextPageParam({ rows: [], nextCursor: null })).toBeNull();
  });

  it("queryFn verilen limit ve pageParam (imleç) ile loadOrganizationAuditEvents çağırır", async () => {
    mockUseAuth.mockReturnValue({
      identity: {
        membership: { organizationId: "org-123" },
      },
    });

    useOrganizationAuditEvents({ limit: 25 });

    const options = mockUseInfiniteQuery.mock.calls[0][0];
    await options.queryFn({ pageParam: 555 });

    expect(loadOrganizationAuditEvents).toHaveBeenCalledWith(
      "org-123",
      25,
      555,
      expect.objectContaining({ actionKind: null })
    );
  });
});

describe("AuditLogPage UI rendering (v1.3-06 pagination)", () => {
  it("hasNextPage true iken 'Daha fazla yükle' düğmesi çizilir", () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            rows: [
              {
                id: 1,
                actor: { kind: "member", name: "Ayşe Yılmaz" },
                action: "membership.created",
                entityType: "organization_membership",
                entityId: "id-1",
                createdAt: "2026-09-09T10:00:00Z",
                label: null,
                changed: [],
              },
            ],
            nextCursor: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    const html = renderToStaticMarkup(createElement(AuditLogPage));
    expect(html).toContain("Daha fazla yükle");
    expect(html).not.toContain("Liste üst sınıra");
  });

  it("⛔ hasNextPage false (nextCursor null) iken 'Daha fazla yükle' çizilmez ve kesilme bandı da çizilmez", () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            rows: [
              {
                id: 1,
                actor: { kind: "member", name: "Ayşe Yılmaz" },
                action: "membership.created",
                entityType: "organization_membership",
                entityId: "id-1",
                createdAt: "2026-09-09T10:00:00Z",
                label: null,
                changed: [],
              },
            ],
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    const html = renderToStaticMarkup(createElement(AuditLogPage));
    expect(html).not.toContain("Daha fazla yükle");
    expect(html).not.toContain("Liste üst sınıra");
  });

  it("sonraki sayfa yüklenirken (isFetchingNextPage: true) mevcut satırlar ekranda kalır ve düğme 'Yükleniyor…' olur", () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            rows: [
              {
                id: 1,
                actor: { kind: "member", name: "Ayşe Yılmaz" },
                action: "membership.created",
                entityType: "organization_membership",
                entityId: "id-1",
                createdAt: "2026-09-09T10:00:00Z",
                label: null,
                changed: [],
              },
            ],
            nextCursor: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: true,
    });

    const html = renderToStaticMarkup(createElement(AuditLogPage));
    expect(html).toContain("Ayşe Yılmaz");
    expect(html).toContain("Yükleniyor…");
    expect(html).toContain("disabled");
  });
});

describe("AuditLogPage kayıt adı ve süzgeç (2026-09-29)", () => {
  it("satırda kaydın adı ve değişen alanların Türkçe adı görünür", () => {
    mockUseAuth.mockReturnValue({
      identity: { membership: { organizationId: "org-1" } },
    });
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            rows: [
              {
                id: 9,
                actor: { kind: "member", name: "Ali Veli" },
                action: "guardian.updated",
                entityType: "guardian",
                entityId: "g1",
                createdAt: "2026-09-29T10:00:00Z",
                label: "Ayşe Koç",
                changed: ["phone", "full_name"],
              },
            ],
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    const html = renderToStaticMarkup(createElement(AuditLogPage));

    expect(html).toContain("Veli güncellendi");
    expect(html).toContain("Ayşe Koç");
    expect(html).toContain("Telefon, Ad soyad");
    expect(html).toContain("değişti");
    // Süzgeç çubuğu
    expect(html).toContain("Kim yaptı");
    expect(html).toContain("İşlem türü");
    expect(html).toContain("Kayıt türü");
    expect(html).toContain("Başlangıç");
  });
});
