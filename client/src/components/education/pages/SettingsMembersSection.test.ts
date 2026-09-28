import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "@/auth/AuthContext";
import type { AuthContextValue } from "@/auth/types";
import type { EducationRole } from "@/components/educationAccess";
import {
  SettingsMembersSection,
  ChangeRoleDialog,
  RemoveMemberDialog,
} from "./SettingsMembersSection";
import { MemberCreateDialog } from "./MemberCreateDialog";
import type { OrganizationMember } from "@/organization/memberService";
import { translateMembershipActionError } from "@/organization/memberService";
import { useSettingsMembers } from "@/settings/settingsQueries";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/settings/settingsQueries", () => ({
  useSettingsMembers: vi.fn(),
  useSettingsBranches: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  }),
  settingsKeys: {
    members: (orgId: string) => ["settings", "members", orgId],
    all: ["settings"],
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children?: React.ReactNode;
    open?: boolean;
  }) =>
    createElement(
      "div",
      { "data-slot": "dialog", "data-open": open },
      open ? children : null
    ),
  DialogContent: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-content" }, children),
  DialogHeader: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-header" }, children),
  DialogTitle: ({ children }: { children?: React.ReactNode }) =>
    createElement("h2", { "data-slot": "dialog-title" }, children),
  DialogDescription: ({ children }: { children?: React.ReactNode }) =>
    createElement("p", { "data-slot": "dialog-description" }, children),
  DialogFooter: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-footer" }, children),
  useDialogComposition: () => ({
    isComposing: () => false,
    setComposing: () => {},
    justEndedComposing: () => false,
    markCompositionEnd: () => {},
  }),
}));

function renderWithAuth(
  ui: React.ReactElement,
  options?: {
    role?: EducationRole;
    userId?: string;
    membershipId?: string;
    orgId?: string;
  }
) {
  const queryClient = new QueryClient();
  const dummyAuth: AuthContextValue = {
    identity: {
      user: {
        id: options?.userId ?? "usr-admin",
        email: "admin@orbit.local",
        phone: null,
        created_at: "",
      },
      membership: {
        id: options?.membershipId ?? "mem-admin",
        membershipId: options?.membershipId ?? "mem-admin",
        role: options?.role ?? "admin",
        organizationId: options?.orgId ?? "org-1",
      },
    } as unknown as AuthContextValue["identity"],
    loading: false,
    demoMode: false,
    passwordRecovery: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    switchDemoRole: vi.fn(),
    requestPasswordReset: vi.fn(),
    completePasswordReset: vi.fn(),
    cancelPasswordRecovery: vi.fn(),
    completeRequiredPasswordChange: vi.fn(),
    refreshIdentity: vi.fn(),
  };

  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AuthContext.Provider, { value: dummyAuth }, ui)
    )
  );
}

const mockMembers: OrganizationMember[] = [
  {
    membershipId: "mem-admin",
    displayName: "Ali Yönetici",
    loginNumber: "10011000",
    role: "admin",
    branchName: null,
    status: "active",
  },
  {
    membershipId: "mem-teacher",
    displayName: "Ayşe Öğretmen",
    loginNumber: "10011001",
    role: "teacher",
    branchName: "Merkez",
    status: "active",
  },
  {
    membershipId: "mem-student",
    displayName: "Mehmet Öğrenci",
    loginNumber: "10011002",
    role: "student",
    branchName: "Merkez",
    status: "active",
    linkedPerson: { type: "student", id: "stu-1", name: "Mehmet Öğrenci" },
  },
  {
    membershipId: "mem-parent",
    displayName: "Fatma Veli",
    loginNumber: "10011003",
    role: "parent",
    branchName: "Merkez",
    status: "active",
    linkedPerson: { type: "guardian", id: "g-1", name: "Fatma Veli" },
  },
  {
    membershipId: "mem-suspended",
    displayName: "Kemal Yılmaz",
    loginNumber: "10011004",
    role: "teacher",
    branchName: null,
    status: "suspended",
  },
];

describe("SettingsMembersSection (v1.4-07 · #280)", () => {
  beforeEach(() => {
    vi.mocked(useSettingsMembers).mockReturnValue({
      data: mockMembers,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSettingsMembers>);
  });

  it("suspended üyelik listede görünmeye devam eder ve 'Askıda' rozeti çizilir (K-22)", () => {
    const html = renderWithAuth(createElement(SettingsMembersSection));

    expect(html).toContain("Kemal Yılmaz");
    expect(html).toContain("Askıda");
  });

  it("yönetici rolünde normal üye satırlarında 'Rol değiştir' ve 'Kurumdan çıkar' düğmeleri çizilir", () => {
    const html = renderWithAuth(createElement(SettingsMembersSection), {
      role: "admin",
      membershipId: "mem-other-admin",
    });

    expect(html).toContain("Rol değiştir");
    expect(html).toContain("Kurumdan çıkar");
  });

  // ⚠️ Bu iddia 2026-09-13'te TERSİNE döndü (v1.4-08, #282).
  // v1.4-07'de yönetici hedefinde eylemler çizilmiyordu ("kapsamı v1.4-08");
  // artık yönetici devri ve çoklu yönetici meşru olduğu için başka bir yöneticinin
  // rolü değiştirilebilir veya kurumdan çıkarılabilir (son yönetici koruması ORB06 sunucuda).
  it("hedef bir yönetici (admin) olduğunda rol değiştirme ve çıkarma eylemleri ÇİZİLİR (v1.4-08 · #282)", () => {
    // Yalnızca admin olan bir liste sunuyoruz
    vi.mocked(useSettingsMembers).mockReturnValue({
      data: [
        {
          membershipId: "mem-target-admin",
          displayName: "Başka Yönetici",
          loginNumber: "10019999",
          role: "admin",
          branchName: null,
          status: "active",
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSettingsMembers>);

    const html = renderWithAuth(createElement(SettingsMembersSection), {
      role: "admin",
      membershipId: "mem-caller-admin",
    });

    expect(html).toContain("Başka Yönetici");
    // Admin hedefinde artık bu eylemler çizilir
    expect(html).toContain("Rol değiştir");
    expect(html).toContain("Kurumdan çıkar");
  });

  // ⚠️ Bu iddia 2026-09-13'te TERSİNE döndü (v1.4-08, #282).
  // v1.4-07'de yöneticinin kendi satırında eylemler çizilmiyordu ("çağıran kendini hedef alamaz");
  // oysa yönetici devri tam olarak yöneticinin kendi satırından rolünü indirmesiyle yapılır.
  // Bu nedenle kendi satırında da eylemler çizilir.
  it("kullanıcı kendi üyeliğini hedef aldığında rol değiştirme ve çıkarma eylemleri ÇİZİLİR (v1.4-08 · #282)", () => {
    vi.mocked(useSettingsMembers).mockReturnValue({
      data: [
        {
          membershipId: "mem-self",
          displayName: "Kendim",
          loginNumber: "10018888",
          role: "teacher",
          branchName: null,
          status: "active",
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSettingsMembers>);

    const html = renderWithAuth(createElement(SettingsMembersSection), {
      role: "admin",
      membershipId: "mem-self", // çağıranın kendi membershipId'si
    });

    expect(html).toContain("Kendim");
    expect(html).toContain("Rol değiştir");
    expect(html).toContain("Kurumdan çıkar");
  });

  it("yönetici olmayan rolde (ör. teacher) bu eylemler hiçbir satırda ÇİZİLMEZ", () => {
    const html = renderWithAuth(createElement(SettingsMembersSection), {
      role: "teacher",
      membershipId: "mem-teacher",
    });

    expect(html).not.toContain("Rol değiştir");
    expect(html).not.toContain("Kurumdan çıkar");
  });
});

describe("ChangeRoleDialog (v1.4-07 · #280, v1.4-08 · #282)", () => {
  const teacherMember: OrganizationMember = {
    membershipId: "mem-t1",
    displayName: "Ayşe Öğretmen",
    loginNumber: "10011001",
    role: "teacher",
    branchName: "Merkez",
    status: "active",
  };

  const adminMember: OrganizationMember = {
    membershipId: "mem-a1",
    displayName: "Ali Yönetici",
    loginNumber: "10011000",
    role: "admin",
    branchName: null,
    status: "active",
  };

  // ⚠️ Bu iddia 2026-09-13'te TERSİNE döndü (v1.4-08, #282).
  // v1.4-07'de admin rolü seçicide gizlenmişti;
  // v1.4-08 ile yönetici devri ve çoklu yönetici (terfi) amacıyla admin rolü seçilebilir bir değer olarak sunulur.
  it("admin rolü seçilebilir bir değer olarak ChangeRoleDialog seçicisinde SUNULUR (v1.4-08 · #282)", () => {
    const html = renderWithAuth(
      createElement(ChangeRoleDialog, {
        member: teacherMember,
        open: true,
        onClose: vi.fn(),
      })
    );

    // Seçeneklerde hem admin hem de diğer roller olmalı
    expect(html).toContain('value="admin"');
    expect(html).toContain("Yönetici");
    expect(html).toContain('value="teacher"');
    expect(html).toContain('value="student"');
    expect(html).toContain('value="parent"');
  });

  it("kendi rolünü değiştirme onayında 'yöneticiliği bırakıyorsunuz' uyarısı VARDIR (v1.4-08 · #282)", () => {
    // Admin olan yönetici kendi rolünü teacher yaparken uyarı çizilmeli
    const html = renderWithAuth(
      createElement(ChangeRoleDialog, {
        member: adminMember,
        open: true,
        onClose: vi.fn(),
        isSelf: true,
      })
    );

    // Başlangıçta teacher seçildiğinden veya admin dışında bir role geçtiğinden:
    // adminMember.role === "admin", default state teacher veya admin harici seçildiğinde uyarı çıkar
    expect(html).toContain("Yöneticiliği bırakıyorsunuz");
    expect(html).toContain(
      "Bu işlemden sonra üye yönetimi yetkiniz kalmayacak ve rolünüzü yalnız başka bir yönetici geri verebilecek."
    );
  });

  it("başkasının rolünü değiştirirken 'yöneticiliği bırakıyorsunuz' uyarısı KESİNLİKLE YOKTUR", () => {
    const html = renderWithAuth(
      createElement(ChangeRoleDialog, {
        member: teacherMember,
        open: true,
        onClose: vi.fn(),
        isSelf: false,
      })
    );

    expect(html).not.toContain("Yöneticiliği bırakıyorsunuz");
    expect(html).not.toContain(
      "Bu işlemden sonra üye yönetimi yetkiniz kalmayacak"
    );
  });

  it("ORB06 geldiğinde ekran 'önce başka birini yönetici yapın' der ve kırmızı hata olarak gösterir (K-23)", () => {
    const orb06Message = translateMembershipActionError(
      { code: "ORB06" },
      "change_role",
      { isSelf: true }
    );

    const html = renderWithAuth(
      createElement(ChangeRoleDialog, {
        member: adminMember,
        open: true,
        onClose: vi.fn(),
        initialError: orb06Message,
      })
    );

    // Kırmızı hata kutusu role="alert" ve data-testid="change-role-error" ile çizilir (nötr bilgi değil)
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-testid="change-role-error"');
    expect(html).toContain("Rol değiştirilemedi");
    expect(html).toContain("önce başka bir üyeyi yönetici yapın");
    expect(html).toContain("Kurumun tek yöneticisisiniz");
  });

  it("ORB03 geldiğinde ekran atama sayılarını söyler ve ham detail dizgesini basmaz (K-23)", () => {
    const rawDetail = "ders ataması=2, rehberlik=1, program satırı=0";
    const orb03Message = translateMembershipActionError({
      code: "ORB03",
      detail: rawDetail,
    });

    const html = renderWithAuth(
      createElement(ChangeRoleDialog, {
        member: teacherMember,
        open: true,
        onClose: vi.fn(),
        initialError: orb03Message,
      })
    );

    // K-23: Ham detail dizgesi basılmaz
    expect(html).not.toContain(rawDetail);
    // Atama sayıları Türkçe insani bir dille okunur
    expect(html).toContain("2 ders ataması");
    expect(html).toContain("1 rehberlik görevi");
    expect(html).toContain("sınıf yönetiminden ilgili atamaları arşivleyin");
    expect(html).toContain('role="alert"');
  });
});

describe("RemoveMemberDialog (v1.4-07 · #280)", () => {
  const teacherMember: OrganizationMember = {
    membershipId: "mem-t1",
    displayName: "Ayşe Öğretmen",
    loginNumber: "10011001",
    role: "teacher",
    branchName: "Merkez",
    status: "active",
  };

  const studentMember: OrganizationMember = {
    membershipId: "mem-s1",
    displayName: "Mehmet Öğrenci",
    loginNumber: "10011002",
    role: "student",
    branchName: "Merkez",
    status: "active",
  };

  const parentMember: OrganizationMember = {
    membershipId: "mem-p1",
    displayName: "Fatma Veli",
    loginNumber: "10011003",
    role: "parent",
    branchName: "Merkez",
    status: "active",
  };

  it("öğretmen çıkarma onayında 'Üyelik askıya alınacak; kişi kuruma giriş yapamayacak.' yazar, bağ koparma cümlesi YOKTUR (K-23)", () => {
    const html = renderWithAuth(
      createElement(RemoveMemberDialog, {
        member: teacherMember,
        open: true,
        onClose: vi.fn(),
      })
    );

    expect(html).toContain(
      "Üyelik askıya alınacak; kişi kuruma giriş yapamayacak."
    );
    expect(html).not.toContain("akademik kaydının hesap bağı koparılacak");
  });

  it("öğrenci çıkarma onayında 'akademik kaydının hesap bağı koparılacak' uyarısı VARDIR (K-23)", () => {
    const html = renderWithAuth(
      createElement(RemoveMemberDialog, {
        member: studentMember,
        open: true,
        onClose: vi.fn(),
      })
    );

    expect(html).toContain("Üyelik askıya alınacak");
    expect(html).toContain("akademik kaydının hesap bağı koparılacak");
    expect(html).toContain("Kayıt silinmiyor; istenirse yeniden bağlanabilir.");
  });

  it("veli çıkarma onayında 'akademik kaydının hesap bağı koparılacak' uyarısı VARDIR", () => {
    const html = renderWithAuth(
      createElement(RemoveMemberDialog, {
        member: parentMember,
        open: true,
        onClose: vi.fn(),
      })
    );

    expect(html).toContain("akademik kaydının hesap bağı koparılacak");
  });

  it("admin hedefinde çıkarma onayında 'akademik kaydının hesap bağı koparılacak' uyarısı KESİNLİKLE YER ALMAZ (K-23)", () => {
    const adminMember: OrganizationMember = {
      membershipId: "mem-a1",
      displayName: "Ali Yönetici",
      loginNumber: "10011000",
      role: "admin",
      branchName: null,
      status: "active",
    };

    const html = renderWithAuth(
      createElement(RemoveMemberDialog, {
        member: adminMember,
        open: true,
        onClose: vi.fn(),
      })
    );

    expect(html).not.toContain("akademik kaydının hesap bağı koparılacak");
    expect(html).toContain(
      "Üyelik askıya alınacak; kişi kuruma giriş yapamayacak."
    );
  });

  it("kendi üyeliğini (admin) çıkarma onayında yöneticilik ve kurumu bırakma uyarısı VARDIR (v1.4-08 · #282)", () => {
    const adminMember: OrganizationMember = {
      membershipId: "mem-a1",
      displayName: "Ali Yönetici",
      loginNumber: "10011000",
      role: "admin",
      branchName: null,
      status: "active",
    };

    const html = renderWithAuth(
      createElement(RemoveMemberDialog, {
        member: adminMember,
        open: true,
        onClose: vi.fn(),
        isSelf: true,
      })
    );

    expect(html).toContain("Yöneticiliği ve kurumu bırakıyorsunuz");
    expect(html).not.toContain("akademik kaydının hesap bağı koparılacak");
  });

  it("RemoveMemberDialog ORB06 geldiğinde ekran tek yönetici uyarısını kırmızı hata olarak gösterir (K-23)", () => {
    const adminMember: OrganizationMember = {
      membershipId: "mem-a1",
      displayName: "Ali Yönetici",
      loginNumber: "10011000",
      role: "admin",
      branchName: null,
      status: "active",
    };
    const orb06Message = translateMembershipActionError(
      { code: "ORB06" },
      "remove"
    );

    const html = renderWithAuth(
      createElement(RemoveMemberDialog, {
        member: adminMember,
        open: true,
        onClose: vi.fn(),
        initialError: orb06Message,
      })
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('data-testid="remove-member-error"');
    expect(html).toContain("Üye çıkarılamadı");
    expect(html).toContain("Kurumun tek yöneticisi kurumdan çıkarılamaz");
    expect(html).toContain("Önce başka bir üyeyi yönetici yapın");
  });
});

describe("MemberCreateDialog admin kısıtı (v1.4-08 · #282)", () => {
  it("üye ekleme ekranında admin rolü HÂLÂ SUNULMAZ (internal_create_membership kısıtı)", () => {
    const html = renderWithAuth(
      createElement(MemberCreateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
      })
    );

    // Üye eklemede yalnızca öğretmen, öğrenci, veli seçilebilir; admin sunulmaz
    expect(html).toContain('value="teacher"');
    // 2026-09-28: öğrenci ve veli hesabı yalnız "Yeni öğrenci" akışından,
    // kayıtla birlikte açılır (C-05).
    expect(html).not.toContain('value="student"');
    expect(html).not.toContain('value="parent"');
    expect(html).not.toContain('value="admin"');
  });
});
