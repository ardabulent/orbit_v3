import * as React from "react";
import { createElement } from "react";
import ReactDOM from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Node ortamında React act ile render edebilmek için minimal DOM taklidi
class MockNode {
  nodeType: number;
  nodeName: string;
  tagName: string;
  childNodes: MockNode[] = [];
  parentNode: MockNode | null = null;
  style: Record<string, unknown> = {};
  nodeValue?: string;
  ownerDocument: MockDocument | null = null;
  options: MockNode[] = [];
  selected = false;

  constructor(nodeType: number, name: string) {
    this.nodeType = nodeType;
    this.nodeName = name;
    this.tagName = name;
  }

  appendChild<T extends MockNode>(child: T): T {
    this.childNodes.push(child);
    if (this.tagName === "select" && child.tagName === "option") {
      this.options.push(child);
    }
    child.parentNode = this;
    return child;
  }

  removeChild<T extends MockNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) this.childNodes.splice(idx, 1);
    return child;
  }

  insertBefore<T extends MockNode>(child: T, ref: MockNode | null): T {
    const idx = ref ? this.childNodes.indexOf(ref) : -1;
    if (idx >= 0) this.childNodes.splice(idx, 0, child);
    else this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  setAttribute(): void {}
  removeAttribute(): void {}
}

class MockDocument extends MockNode {
  documentElement: MockNode;
  body: MockNode;
  defaultView: unknown;

  constructor() {
    super(9, "#document");
    this.documentElement = new MockNode(1, "html");
    this.body = new MockNode(1, "body");
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
    this.defaultView = null;
  }

  createElement(tag: string): MockNode {
    const el = new MockNode(1, tag.toLowerCase());
    el.ownerDocument = this;
    return el;
  }

  createElementNS(_ns: string, tag: string): MockNode {
    const el = new MockNode(1, tag.toLowerCase());
    el.ownerDocument = this;
    return el;
  }

  createTextNode(text: string): MockNode {
    const el = new MockNode(3, "#text");
    el.nodeValue = text;
    el.ownerDocument = this;
    return el;
  }
}

const mockDoc = new MockDocument();
const mockWin = {
  document: mockDoc,
  HTMLIFrameElement: class HTMLIFrameElement {},
  HTMLElement: class HTMLElement {},
  Element: class Element {},
  Node: MockNode,
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
};
mockDoc.defaultView = mockWin;

const globals = globalThis as unknown as Record<string, unknown>;
globals.IS_REACT_ACT_ENVIRONMENT = true;
globals.React = React;
globals.window = mockWin;
globals.document = mockDoc;
globals.HTMLIFrameElement = mockWin.HTMLIFrameElement;
globals.HTMLElement = mockWin.HTMLElement;
globals.Element = mockWin.Element;

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "@/auth/AuthContext";
import type { AuthContextValue } from "@/auth/types";
import { AuditLogPage } from "./AuditLogPage";
import { SettingsMembersSection } from "./SettingsMembersSection";
import { MemberCreateDialog } from "./MemberCreateDialog";
import { StudentFormDialog } from "./StudentFormDialog";
import { StudentsPage } from "./StudentsPage";
import { ClassFormDialog } from "./ClassFormDialog";
import { ClassesPage } from "./ClassesPage";
import type { ClassGroup, Section, Student } from "../types";
import { useOrganizationAuditEvents } from "@/audit/auditQueries";
import {
  useSettingsBranches,
  useSettingsMembers,
} from "@/settings/settingsQueries";
import { AttendancePage } from "./AttendancePage";
import { EducationPlatform } from "../EducationPlatform";

const capturedInputProps: Record<
  string,
  React.InputHTMLAttributes<HTMLInputElement> & {
    id?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }
> = {};

vi.mock("@/components/ui/input", () => ({
  Input: (
    props: React.InputHTMLAttributes<HTMLInputElement> & { id?: string }
  ) => {
    if (props.id) {
      capturedInputProps[props.id] = props;
    }
    return createElement("input", props);
  },
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "popover" }, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "popover-trigger" }, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "popover-content" }, children),
}));

vi.mock("@/audit/auditQueries", () => ({
  useOrganizationAuditEvents: vi.fn(),
}));

vi.mock("@/settings/settingsQueries", () => ({
  useSettingsMembers: vi.fn(),
  useSettingsBranches: vi.fn(),
  settingsKeys: { members: () => ["settings", "members"] },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog" }, children),
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-content" }, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-description" }, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-footer" }, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-header" }, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-title" }, children),
  useDialogComposition: () => ({
    isComposingRef: { current: false },
    handleCompositionStart: () => {},
    handleCompositionEnd: () => {},
  }),
}));

let capturedAlertDialogProps: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {};
let capturedAlertCancelProps: { onClick?: () => void } = {};
let capturedAlertActionProps: { onClick?: () => void } = {};

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: (props: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }) => {
    capturedAlertDialogProps = props;
    return createElement(
      "div",
      { "data-slot": "alert-dialog", "data-open": props.open },
      props.open ? props.children : null
    );
  },
  AlertDialogContent: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "alert-dialog-content" }, children),
  AlertDialogHeader: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "alert-dialog-header" }, children),
  AlertDialogTitle: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "alert-dialog-title" }, children),
  AlertDialogDescription: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "alert-dialog-description" }, children),
  AlertDialogFooter: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "alert-dialog-footer" }, children),
  AlertDialogCancel: (props: {
    onClick?: () => void;
    children?: React.ReactNode;
  }) => {
    capturedAlertCancelProps = props;
    return createElement(
      "button",
      { "data-slot": "alert-dialog-cancel", onClick: props.onClick },
      props.children
    );
  },
  AlertDialogAction: (props: {
    onClick?: () => void;
    children?: React.ReactNode;
  }) => {
    capturedAlertActionProps = props;
    return createElement(
      "button",
      { "data-slot": "alert-dialog-action", onClick: props.onClick },
      props.children
    );
  },
}));

let capturedAdminDashboardProps: { onNavigate?: (section: Section) => void } =
  {};
vi.mock("../dashboards/AdminDashboard", () => ({
  AdminDashboard: (props: { onNavigate?: (section: Section) => void }) => {
    React.useEffect(() => {
      capturedAdminDashboardProps = props;
    }, [props]);
    return createElement("div", { "data-slot": "admin-dashboard" });
  },
}));

type AttendanceProps = React.ComponentProps<typeof AttendancePage>;

let mockAttendanceInterception = false;
let capturedAttendanceProps: AttendanceProps | null = null;

function MockInterceptedAttendancePage(props: AttendanceProps) {
  const { onDirtyChange } = props;
  React.useEffect(() => {
    capturedAttendanceProps = props;
  });
  React.useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);
  return createElement("div", { "data-slot": "attendance-page" });
}

vi.mock("./AttendancePage", async importOriginal => {
  const actual = await importOriginal<typeof import("./AttendancePage")>();
  return {
    ...actual,
    AttendancePage: (props: AttendanceProps) => {
      if (mockAttendanceInterception) {
        return createElement(MockInterceptedAttendancePage, props);
      }
      return actual.AttendancePage(props);
    },
  };
});

function renderWithProviders(component: React.ReactElement, demoMode = false) {
  const dummyAuth: AuthContextValue = {
    identity: null,
    loading: false,
    demoMode,
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
  const queryClient = new QueryClient();
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AuthContext.Provider, { value: dummyAuth }, component)
    )
  );
}

describe("AuditLogPage states (v1.3-02b)", () => {
  it("renders TableSkeleton and does not render 'Denetim kaydı yükleniyor…' during loading", () => {
    vi.mocked(useOrganizationAuditEvents).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOrganizationAuditEvents>);

    const html = renderToStaticMarkup(createElement(AuditLogPage));
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Denetim kaydı yükleniyor…");
  });

  it("renders ErrorState with 'Tekrar dene' button on error", () => {
    vi.mocked(useOrganizationAuditEvents).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Sorgu koptu"),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOrganizationAuditEvents>);

    const html = renderToStaticMarkup(createElement(AuditLogPage));
    expect(html).toContain("Denetim kaydı görüntülenemedi");
    expect(html).toContain("Tekrar dene");
  });
});

describe("SettingsMembersSection states (v1.3-02b)", () => {
  beforeEach(() => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);
  });

  it("renders TableSkeleton and avoids 'Üye listesi yükleniyor…' during loading", () => {
    vi.mocked(useSettingsMembers).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSettingsMembers>);

    const html = renderWithProviders(
      createElement(SettingsMembersSection),
      false
    );
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Üye listesi yükleniyor…");
  });

  it("renders ErrorState with 'Tekrar dene' button on error in non-demo mode", () => {
    vi.mocked(useSettingsMembers).mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("Yetkisiz erişim"),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSettingsMembers>);

    const html = renderWithProviders(
      createElement(SettingsMembersSection),
      false
    );
    expect(html).toContain("Üye listesi alınamadı");
    expect(html).toContain("Tekrar dene");
  });
});

describe("MemberCreateDialog states (v1.3-02b)", () => {
  it("renders inline skeleton and avoids visible 'Şubeler yükleniyor…' text when branchLoading", () => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    const html = renderWithProviders(
      createElement(MemberCreateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
      })
    );

    expect(html).toContain('role="status"');
    expect(html).not.toMatch(/<p[^>]*>.*Şubeler yükleniyor.*<\/p>/i);
  });

  it("şube seçimi varsayılan şubeden ön-dolar (v1.4-09 · #284)", () => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [
        {
          id: "br-1",
          name: "Kadıköy Şube",
          isDefault: false,
        },
        {
          id: "br-2",
          name: "Beşiktaş Şube",
          isDefault: true,
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    const html = renderWithProviders(
      createElement(MemberCreateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
      })
    );

    // Beşiktaş Şube varsayılan olduğu için seçili olmalı
    expect(html).toMatch(/value="br-2"[^>]*selected/);
  });
});

describe("StudentFormDialog states (v1.4-01)", () => {
  it("yeni öğrenci ekleme modunda şube varsayılandan ön-dolar (v1.4-09 · #284)", () => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [
        {
          id: "br-1",
          name: "Kadıköy Şube",
          isDefault: false,
        },
        {
          id: "br-2",
          name: "Beşiktaş Şube",
          isDefault: true,
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    const html = renderWithProviders(
      createElement(StudentFormDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
      })
    );

    expect(html).toContain("Yeni öğrenci ekle");
    // Beşiktaş Şube varsayılan olduğu için seçili olmalı
    expect(html).toMatch(/value="br-2"[^>]*selected/);
  });

  it("yeni öğrenci ekleme modunda başlık ve buton doğru çizilir", () => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [
        {
          id: "br-1",
          name: "Merkez Şube",
          organization_id: "org-1",
          is_default: true,
          created_at: "",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    const html = renderWithProviders(
      createElement(StudentFormDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
      })
    );

    expect(html).toContain("Yeni öğrenci ekle");
    expect(html).toContain("Öğrenciyi ekle");
    expect(html).toContain("Merkez Şube");
  });

  it("düzenleme modunda öğrenci bilgileri doldurulur ve kaydet başlığı gösterilir", () => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [
        {
          id: "br-1",
          name: "Merkez Şube",
          organization_id: "org-1",
          is_default: true,
          created_at: "",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    const existingStudent: Student = {
      id: "stu-1",
      name: "Zeynep Kaya",
      code: "101",
      group: "12-A",
      branch: "Merkez Şube",
      branchId: "br-1",
      parent: null,
      hasAccount: false,
    };

    const html = renderWithProviders(
      createElement(StudentFormDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
        student: existingStudent,
      })
    );

    expect(html).toContain("Öğrenciyi düzenle");
    expect(html).toContain("Değişiklikleri kaydet");
    expect(html).toContain("101");
  });

  it("R1 regresyonu: şube sorgusu çözülmemişken yazılan ad korunur ve sorgu çözüldüğünde silinmez", () => {
    // 1. Başlangıçta şube sorgusu henüz çözülmemiş (data: undefined)
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    const queryClient = new QueryClient();
    const container = mockDoc.createElement("div");
    mockDoc.body.appendChild(container);
    const root = ReactDOM.createRoot(container as unknown as HTMLElement);

    const renderDialog = () => {
      React.act(() => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(StudentFormDialog, {
              open: true,
              onOpenChange: vi.fn(),
              onDone: vi.fn(),
              organizationId: "org-1",
            })
          )
        );
      });
    };

    renderDialog();

    // Kullanıcı forma "Zeynep" yazar
    expect(capturedInputProps["student-full-name"]).toBeDefined();
    React.act(() => {
      capturedInputProps["student-full-name"].onChange?.({
        target: { value: "Zeynep" },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Şube sorgusu çözülmemişken girilen ad korunmalı (R1)
    expect(capturedInputProps["student-full-name"].value).toBe("Zeynep");

    // 2. Şube sorgusu sonradan çözülür
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [
        {
          id: "br-1",
          name: "Kadıköy Şubesi",
          organization_id: "org-1",
          is_default: true,
          created_at: "",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    // Bileşen yeniden render edilir
    renderDialog();

    // Sorgu çözüldükten sonra da yazılan ad silinmemeli, "Zeynep" kalmalıdır
    expect(capturedInputProps["student-full-name"].value).toBe("Zeynep");

    React.act(() => {
      root.unmount();
    });
    mockDoc.body.removeChild(container);
  });
});

describe("StudentsPage states (v1.4-01 CRUD & K-22 rozet & bağlama)", () => {
  const dummyStudents: Student[] = [
    {
      id: "stu-unlinked",
      name: "Bağlantısız Öğrenci",
      code: "101",
      group: "12-A",
      branch: "Merkez",
      parent: null,
      hasAccount: false,
    },
    {
      id: "stu-linked",
      name: "Bağlı Öğrenci",
      code: "102",
      group: "12-B",
      branch: "Merkez",
      parent: null,
      hasAccount: true,
    },
  ];

  it("K-22: hesabı olmayan öğrencide 'Hesap yok' rozeti gösterir, bağlı olanda göstermez", () => {
    const html = renderToStaticMarkup(
      createElement(StudentsPage, {
        role: "admin",
        students: dummyStudents,
        query: "",
        onQuery: vi.fn(),
        onSelect: vi.fn(),
        onAdd: vi.fn(),
      })
    );

    // 2026-09-28: rozet kısaldı ("Hesap yok"); rengi yine slate (K-22).
    expect(html).toContain("Hesap yok");
    expect(html).toContain("bg-slate-100 text-slate-600");
  });

  it("admin rolünde satır işlemleri görünür: Düzenle, Arşivle ve bağla/çöz", () => {
    const html = renderToStaticMarkup(
      createElement(StudentsPage, {
        role: "admin",
        students: dummyStudents,
        query: "",
        onQuery: vi.fn(),
        onSelect: vi.fn(),
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
        onLinkAccount: vi.fn(),
        onUnlinkAccount: vi.fn(),
      })
    );

    expect(html).toContain("Düzenle");
    expect(html).toContain("Arşivle");
    expect(html).toContain("Hesap bağla");
    expect(html).toContain("Hesap bağını çöz");
  });

  it("öğretmen rolünde yönetim düğmeleri (Düzenle, Arşivle, Bağla) çizilmez (K-04)", () => {
    const html = renderToStaticMarkup(
      createElement(StudentsPage, {
        role: "teacher",
        students: dummyStudents,
        query: "",
        onQuery: vi.fn(),
        onSelect: vi.fn(),
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
        onLinkAccount: vi.fn(),
        onUnlinkAccount: vi.fn(),
      })
    );

    expect(html).not.toContain("Düzenle");
    expect(html).not.toContain("Arşivle");
    expect(html).not.toContain("Hesap bağla");
    expect(html).not.toContain("Bağı çöz");
    expect(html).toContain("Profili aç");
  });

  it("placeholder gerçeğe uydurulmuştur ve kesilme bandı arama kutusunu öğütler (#256)", () => {
    const html = renderToStaticMarkup(
      createElement(StudentsPage, {
        role: "admin",
        students: dummyStudents,
        query: "",
        onQuery: vi.fn(),
        onSelect: vi.fn(),
        onAdd: vi.fn(),
        truncated: true,
        limit: 100,
      })
    );

    expect(html).toContain("Öğrenci adı veya numarası ara...");
    expect(html).not.toContain("sınıf ara");
    expect(html).toContain("yukarıdaki arama kutusunu kullanın");
  });
});

describe("ClassFormDialog states (v1.4-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yeni sınıf ekleme modunda başlık ve buton doğru çizilir", () => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [
        {
          id: "br-1",
          name: "Merkez Şube",
          organization_id: "org-1",
          is_default: true,
          created_at: "",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    vi.mocked(useSettingsMembers).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsMembers>);

    const html = renderWithProviders(
      createElement(ClassFormDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
      })
    );

    expect(html).toContain("Yeni sınıf ekle");
    expect(html).toContain("Sınıfı ekle");
    expect(html).toContain("Merkez Şube");
  });

  it("düzenleme modunda sınıf bilgileri doldurulur ve kaydet başlığı gösterilir", () => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [
        {
          id: "br-1",
          name: "Merkez Şube",
          organization_id: "org-1",
          is_default: true,
          created_at: "",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    vi.mocked(useSettingsMembers).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsMembers>);

    const existingClass: ClassGroup = {
      id: "cls-1",
      name: "12-A Sayısal",
      program: "YKS",
      branch: "Merkez Şube",
      branchId: "br-1",
      mentor: null,
      capacity: 25,
      studentCount: 10,
    };

    const html = renderWithProviders(
      createElement(ClassFormDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
        classData: existingClass,
      })
    );

    expect(html).toContain("Sınıfı düzenle");
    expect(html).toContain("Değişiklikleri kaydet");
    expect(html).toContain("12-A Sayısal");
  });

  it("rehber öğretmen seçimi yalnızca yönetici ve öğretmen rolleriyle sınırlandırılır (ORB03 / K-04)", () => {
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    vi.mocked(useSettingsMembers).mockReturnValue({
      data: [
        {
          membershipId: "mem-t",
          role: "teacher",
          displayName: "Ayşe Öğretmen",
          loginNumber: "1001",
          branchName: "Merkez",
          status: "active",
        },
        {
          membershipId: "mem-a",
          role: "admin",
          displayName: "Ali Müdür",
          loginNumber: "1002",
          branchName: "Merkez",
          status: "active",
        },
        {
          membershipId: "mem-s",
          role: "student",
          displayName: "Ahmet Öğrenci",
          loginNumber: "1003",
          branchName: "Merkez",
          status: "active",
        },
        {
          membershipId: "mem-p",
          role: "parent",
          displayName: "Fatma Veli",
          loginNumber: "1004",
          branchName: "Merkez",
          status: "active",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsMembers>);

    const html = renderWithProviders(
      createElement(ClassFormDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDone: vi.fn(),
        organizationId: "org-1",
      })
    );

    // Öğretmenler ve yöneticiler ayrı gruplarda (karar 2026-09-28, C-05).
    expect(html).toMatch(
      /<optgroup label="Öğretmenler">.*Ayşe Öğretmen.*<\/optgroup>/s
    );
    expect(html).toMatch(
      /<optgroup label="Yöneticiler">.*Ali Müdür.*<\/optgroup>/s
    );
    expect(html.indexOf("Ayşe Öğretmen")).toBeLessThan(
      html.indexOf("Ali Müdür")
    );
    expect(html).not.toContain("Ahmet Öğrenci");
    expect(html).not.toContain("Fatma Veli");
  });

  it("R1 regresyonu: şube/üye sorgusu çözülmemişken yazılan sınıf adı sorgular çözüldüğünde silinmez", () => {
    // 1. Başlangıçta şube ve üye sorguları henüz çözülmemiş (data: undefined)
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    vi.mocked(useSettingsMembers).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useSettingsMembers>);

    const queryClient = new QueryClient();
    const container = mockDoc.createElement("div");
    mockDoc.body.appendChild(container);
    const root = ReactDOM.createRoot(container as unknown as HTMLElement);

    const renderDialog = () => {
      React.act(() => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ClassFormDialog, {
              open: true,
              onOpenChange: vi.fn(),
              onDone: vi.fn(),
              organizationId: "org-1",
            })
          )
        );
      });
    };

    renderDialog();

    // Kullanıcı forma "12-Fen-C" yazar
    expect(capturedInputProps["class-name"]).toBeDefined();
    React.act(() => {
      capturedInputProps["class-name"].onChange?.({
        target: { value: "12-Fen-C" },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Şube sorgusu çözülmemişken girilen ad korunmalı (R1)
    expect(capturedInputProps["class-name"].value).toBe("12-Fen-C");

    // 2. Şube sorgusu sonradan çözülür
    vi.mocked(useSettingsBranches).mockReturnValue({
      data: [
        {
          id: "br-1",
          name: "Kadıköy Şubesi",
          organization_id: "org-1",
          is_default: true,
          created_at: "",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsBranches>);

    // Bileşen yeniden render edilir
    renderDialog();

    // Sorgu çözüldükten sonra da yazılan sınıf adı silinmemeli, "12-Fen-C" kalmalıdır
    expect(capturedInputProps["class-name"].value).toBe("12-Fen-C");
  });
});

describe("ClassesPage states (v1.4-02)", () => {
  const dummyClasses: ClassGroup[] = [
    {
      id: "cls-1",
      name: "12-A Sayısal",
      program: "YKS",
      branch: "Merkez",
      mentor: "Merve Karaca",
      capacity: 20,
      studentCount: 15,
    },
    {
      id: "cls-2",
      name: "12-B Eşit Ağırlık",
      program: "YKS",
      branch: "Merkez",
      mentor: null,
      capacity: 20,
      studentCount: 20,
    },
    {
      id: "cls-3",
      name: "11-C Sözel",
      program: "YKS",
      branch: "Merkez",
      mentor: null,
      capacity: null,
      studentCount: 8,
    },
  ];

  it("kontenjan durumunu doğru görüntüler ve tam kapasitede rozet basar", () => {
    const html = renderToStaticMarkup(
      createElement(ClassesPage, {
        role: "admin",
        classes: dummyClasses,
        onNavigate: vi.fn(),
      })
    );

    // cls-1: 15/20 doluluk, tam dolu değil
    expect(html).toContain("15/20 doluluk");

    // cls-2: 20/20 doluluk, Kontenjan dolu
    expect(html).toContain("20/20 doluluk");
    expect(html).toContain("Kontenjan dolu");

    // cls-3: capacity null -> 8 kayıt, sahte payda uydurulmaz (K-03)
    expect(html).toContain("8 kayıt");
    expect(html).not.toContain("8/null");
    expect(html).not.toContain("8/0");
  });

  it("admin rolünde satır işlemleri (Öğrenciler, Düzenle, Arşivle) görünür", () => {
    const html = renderToStaticMarkup(
      createElement(ClassesPage, {
        role: "admin",
        classes: dummyClasses,
        onNavigate: vi.fn(),
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
        onManageEnrollments: vi.fn(),
      })
    );

    expect(html).toContain("Öğrenciler");
    expect(html).toContain("Düzenle");
    expect(html).toContain("Arşivle");
  });

  it("öğretmen rolünde yönetim düğmeleri (Düzenle, Arşivle) çizilmez", () => {
    const html = renderToStaticMarkup(
      createElement(ClassesPage, {
        role: "teacher",
        classes: dummyClasses,
        onNavigate: vi.fn(),
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
        onManageEnrollments: vi.fn(),
      })
    );

    expect(html).not.toContain("Düzenle");
    expect(html).not.toContain("Arşivle");
    expect(html).toContain("Öğrencileri görüntüle");
  });
});

describe("AttendancePage states (v1.4-03)", () => {
  it("varsayılan durum seçilmemiştir: hiçbir öğrenci için 'Katıldı' ön işaretli gelmez (K-03)", () => {
    const session = {
      id: "sess-1",
      classId: "cls-1",
      className: "12-A",
      subjectId: null,
      subjectName: null,
      sessionDate: "2026-09-10",
      startsAt: null,
      records: [
        {
          id: "rec-1",
          studentId: "stu-1",
          studentName: "Ali Can",
          status: null,
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(AttendancePage, {
        role: "teacher",
        attendances: {},
        setAttendances: vi.fn(),
        session,
        isDemo: false,
      })
    );

    expect(html).toContain("Seçilmedi");
    expect(html).not.toContain("bg-slate-900 text-white shadow-sm");
  });

  it("öğretmen rolünde akış açıktır: durum butonları devre dışı değildir ve kaydetme butonu mevcuttur", () => {
    const session = {
      id: "sess-1",
      classId: "cls-1",
      className: "12-A",
      subjectId: null,
      subjectName: null,
      sessionDate: "2026-09-10",
      startsAt: null,
      records: [
        {
          id: "rec-1",
          studentId: "stu-1",
          studentName: "Ali Can",
          status: "Katıldı" as const,
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(AttendancePage, {
        role: "teacher",
        attendances: {},
        setAttendances: vi.fn(),
        session,
        isDemo: false,
      })
    );

    expect(html).not.toContain('disabled="" aria-disabled="true"');
    expect(html).toContain("Yoklamayı kaydet");
  });

  it("üretimde oturum yoksa 'Henüz yoklama kaydı yok' boş durumunu gösterir (K-03)", () => {
    const html = renderToStaticMarkup(
      createElement(AttendancePage, {
        role: "admin",
        attendances: {},
        setAttendances: vi.fn(),
        session: null,
        isDemo: false,
      })
    );

    expect(html).toContain("Henüz yoklama kaydı yok");
  });

  it("demo modunda 'Taslak' rozeti ve toast bildirimi davranışı korunur", () => {
    const html = renderToStaticMarkup(
      createElement(AttendancePage, {
        role: "admin",
        attendances: { "stu-1": "Katıldı" },
        setAttendances: vi.fn(),
        students: [
          {
            id: "stu-1",
            name: "Ali Can",
            group: "12-A",
            branch: "Merkez",
            parent: "Veli Can",
          },
        ],
        isDemo: true,
      })
    );

    expect(html).toContain("Taslak");
    expect(html).toContain("Yoklamayı kaydet");
  });
});

describe("EducationPlatform yoklama ayrılma koruması (v1.4-03 R1 & R2 Regresyon)", () => {
  beforeEach(() => {
    mockAttendanceInterception = true;
    capturedAttendanceProps = null;
    capturedAlertDialogProps = {};
    capturedAlertCancelProps = {};
    capturedAlertActionProps = {};
  });

  it("kirli durumdayken bölüm değiştirme doğrudan geçmez, AlertDialog onay penceresi açılır", () => {
    const queryClient = new QueryClient();
    const container = mockDoc.createElement("div");
    mockDoc.body.appendChild(container);
    const root = ReactDOM.createRoot(container as unknown as HTMLElement);

    const dummyAuth: AuthContextValue = {
      identity: {
        user: {
          id: "usr-1",
          email: "admin@orbit.local",
          phone: null,
          created_at: "",
        },
        membership: {
          id: "mem-1",
          role: "admin",
          organizationId: "org-1",
        },
      } as unknown as AuthContextValue["identity"],
      loading: false,
      demoMode: true,
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

    React.act(() => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            AuthContext.Provider,
            { value: dummyAuth },
            createElement(EducationPlatform, {
              onLogout: vi.fn(),
              initialRole: "admin",
            })
          )
        )
      );
    });

    // 1. AdminDashboard üzerinden Yoklama bölümüne geçilir
    expect(capturedAdminDashboardProps.onNavigate).toBeDefined();
    React.act(() => {
      capturedAdminDashboardProps.onNavigate?.("Yoklama");
    });

    // 2. Yoklama sayfası ekrana gelir ve prop'ları yakalanır
    expect(capturedAttendanceProps).not.toBeNull();

    // 3. Öğretmen/Yönetici yoklama üzerinde değişiklik yapar (isDirty = true)
    React.act(() => {
      capturedAttendanceProps?.onDirtyChange?.(true);
    });

    // 4. Kullanıcı sol menüden Öğrenciler bölümüne geçmeye çalışır
    React.act(() => {
      capturedAttendanceProps?.onNavigate?.("Öğrenciler");
    });

    // ⛔ REGRESYON KORUMASI: Bölüm doğrudan DEĞİŞMEZ, AlertDialog açık şekilde tetiklenir
    expect(capturedAlertDialogProps.open).toBe(true);

    // 5. Kullanıcı "Vazgeç"e tıklar
    React.act(() => {
      capturedAlertCancelProps.onClick?.();
    });

    // Diyalog kapanır
    expect(capturedAlertDialogProps.open).toBe(false);

    // 6. Kullanıcı tekrar "Öğrenciler"e geçmeyi dener ve bu kez "Devam Et" der
    React.act(() => {
      capturedAttendanceProps?.onNavigate?.("Öğrenciler");
    });
    expect(capturedAlertDialogProps.open).toBe(true);

    React.act(() => {
      capturedAlertActionProps.onClick?.();
    });

    // Diyalog kapanır ve geçiş onaylanarak kirli durum sıfırlanır
    expect(capturedAlertDialogProps.open).toBe(false);

    React.act(() => {
      root.unmount();
    });
    mockDoc.body.removeChild(container);
    mockAttendanceInterception = false;
  });

  it("temiz durumdayken bölüm geçişi doğrudan geçer, onay penceresi açılmaz", () => {
    const queryClient = new QueryClient();
    const container = mockDoc.createElement("div");
    mockDoc.body.appendChild(container);
    const root = ReactDOM.createRoot(container as unknown as HTMLElement);

    const dummyAuth: AuthContextValue = {
      identity: {
        user: {
          id: "usr-1",
          email: "admin@orbit.local",
          phone: null,
          created_at: "",
        },
        membership: {
          id: "mem-1",
          role: "admin",
          organizationId: "org-1",
        },
      } as unknown as AuthContextValue["identity"],
      loading: false,
      demoMode: true,
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

    React.act(() => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            AuthContext.Provider,
            { value: dummyAuth },
            createElement(EducationPlatform, {
              onLogout: vi.fn(),
              initialRole: "admin",
            })
          )
        )
      );
    });

    React.act(() => {
      capturedAdminDashboardProps.onNavigate?.("Yoklama");
    });
    expect(capturedAttendanceProps).not.toBeNull();

    // Veri temizdir (isDirty = false)
    React.act(() => {
      capturedAttendanceProps?.onDirtyChange?.(false);
    });

    // Başka bölüme geçiş doğrudan geçer
    React.act(() => {
      capturedAttendanceProps?.onNavigate?.("Öğrenciler");
    });

    // Onay penceresi kesinlikle AÇILMAZ
    expect(capturedAlertDialogProps.open).toBeFalsy();

    React.act(() => {
      root.unmount();
    });
    mockDoc.body.removeChild(container);
    mockAttendanceInterception = false;
  });

  it("Yoklama'dayken tekrar Yoklama'ya tıklandığında kirli olsa bile onay penceresi açılmaz", () => {
    const queryClient = new QueryClient();
    const container = mockDoc.createElement("div");
    mockDoc.body.appendChild(container);
    const root = ReactDOM.createRoot(container as unknown as HTMLElement);

    const dummyAuth: AuthContextValue = {
      identity: {
        user: {
          id: "usr-1",
          email: "admin@orbit.local",
          phone: null,
          created_at: "",
        },
        membership: {
          id: "mem-1",
          role: "admin",
          organizationId: "org-1",
        },
      } as unknown as AuthContextValue["identity"],
      loading: false,
      demoMode: true,
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

    React.act(() => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            AuthContext.Provider,
            { value: dummyAuth },
            createElement(EducationPlatform, {
              onLogout: vi.fn(),
              initialRole: "admin",
            })
          )
        )
      );
    });

    React.act(() => {
      capturedAdminDashboardProps.onNavigate?.("Yoklama");
    });
    expect(capturedAttendanceProps).not.toBeNull();

    // Veri kirlidir
    React.act(() => {
      capturedAttendanceProps?.onDirtyChange?.(true);
    });

    // Tekrar Yoklama'ya tıklanır (aynı bölüm)
    React.act(() => {
      capturedAttendanceProps?.onNavigate?.("Yoklama");
    });

    // Aynı bölüme tıklandığında onay penceresi AÇILMAZ
    expect(capturedAlertDialogProps.open).toBeFalsy();

    React.act(() => {
      root.unmount();
    });
    mockDoc.body.removeChild(container);
    mockAttendanceInterception = false;
  });
});
