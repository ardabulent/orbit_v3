import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

const getUser = vi.fn();
const signInWithPassword = vi.fn();
const updateUser = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: () => getUser(),
      signInWithPassword: (args: unknown) => signInWithPassword(args),
      updateUser: (args: unknown) => updateUser(args),
    },
    rpc: (name: string) => rpc(name),
  },
}));

import { ChangePasswordCard } from "@/components/education/pages/ChangePasswordCard";
import { changeOwnPassword } from "./passwordChange";

const GECERLI = "YeniSifre42";

describe("changeOwnPassword (2026-09-29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { email: "12345678@orbit.invalid" } },
      error: null,
    });
    signInWithPassword.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it("kurala uymayan yeni şifre ağa hiç gitmez", async () => {
    await expect(
      changeOwnPassword({
        currentPassword: "Eski1234",
        newPassword: "kisa",
        confirmation: "kisa",
      })
    ).rejects.toThrow("kuralların tamamını");
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("eşleşmeyen tekrar ve eskisiyle aynı şifre reddedilir", async () => {
    await expect(
      changeOwnPassword({
        currentPassword: "Eski1234",
        newPassword: GECERLI,
        confirmation: "Baska1234",
      })
    ).rejects.toThrow("eşleşmiyor");
    await expect(
      changeOwnPassword({
        currentPassword: GECERLI,
        newPassword: GECERLI,
        confirmation: GECERLI,
      })
    ).rejects.toThrow("aynı olamaz");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("⛔ mevcut şifre yanlışsa yeni şifre ASLA yazılmaz", async () => {
    signInWithPassword.mockResolvedValue({
      error: { status: 400, message: "Invalid login credentials" },
    });

    await expect(
      changeOwnPassword({
        currentPassword: "Yanlis123",
        newPassword: GECERLI,
        confirmation: GECERLI,
      })
    ).rejects.toThrow("Mevcut şifre yanlış.");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("çok deneme ayrı söylenir", async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 429 } });

    await expect(
      changeOwnPassword({
        currentPassword: "Eski1234",
        newPassword: GECERLI,
        confirmation: GECERLI,
      })
    ).rejects.toThrow("Çok fazla deneme");
  });

  it("mevcut şifre oturumun kendi hesabıyla doğrulanır, sonra yenisi yazılır", async () => {
    await changeOwnPassword({
      currentPassword: "Eski1234",
      newPassword: GECERLI,
      confirmation: GECERLI,
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "12345678@orbit.invalid",
      password: "Eski1234",
    });
    expect(updateUser).toHaveBeenCalledWith({ password: GECERLI });
    // Üretimde GoTrue olayı veritabanına düşmediği için iz uygulamadan yazılır.
    expect(rpc).toHaveBeenCalledWith("log_own_password_change");
  });

  it("⛔ şifre değişmezse denetim izi yazılmaz", async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 400 } });
    await expect(
      changeOwnPassword({
        currentPassword: "Yanlis123",
        newPassword: GECERLI,
        confirmation: GECERLI,
      })
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("iz yazılamazsa şifre değişikliği yine başarılıdır, uyarı düşülür", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      changeOwnPassword({
        currentPassword: "Eski1234",
        newPassword: GECERLI,
        confirmation: GECERLI,
      })
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "[ORBIT] Şifre değişimi denetim kaydına yazılamadı."
    );
    warn.mockRestore();
  });

  it("sunucu hatası Türkçe ve ham iletiyi göstermeden söylenir", async () => {
    updateUser.mockResolvedValue({
      error: { code: "unexpected", message: "internal detail" },
    });

    await expect(
      changeOwnPassword({
        currentPassword: "Eski1234",
        newPassword: GECERLI,
        confirmation: GECERLI,
      })
    ).rejects.toThrow("mevcut şifreniz geçerli kaldı");
  });
});

describe("ChangePasswordCard", () => {
  it("kapalıyken yalnız düğme görünür; demoda düğme kapalıdır", () => {
    const html = renderToStaticMarkup(
      createElement(ChangePasswordCard, { disabled: true })
    );
    expect(html).toContain("Şifremi değiştir");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Mevcut şifre");
  });
});
