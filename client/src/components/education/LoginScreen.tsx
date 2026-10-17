import { useState } from "react";
import { isDemoMode } from "@/auth/runtime";
import type { FormEvent } from "react";
import { OrbitMark } from "@/components/OrbitMark";
import { Link } from "wouter";
import {
  ChevronRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { LoginInput } from "@/auth/types";
import { resolveLoginIdentifier } from "@/auth/loginIdentifier";
import { demoRoleNames, roleMeta } from "./roleMeta";
import { roleEmail } from "./demoData";
import { Badge } from "./shared";
import type { Role } from "./types";

/**
 * Derleme anında belli olan demo bayrağı (2026-10-17, Hız 2). Ayrıntı ve
 * gerekçe: `educationData.ts`'teki aynı adlı sabit. Kapı:
 * `scripts/check-demo-leak.mjs`.
 */
const DEMO_BUILD =
  typeof __ORBIT_DEMO_MODE__ === "boolean" ? __ORBIT_DEMO_MODE__ : isDemoMode;

export function EducationLoginScreen({
  onLogin,
  demoMode,
}: {
  onLogin: (input: LoginInput) => Promise<void>;
  demoMode: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<Role>("admin");
  const [identifier, setIdentifier] = useState(
    DEMO_BUILD && demoMode ? roleEmail.admin : ""
  );
  // `isDemoMode` derleme sabiti: üretimde `false`a katlanır ve demo şifresi
  // pakete girmez (B12, 2026-10-11). `demoMode` tek başına çalışma anında
  // gelen bir değer olduğu için dalı elemeye yetmiyordu.
  const [password, setPassword] = useState(
    DEMO_BUILD && demoMode ? "demo123" : ""
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const selectRole = (role: Role) => {
    if (!DEMO_BUILD || !demoMode) return;
    setSelectedRole(role);
    setIdentifier(roleEmail[role]);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      // Girdi burada çözümleniyor: 8 haneli numara sentetik adrese çevrilir,
      // `@` içeren her şey e-posta kabul edilir. Çözümlenemezse Supabase'e
      // olduğu gibi gönderiliyor — kendi hata mesajımızı üretmek, hangi
      // numaraların var olduğunu sızdırırdı.
      const resolved = resolveLoginIdentifier(identifier);

      await onLogin({
        email: resolved ? resolved.email : identifier.trim(),
        password,
        demoRole: selectedRole,
      });
      toast.success(
        demoMode
          ? `Hoş geldiniz, ${demoRoleNames[selectedRole]}`
          : "ORBIT oturumu açıldı"
      );
    } catch (error) {
      toast.error("Giriş bilgileri doğrulanamadı", {
        description:
          error instanceof Error
            ? error.message
            : "Lütfen bilgilerinizi kontrol edip tekrar deneyin.",
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="min-h-screen overflow-hidden bg-[#eef7ff] px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1200px] flex-col">
        <header className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 p-2">
            <OrbitMark
              inverted
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <div>
            <p className="font-orbit text-[20px] font-extrabold tracking-[-.06em] text-slate-900">
              ORBIT
            </p>
            <p className="-mt-1 text-[9px] font-bold uppercase tracking-[.16em] text-blue-600">
              Education
            </p>
          </div>
        </header>
        <section className="my-auto grid overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_26px_80px_rgba(75,135,180,.18)] lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="p-7 sm:p-10 lg:p-14">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">
              Eğitim kurumunuz için ortak çalışma alanı
            </p>
            <h1 className="mt-3 font-display text-[31px] font-extrabold tracking-[-.06em] text-slate-950 sm:text-[38px]">
              İyi eğitim, iyi takip ile başlar.
            </h1>
            <p className="mt-3 max-w-md text-[13px] leading-6 text-slate-500">
              Öğrenci, veli, öğretmen ve kurum yöneticileri aynı akademik
              akışta; herkes yalnızca kendisine ait çalışma alanını görür.
            </p>
            {/*
              Rol kartları YALNIZCA demo modunda görünür. Gerçek girişte rol
              kullanıcının kendi üyelik kaydından gelir; seçilecek bir şey
              yoktur. Önceden kartlar `disabled` olarak duruyordu — tıklanmayan
              ama görünen dört kart, "önce rolümü seçmem mi gerekiyor?"
              sorusunu doğuruyordu ve giriş ekranının tek işi bunu sormamaktı.
            */}
            {demoMode ? (
              <div className="mt-7 grid grid-cols-2 gap-2">
                {(Object.keys(roleMeta) as Role[]).map(role => {
                  const Icon = roleMeta[role].icon;
                  const selected = selectedRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => selectRole(role)}
                      className={`rounded-xl border p-3 text-left transition ${selected ? "border-slate-900 bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,.12)]" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"}`}
                    >
                      <Icon
                        className={`h-4 w-4 ${selected ? "text-white" : "text-blue-600"}`}
                      />
                      <p className="mt-2 text-[11px] font-extrabold">
                        {roleMeta[role].label}
                      </p>
                      <p
                        className={`mt-0.5 text-[9px] ${selected ? "text-white/70" : "text-slate-400"}`}
                      >
                        {roleMeta[role].description}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <form onSubmit={submit} className="mt-7 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                  {demoMode ? "E-posta adresi" : "Giriş numarası veya e-posta"}
                </span>
                {/*
                  `type="email"` DEĞİL. Tarayıcı doğrulaması `10011000` girdisini
                  "@ eksik" diye reddediyordu ve numarayla giriş hiç mümkün
                  olmuyordu. Tek alan iki biçimi birden kabul ediyor; ayrımı
                  `resolveLoginIdentifier` yapıyor.
                */}
                <input
                  value={identifier}
                  onChange={event => setIdentifier(event.target.value)}
                  type="text"
                  inputMode={demoMode ? "email" : "text"}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={demoMode ? undefined : "10011000"}
                  className="h-12 w-full rounded-xl border border-slate-200 px-3 text-[13px] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
                {!demoMode ? (
                  <span className="mt-1.5 block text-[10px] leading-4 text-slate-400">
                    Size verilen 8 haneli numarayı yazın. E-posta adresi
                    tanımlıysa onunla da giriş yapabilirsiniz.
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                  Şifre
                </span>
                <div className="relative">
                  <input
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    type={passwordVisible ? "text" : "password"}
                    className="h-12 w-full rounded-xl border border-slate-200 px-3 pr-12 text-[13px] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                  <button
                    type="button"
                    aria-label={
                      passwordVisible ? "Şifreyi gizle" : "Şifreyi göster"
                    }
                    onClick={() => setPasswordVisible(value => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {passwordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>
              <button
                disabled={loading}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[13px] font-extrabold text-white shadow-[0_10px_18px_rgba(15,23,42,.12)] transition hover:bg-slate-800 disabled:opacity-70"
              >
                {loading
                  ? "Giriş yapılıyor"
                  : demoMode
                    ? `${roleMeta[selectedRole].label} olarak giriş yap`
                    : "Giriş yap"}
                <ChevronRight className="h-4 w-4" />
              </button>
            </form>
            {DEMO_BUILD && demoMode ? (
              <p className="mt-5 text-[10px] leading-5 text-slate-400">
                Demo şifresi:{" "}
                <strong className="font-bold text-slate-600">demo123</strong>.
                Rol kartı seçildiğinde ilgili demo e-posta hesabı otomatik
                doldurulur.
              </p>
            ) : (
              <>
                <p className="mt-4 text-[11px] leading-5">
                  <Link
                    href="/sifre-sifirla"
                    className="font-bold text-blue-600 hover:text-blue-700"
                  >
                    Şifremi unuttum
                  </Link>
                </p>
                <p className="mt-3 text-[10px] leading-5 text-slate-400">
                  Rolünüz ve erişebileceğiniz kurum, güvenli üyelik kaydınızdan
                  otomatik belirlenir.
                </p>
              </>
            )}
          </div>
          <aside className="relative hidden overflow-hidden bg-slate-900 p-10 text-white lg:block">
            <div className="absolute -right-20 -top-16 h-72 w-72 rounded-full bg-blue-500/35 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between border-b border-white/15 pb-5">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-sky-200">
                    ORBIT education
                  </p>
                  <p className="mt-1 text-[11px] text-slate-300">
                    Kurum genel görünümü
                  </p>
                </div>
                {/*
                  Önceden burada yeşil bir "Sistemler güncel" rozeti vardı ve
                  bu bir DURUM İDDİASIYDI — hiçbir şey ölçmeden, her koşulda.
                  Yerine panelin ne olduğunu söyleyen nötr bir etiket kondu
                  (#144).
                */}
                <Badge tone="slate">Örnek görünüm</Badge>
              </div>
              <h2 className="mt-10 max-w-md font-display text-[38px] font-extrabold leading-[1.08] tracking-[-.06em]">
                Eğitim ekibinizin günlük ritmi, tek yerde.
              </h2>
              <p className="mt-4 max-w-md text-[13px] leading-6 text-slate-300">
                Devam, sınav, ödev, veli iletişimi ve takip gerektiren
                öğrenciler doğru kişiye doğru anda ulaşır.
              </p>
              <div className="mt-12 rounded-2xl border border-white/15 bg-white/[.06] p-4">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/15 bg-white/[.06]">
                      <LayoutDashboard className="h-3.5 w-3.5 text-sky-100" />
                    </span>
                    <span className="text-[11px] font-bold text-slate-100">
                      ORBIT'in kapsadığı alanlar
                    </span>
                  </div>
                </div>
                {/*
                  Burada bir "Bugünün eğitim özeti" kartı vardı: %93 devam,
                  54 aktif öğrenci, 4 tamamlanmış yoklama, sabit "15 Ağustos"
                  tarihi ve "3 eğitim otomasyonu bugün çalıştı" satırı (#144).
                  Hiçbiri ölçülmüyordu; #116'da panelden silinen sayıların
                  aynısıydı ve giriş ekranı kimlik doğrulaması istemediği için
                  denetim turlarının hiçbirinde görülmemişti.

                  Başlık ve tarih taşıdığı için süsleme gibi değil CANLI VERİ
                  gibi okunuyordu: tek öğrencisi olmayan pilot kurumun
                  yöneticisi giriş yapmadan önce "%93 devam, 54 aktif öğrenci"
                  görüyordu. K-03 — çözümlenemeyen veri uydurulmuş değerle
                  gösterilmez; burada çözümlenecek bir veri bile yoktu.

                  Yerine sayı taşımayan kapsam etiketleri kondu. Bunlar bir
                  ölçüm değil, ürünün ne yaptığının listesi — giriş ekranının
                  satış tarafı korunuyor, veri iddiası kalkıyor.
                */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    "Yoklama ve devam",
                    "Sınav ve sonuç analizi",
                    "Ödev takibi",
                    "Ödeme ve taksit takibi",
                  ].map(alan => (
                    <div
                      key={alan}
                      className="rounded-xl border border-white/15 p-3 text-[10px] font-semibold text-slate-100"
                    >
                      {alan}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                  <Sparkles className="h-4 w-4 text-emerald-300" />
                  <p className="text-[10px] font-semibold text-slate-100">
                    Kurumunuzun kendi verisi giriş yaptıktan sonra görünür.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
