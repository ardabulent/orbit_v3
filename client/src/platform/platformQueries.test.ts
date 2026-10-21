import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import { PlatformAuditLog } from "./PlatformAuditLog";
import { PlatformOperators } from "./PlatformOperators";
import { PlatformOrganizations } from "./PlatformOrganizations";
import {
  platformKeys,
  useOrganizationStats,
  usePlatformAuditEvents,
  usePlatformOperators,
  usePlatformOrganizations,
} from "./platformQueries";

const mockUseQuery = vi
  .fn()
  .mockReturnValue({ data: null, isLoading: false, isError: false });
const mockUseInfiniteQuery = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useInfiniteQuery: (options: unknown) => mockUseInfiniteQuery(options),
}));

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("platformKeys (K-19 ve Cache İzolasyonu)", () => {
  it("genel anahtar kökünü doğru üretir", () => {
    expect(platformKeys.all).toEqual(["platform"]);
  });

  it("kurum listesi anahtarı [alan, kaynak, kapsam] sözleşmesine uyar ve platform kapsamı taşır", () => {
    const key = platformKeys.organizations();
    expect(key).toEqual(["platform", "organizations", { scope: "platform" }]);
  });

  it("operatör listesi anahtarı [alan, kaynak, kapsam] sözleşmesine uyar ve platform kapsamı taşır", () => {
    const key = platformKeys.operators();
    expect(key).toEqual(["platform", "operators", { scope: "platform" }]);
  });

  it("platform denetim kaydı anahtarı [alan, kaynak, kapsam] sözleşmesine uyar ve platform kapsamı taşır", () => {
    const key = platformKeys.auditEvents();
    expect(key).toEqual(["platform", "auditEvents", { scope: "platform" }]);
  });

  it("kurum istatistikleri anahtarı [alan, kaynak, kapsam] sözleşmesine uyar ve kurumu taşır", () => {
    const key = platformKeys.organizationStats("org-123");
    expect(key).toEqual([
      "platform",
      "organizationStats",
      { organizationId: "org-123" },
    ]);
  });

  it("farklı kurumlar için farklı sorgu anahtarları üretir (operatörün farklı kurum sayılarını görmesi engellenir)", () => {
    const key1 = platformKeys.organizationStats("org-a");
    const key2 = platformKeys.organizationStats("org-b");
    expect(key1).not.toEqual(key2);
  });
});

describe("platformQueries enabled kapıları", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("operatör değilken platform sorguları çalışmaz (enabled: false)", () => {
    mockUseAuth.mockReturnValue({
      identity: { platformOperator: null },
      demoMode: false,
    });

    usePlatformOrganizations();
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: platformKeys.organizations(),
        enabled: false,
      })
    );

    usePlatformOperators();
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: platformKeys.operators(),
        enabled: false,
      })
    );

    usePlatformAuditEvents();
    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: platformKeys.auditEvents(),
        enabled: false,
        initialPageParam: null,
      })
    );
  });

  it("operatör iken platform sorguları çalışır (enabled: true)", () => {
    mockUseAuth.mockReturnValue({
      identity: { platformOperator: { role: "operator" } },
      demoMode: false,
    });

    usePlatformOrganizations();
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: platformKeys.organizations(),
        enabled: true,
      })
    );

    usePlatformOperators();
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: platformKeys.operators(),
        enabled: true,
      })
    );

    usePlatformAuditEvents();
    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: platformKeys.auditEvents(),
        enabled: true,
        initialPageParam: null,
        getNextPageParam: expect.any(Function),
      })
    );

    const callArgs = mockUseInfiniteQuery.mock.calls[0][0];
    expect(callArgs.getNextPageParam({ rows: [], nextCursor: 888 })).toBe(888);
    expect(
      callArgs.getNextPageParam({ rows: [], nextCursor: null })
    ).toBeNull();
  });

  it("options.enabled: false verildiğinde sorgu durdurulur", () => {
    mockUseAuth.mockReturnValue({
      identity: { platformOperator: { role: "operator" } },
      demoMode: false,
    });

    usePlatformOrganizations({ enabled: false });
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it("kurum istatistikleri: kurum kimliği yokken veya operatör değilken çalışmaz", () => {
    // 1. Durum: Operatör ama kurum kimliği yok/boş
    mockUseAuth.mockReturnValue({
      identity: { platformOperator: { role: "operator" } },
      demoMode: false,
    });
    useOrganizationStats(undefined);
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );

    // 2. Durum: Kurum kimliği var ama kullanıcı operatör değil
    mockUseAuth.mockReturnValue({
      identity: { platformOperator: null },
      demoMode: false,
    });
    useOrganizationStats("org-123");
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );

    // 3. Durum: Hem operatör hem kurum kimliği var
    mockUseAuth.mockReturnValue({
      identity: { platformOperator: { role: "operator" } },
      demoMode: false,
    });
    useOrganizationStats("org-123");
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: platformKeys.organizationStats("org-123"),
        enabled: true,
      })
    );
  });
});

describe("PlatformAuditLog UI pagination", () => {
  const dummyEvents = [
    {
      id: 10,
      actorUserId: "u-1",
      actorName: "Kerem Aydın",
      action: "platform.organization_created",
      entityType: "organization",
      entityId: "org-1",
      organizationId: "org-1",
      organizationName: "Boğaziçi Eğitim",
      createdAt: "2026-09-09T10:00:00Z",
    },
  ];

  it("hasNextPage true iken 'Daha fazla yükle' düğmesi çizilir", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformAuditLog, {
        events: dummyEvents,
        hasNextPage: true,
      })
    );
    expect(html).toContain("Daha fazla yükle");
    expect(html).not.toContain("Liste üst sınıra");
  });

  it("⛔ hasNextPage false iken 'Daha fazla yükle' çizilmez ve kesilme bandı da çizilmez", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformAuditLog, {
        events: dummyEvents,
        hasNextPage: false,
      })
    );
    expect(html).not.toContain("Daha fazla yükle");
    expect(html).not.toContain("Liste üst sınıra");
  });

  it("isFetchingNextPage true iken düğme 'Yükleniyor…' olur ve mevcut satırlar ekranda kalır", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformAuditLog, {
        events: dummyEvents,
        hasNextPage: true,
        isFetchingNextPage: true,
      })
    );
    expect(html).toContain("Boğaziçi Eğitim");
    expect(html).toContain("Yükleniyor…");
    expect(html).toContain("disabled");
  });
});

describe("PlatformOrganizations UI (3.E bounded list)", () => {
  it("truncated true iken amber bant (100 kayıt) çizilir", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformOrganizations, {
        organizations: [
          {
            id: "org-1",
            name: "Dershane A",
            slug: "dershane-a",
            code: 1001,
            archivedAt: null,
            createdAt: "2026-09-09T10:00:00Z",
          },
        ],
        onCreated: vi.fn(),
        truncated: true,
        limit: 100,
      })
    );
    expect(html).toContain("Liste üst sınıra (100 kayıt) ulaştı.");
  });

  it("truncated false iken kesilme bandı çizilmez", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformOrganizations, {
        organizations: [
          {
            id: "org-1",
            name: "Dershane A",
            slug: "dershane-a",
            code: 1001,
            archivedAt: null,
            createdAt: "2026-09-09T10:00:00Z",
          },
        ],
        onCreated: vi.fn(),
        truncated: false,
      })
    );
    expect(html).not.toContain("Liste üst sınıra");
  });
});

describe("PlatformOperators UI (3.E bounded list)", () => {
  it("truncated true iken amber bant (50 kayıt) çizilir", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformOperators, {
        operators: [
          {
            userId: "u-1",
            displayName: "Kerem Aydın",
            role: "owner",
            status: "active",
            note: null,
            createdAt: "2026-09-09T10:00:00Z",
          },
        ],
        truncated: true,
        limit: 50,
      })
    );
    expect(html).toContain("Liste üst sınıra (50 kayıt) ulaştı.");
  });

  it("truncated false iken kesilme bandı çizilmez", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformOperators, {
        operators: [
          {
            userId: "u-1",
            displayName: "Kerem Aydın",
            role: "owner",
            status: "active",
            note: null,
            createdAt: "2026-09-09T10:00:00Z",
          },
        ],
        truncated: false,
      })
    );
    expect(html).not.toContain("Liste üst sınıra");
  });
});
