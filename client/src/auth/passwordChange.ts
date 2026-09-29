import { supabase } from "@/lib/supabaseClient";
import { findPasswordProblem } from "./passwordPolicy";

/**
 * Kişinin kendi isteğiyle şifresini değiştirmesi (karar 2026-09-29).
 *
 * 2026-08-24 kararı: "Değiştirme — mevcut şifreyi biliyorum; eski şifrenin
 * kendisi kanıt." Bu yüzden önce mevcut şifre doğrulanır, sonra yenisi
 * yazılır. Panelde `Require current password` kapalı olduğu için (bkz.
 * PLATFORM_SETTINGS §3) kanıtı sunucu kendiliğinden istemez; burada aynı
 * hesaba mevcut şifreyle yeniden giriş yapılarak kanıtlanır. Bu, açık kalan
 * bir oturumun başında oturan birinin şifreyi değiştirip hesabı ele
 * geçirmesini önler.
 *
 * Denetim kaydı veritabanında yazılır (`handle_password_change`,
 * 20261016000000); şifrenin kendisi hiçbir yere — log, analitik, hata
 * iletisi — gitmez.
 */
export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}): Promise<void> {
  const problem = findPasswordProblem(input.newPassword, input.confirmation);
  if (problem) throw new Error(problem);
  if (input.newPassword === input.currentPassword) {
    throw new Error("Yeni şifre mevcut şifreyle aynı olamaz.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const email = userData?.user?.email;
  if (userError || !email) {
    throw new Error("Oturum okunamadı; çıkış yapıp yeniden girin.");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  });
  if (signInError) {
    throw new Error(
      signInError.status === 429
        ? "Çok fazla deneme yapıldı; birkaç dakika sonra yeniden deneyin."
        : "Mevcut şifre yanlış."
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  });
  if (error) {
    throw new Error(
      error.code === "same_password"
        ? "Yeni şifre mevcut şifreyle aynı olamaz."
        : error.code === "weak_password"
          ? "Yeni şifre kuralları karşılamıyor."
          : "Şifre değiştirilemedi; mevcut şifreniz geçerli kaldı. Lütfen yeniden deneyin."
    );
  }
}
