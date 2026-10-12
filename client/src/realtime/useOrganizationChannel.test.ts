import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { educationKeys } from "@/education/educationQueries";
import type {
  OrganizationChannelState,
  UseOrganizationChannelOptions,
} from "./useOrganizationChannel";

// Node ortamında React 19 render edebilmesi için minimal DOM taklidi (identityRace.test.ts deseni)
class MockNode {
  nodeType: number;
  nodeName: string;
  tagName: string;
  childNodes: MockNode[] = [];
  parentNode: MockNode | null = null;
  style: Record<string, unknown> = {};
  nodeValue?: string;
  ownerDocument: MockDocument | null = null;

  constructor(nodeType: number, name: string) {
    this.nodeType = nodeType;
    this.nodeName = name;
    this.tagName = name;
  }

  appendChild<T extends MockNode>(child: T): T {
    this.childNodes.push(child);
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
  location: { origin: "http://localhost:3000", hash: "" },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};
mockDoc.defaultView = mockWin;

// Global ortam kurulumu
globalThis.React = React;
// @ts-expect-error test mock globals
globalThis.window = mockWin;
// @ts-expect-error test mock globals
globalThis.document = mockDoc;
// @ts-expect-error test mock globals
globalThis.HTMLIFrameElement = mockWin.HTMLIFrameElement;
// @ts-expect-error test mock globals
globalThis.HTMLElement = mockWin.HTMLElement;
// @ts-expect-error test mock globals
globalThis.Element = mockWin.Element;
// @ts-expect-error test mock globals
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock nesneleri ve sayaçlar
type AuthChangeListener = (event: string, session: Session | null) => void;
type StatusCallback = (status: string, err?: Error) => void;

interface ChannelInstance {
  topic: string;
  opts: unknown;
  broadcastCallbacks: ((payload: unknown) => void)[];
  statusCallback: StatusCallback | null;
  on: (
    type: string,
    filter: unknown,
    cb: (payload: unknown) => void
  ) => ChannelInstance;
  subscribe: (cb: StatusCallback) => ChannelInstance;
}

let activeChannels: ChannelInstance[] = [];
let subscribeCount = 0;
let removeChannelCount = 0;
const setAuthCalls: (string | undefined)[] = [];
let authListeners: AuthChangeListener[] = [];
let isDemoModeMock = false;
let mockIdentityOrgId: string | null = "org-test-default";

function createMockChannel(topic: string, opts: unknown): ChannelInstance {
  const instance: ChannelInstance = {
    topic,
    opts,
    broadcastCallbacks: [],
    statusCallback: null,
    on(_type, _filter, cb) {
      instance.broadcastCallbacks.push(cb);
      return instance;
    },
    subscribe(cb) {
      subscribeCount++;
      instance.statusCallback = cb;
      cb("SUBSCRIBED");
      return instance;
    },
  };
  activeChannels.push(instance);
  return instance;
}

vi.mock("@/auth/runtime", () => ({
  get isDemoMode() {
    return isDemoModeMock;
  },
}));

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({
    identity: mockIdentityOrgId
      ? {
          userId: "user-1",
          membership: {
            organizationId: mockIdentityOrgId,
            role: "admin",
          },
        }
      : null,
    demoMode: isDemoModeMock,
  }),
}));

// Kaydedici gerçek Supabase istemcisine bağlı; burada yalnız çağrı sayılır.
const reportErrorMock = vi.fn();
vi.mock("@/errorReporting/installErrorReporting", () => ({
  reportError: (...args: unknown[]) => reportErrorMock(...args),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    channel: (topic: string, opts: unknown) => createMockChannel(topic, opts),
    removeChannel: () => {
      removeChannelCount++;
    },
    realtime: {
      setAuth: (token?: string) => {
        setAuthCalls.push(token);
      },
    },
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "initial-jwt-token",
            user: { id: "u-1" },
          } as unknown as Session,
        },
        error: null,
      })),
      onAuthStateChange: (cb: AuthChangeListener) => {
        authListeners.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners = authListeners.filter(l => l !== cb);
              },
            },
          },
        };
      },
    },
  },
}));

// Modülü mock'lardan sonra yükle
const { useOrganizationChannel } = await import("./useOrganizationChannel");

describe("useOrganizationChannel (v1.3-05 Realtime Aboneliği ve Invalidation)", () => {
  let queryClient: QueryClient;
  let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>;
  let setQueryDataSpy: ReturnType<typeof vi.spyOn>;
  let seenState: { current: OrganizationChannelState | null } = {
    current: null,
  };

  function TestConsumer({
    options,
  }: {
    options?: UseOrganizationChannelOptions;
  }) {
    seenState.current = useOrganizationChannel(options);
    return null;
  }

  function renderHook(options?: UseOrganizationChannelOptions) {
    const rootDiv = mockDoc.createElement("div");
    mockDoc.body.appendChild(rootDiv);
    const root = ReactDOM.createRoot(rootDiv as unknown as HTMLElement);

    const render = async (strict = false) => {
      await React.act(async () => {
        const inner = React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(TestConsumer, { options })
        );
        const wrapped = strict
          ? React.createElement(React.StrictMode, null, inner)
          : inner;
        root.render(wrapped);
      });
      // Efektlerin ve microtask'ların tamamlanması için bekleme
      await new Promise(r => setTimeout(r, 10));
    };

    const unmount = async () => {
      await React.act(async () => {
        root.unmount();
      });
      await new Promise(r => setTimeout(r, 10));
    };

    return { render, unmount };
  }

  beforeEach(() => {
    activeChannels = [];
    subscribeCount = 0;
    removeChannelCount = 0;
    setAuthCalls.length = 0;
    authListeners = [];
    isDemoModeMock = false;
    mockIdentityOrgId = "org-test-default";
    seenState = { current: null };

    queryClient = new QueryClient();
    invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
  });

  it("1. Kanal adı tam olarak 'org:<organizationId>' ve config { private: true }'dur", async () => {
    const { render, unmount } = renderHook({ organizationId: "org-alpha-123" });
    await render();

    expect(activeChannels).toHaveLength(1);
    expect(activeChannels[0].topic).toBe("org:org-alpha-123");
    expect(activeChannels[0].opts).toEqual({ config: { private: true } });

    await unmount();
  });

  it("2. ⛔ Demo modunda hiç abone olunmaz", async () => {
    isDemoModeMock = true;
    const { render, unmount } = renderHook({ organizationId: "org-alpha-123" });
    await render();

    expect(activeChannels).toHaveLength(0);
    expect(subscribeCount).toBe(0);
    expect(seenState.current?.status).toBe("IDLE");
    expect(seenState.current?.isConnected).toBe(false);

    await unmount();
  });

  it("3. ⛔ Kurum kimliği yokken (null/boş) hiç abone olunmaz", async () => {
    mockIdentityOrgId = null;
    const { render, unmount } = renderHook({ organizationId: null });
    await render();

    expect(activeChannels).toHaveLength(0);
    expect(subscribeCount).toBe(0);
    expect(seenState.current?.status).toBe("IDLE");
    expect(seenState.current?.isConnected).toBe(false);

    await unmount();
  });

  it("4. ⛔ enabled: false verildiğinde hiç abone olunmaz", async () => {
    const { render, unmount } = renderHook({
      organizationId: "org-alpha-123",
      enabled: false,
    });
    await render();

    expect(activeChannels).toHaveLength(0);
    expect(subscribeCount).toBe(0);
    expect(seenState.current?.status).toBe("IDLE");

    await unmount();
  });

  it("5. ⛔ <StrictMode> altında abonelik sökülüyor ve yeniden kuruluyor (sayısal ölçüm: 2 kurulum, 1 sökme)", async () => {
    const { render, unmount } = renderHook({
      organizationId: "org-alpha-strict",
    });

    // StrictMode altında render et
    await render(true);

    // React 19 StrictMode: effect kur -> sök -> kur
    expect(subscribeCount).toBe(2);
    expect(removeChannelCount).toBe(1);

    // Bileşen tamamen ekrandan kaldırıldığında (unmount)
    await unmount();
    expect(removeChannelCount).toBe(2);
  });

  it("6. Jeton ilk açılışta ve yenilendiğinde (TOKEN_REFRESHED) setAuth ile Realtime'a iletilir", async () => {
    const { render, unmount } = renderHook({ organizationId: "org-jwt-test" });
    await render();

    // 1. İlk açılışta getSession'dan gelen jeton iletildi
    expect(setAuthCalls).toContain("initial-jwt-token");

    // 2. AuthProvider üzerinden TOKEN_REFRESHED olayı tetiklendiğinde
    await React.act(async () => {
      for (const listener of authListeners) {
        listener("TOKEN_REFRESHED", {
          access_token: "refreshed-jwt-token-777",
          user: { id: "u-1" },
        } as unknown as Session);
      }
      await new Promise(r => setTimeout(r, 10));
    });

    expect(setAuthCalls).toContain("refreshed-jwt-token-777");

    await unmount();
  });

  it("7. 'students' mesajı öğrenci, yoklama ve ödeme sorgularını tazeler — ders programına dokunmaz", async () => {
    const orgId = "org-msg-test";
    const { render, unmount } = renderHook({ organizationId: orgId });
    await render();

    const channel = activeChannels[0];
    expect(channel).toBeDefined();

    await React.act(async () => {
      for (const cb of channel.broadcastCallbacks) {
        cb({ payload: { table: "students", op: "INSERT" } });
      }
      // 300 ms debounce penceresini bekle
      await new Promise(r => setTimeout(r, 350));
    });

    // Öğrenci sorgusu tazelendi
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: educationKeys.students(orgId),
    });

    // Öğrenci ADI bu iki servisin `select`'inde gömülü okunuyor.
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: educationKeys.attendance(orgId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: educationKeys.payments(orgId),
    });

    // ⛔ Toptan tazeleme YAPILMADI, ve ders programı öğrenci adı okumadığı
    // için ona da dokunulmadı — eşleme geniş değil, kesin.
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: educationKeys.all,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: educationKeys.schedule(orgId),
    });

    // ⛔ setQueryData çağrılmadı
    expect(setQueryDataSpy).not.toHaveBeenCalled();

    await unmount();
  });

  it("8. 'installments' mesajı hem ödeme hem özet hem öğrenci sorgusunu tazeler", async () => {
    const orgId = "org-msg-inst";
    const { render, unmount } = renderHook({ organizationId: orgId });
    await render();

    const channel = activeChannels[0];

    await React.act(async () => {
      for (const cb of channel.broadcastCallbacks) {
        cb({ payload: { table: "installments", op: "UPDATE" } });
      }
      await new Promise(r => setTimeout(r, 350));
    });

    // Ödemeler, ödeme özeti ve öğrenci (Student.payment) sorguları tazelendi
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: educationKeys.payments(orgId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: educationKeys.paymentOverview(orgId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: educationKeys.students(orgId),
    });

    // İlgisiz sorgular (ders programı, yoklama vb.) tazelenmedi
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: educationKeys.schedule(orgId),
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: educationKeys.attendance(orgId),
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: educationKeys.all,
    });

    // ⛔ setQueryData çağrılmadı
    expect(setQueryDataSpy).not.toHaveBeenCalled();

    await unmount();
  });

  it("9. ⛔ Tekil tablo mesajında toptan tazeleme (educationKeys.all) YAPILMAZ", async () => {
    const orgId = "org-msg-single";
    const { render, unmount } = renderHook({ organizationId: orgId });
    await render();

    const channel = activeChannels[0];

    await React.act(async () => {
      for (const cb of channel.broadcastCallbacks) {
        cb({ payload: { table: "schedule_entries", op: "INSERT" } });
      }
      await new Promise(r => setTimeout(r, 350));
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: educationKeys.schedule(orgId),
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: educationKeys.all,
    });

    await unmount();
  });

  it("10. ⛔ Yükten asla cache'e yazılmaz (setQueryData çağrılmaz)", async () => {
    const orgId = "org-no-set-query";
    const { render, unmount } = renderHook({ organizationId: orgId });
    await render();

    const channel = activeChannels[0];

    await React.act(async () => {
      for (const cb of channel.broadcastCallbacks) {
        cb({ payload: { table: "classes", op: "INSERT" } });
      }
      await new Promise(r => setTimeout(r, 350));
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    await unmount();
  });

  it("11. 300 ms penceresinde gelen çoklu mesajlar birleştirilir (debounced & deduplicated)", async () => {
    const orgId = "org-batch-test";
    const { render, unmount } = renderHook({ organizationId: orgId });
    await render();

    const channel = activeChannels[0];

    await React.act(async () => {
      // 50 ms arayla 3 kez students güncellemesi gönder
      for (const cb of channel.broadcastCallbacks) {
        cb({ payload: { table: "students", op: "INSERT" } });
      }
      await new Promise(r => setTimeout(r, 50));

      for (const cb of channel.broadcastCallbacks) {
        cb({ payload: { table: "students", op: "UPDATE" } });
      }
      await new Promise(r => setTimeout(r, 50));

      for (const cb of channel.broadcastCallbacks) {
        cb({ payload: { table: "students", op: "DELETE" } });
      }

      // Pencere kapanana kadar bekle
      await new Promise(r => setTimeout(r, 350));
    });

    // 3 mesaj gelmesine rağmen students sorgusu YALNIZCA 1 KEZ invalidate edildi
    const studentInvalidations = invalidateQueriesSpy.mock.calls.filter(
      (call: unknown[]) => {
        const key = (call[0] as { queryKey: readonly unknown[] })?.queryKey;
        return (
          JSON.stringify(key) === JSON.stringify(educationKeys.students(orgId))
        );
      }
    );

    expect(studentInvalidations).toHaveLength(1);

    await unmount();
  });

  it("12. Bağlantı koptuktan sonra yeniden bağlandığında toptan tazeleme (educationKeys.all) yapılır (K-22)", async () => {
    const orgId = "org-reconnect-test";
    const { render, unmount } = renderHook({ organizationId: orgId });
    await render();

    const channel = activeChannels[0];
    expect(seenState.current?.status).toBe("SUBSCRIBED");
    expect(seenState.current?.isConnected).toBe(true);

    // 1. Bağlantı koptu (TIMED_OUT veya CHANNEL_ERROR)
    await React.act(async () => {
      channel.statusCallback?.("CHANNEL_ERROR", new Error("Bağlantı koptu"));
      await new Promise(r => setTimeout(r, 10));
    });

    expect(seenState.current?.status).toBe("CHANNEL_ERROR");
    expect(seenState.current?.isConnected).toBe(false);

    // Bu aşamada henüz toptan tazeleme yapılmadı
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: educationKeys.all,
    });

    // 2. Yeniden bağlandı (SUBSCRIBED)
    await React.act(async () => {
      channel.statusCallback?.("SUBSCRIBED");
      await new Promise(r => setTimeout(r, 10));
    });

    expect(seenState.current?.status).toBe("SUBSCRIBED");
    expect(seenState.current?.isConnected).toBe(true);

    // 3. Kopukluk sırasında kaçırılan mesajlar için toptan tazeleme yapıldı!
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: educationKeys.all,
    });

    await unmount();
  });

  it("13. Oturum okunamazsa hata yutulmaz: durum hatayı taşır ve kaydediciye gider", async () => {
    const { supabase } = await import("@/lib/supabaseClient");
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(
      new Error("ağ yok")
    );
    reportErrorMock.mockClear();

    const { render, unmount } = renderHook({ organizationId: "org-oturum" });
    await render();

    expect(seenState.current?.error?.message).toBe("ağ yok");
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    // Jeton verilemedi; kanal yine de kapalı tarafta kalır (fail-closed).
    expect(setAuthCalls).toHaveLength(0);

    await unmount();
  });
});
