import { createClient } from "@supabase/supabase-js";
import {
  newTabId,
  removeLegacyAuthTokens,
  tabAuthStorageKey,
} from "./tabSessionKey";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. .env dosyanızı kontrol edin (bkz. .env.example)."
  );
}

/**
 * Kullanıcı bu sayfaya bir şifre sıfırlama bağlantısıyla mı geldi.
 *
 * `createClient`, varsayılan `detectSessionInUrl` davranışıyla adres
 * çubuğundaki hash'i okuyup temizler. `PASSWORD_RECOVERY` olayı ise kısa bir
 * gecikmeyle gelir. Bu bayrak istemci oluşturulmadan ÖNCE okunur; aksi halde
 * şifre belirleme ekranı, olay gelene kadar kısa süreliğine "bağlantı
 * geçersiz" gösterirdi.
 *
 * Modül gövdesindeki ifadeler sırayla çalıştığı için bu okuma deterministiktir.
 */
export const arrivedWithRecoveryLink =
  typeof window !== "undefined" &&
  window.location.hash.includes("type=recovery");

// Geliştirme ve demo ortamında yapılandırma eksikken modülün içe aktarılması sırasında
// uygulamanın çökmemesi için sözdizimsel olarak geçerli bir yer tutucu (placeholder).
// Üretim derlemesinde (production build) bu iki değişkenin varlığı vite.config.ts
// tarafından zorunlu kılındığı için üretimde buraya düşmek imkânsızdır (K-04, v1.3-00).
//
// Paylaşılan dershane bilgisayarında ikinci sekme açıldığında önceki
// kullanıcının oturumunun devralınmasını engellemek için oturum jetonu
// `sessionStorage`'da saklanır. Böylece her sekme kendi bağımsız oturumunu
// yürütür ve sekme kapatıldığında oturum sonlanır (#132).
//
// Anahtar sekmeye özgüdür (B17, 2026-10-07): auth-js giriş/çıkış olaylarını
// anahtarla aynı adlı bir kanaldan bütün sekmelere duyuruyor; ortak anahtar,
// bir sekmedeki girişin öbür sekmenin ekranını değiştirmesi demekti. Ayrıntı
// `tabSessionKey.ts`.
const tabStorage =
  typeof window !== "undefined" ? window.sessionStorage : undefined;
removeLegacyAuthTokens(tabStorage);

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storage: tabStorage,
      storageKey: tabAuthStorageKey(tabStorage, newTabId),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
