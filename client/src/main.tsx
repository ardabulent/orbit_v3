import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { purgeDemoStorageIfProduction } from "./lib/demoStorage";
import { installErrorReporting } from "./errorReporting/installErrorReporting";
import "./index.css";

// Üretim ortamında geçmişten kalan ölü demo anahtarlarını uygulama başlangıcında temizle
purgeDemoStorageIfProduction();

// Ekrandaki yakalanmamış hatalar kendi veritabanımıza yazılır (v1.5-06).
installErrorReporting();

function isPermissionOrAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as Record<string, unknown>;
  const status = err.status ?? err.statusCode;
  if (status === 401 || status === 403) {
    return true;
  }
  if (err.code === "42501" || err.code === "PGRST301") {
    return true;
  }
  return false;
}

/**
 * React Query istemci varsayılanları (v1.3-00, mimari kararlar).
 *
 * 1. Yeniden deneme (retry): İzin ve yetki hatalarında (401, 403, 42501) kesinlikle
 *    yeniden deneme yapılmaz. RLS'in reddettiği bir sorgu tekrar denense de reddedilir;
 *    tek sonucu kullanıcının hatayı üç kat geç görmesi ve sunucuya gereksiz yük
 *    binmesidir. Geçici ağ hatalarında 1 kez denemek yeterlidir.
 *
 * 2. Pencere odağında yeniden çekme (refetchOnWindowFocus): Kapalıdır.
 *    Dershanedeki ortak bilgisayarlarda sekmeler arası geçiş yoğundur; her odaklanmada
 *    sorgu üretmek ücretsiz katman kotalarını tüketebilir. Veri tazeliği v1.3-05'te
 *    Realtime invalidation ile kontrollü olarak sağlanacaktır.
 *
 * 3. Bayatlama süresi (staleTime): 1 dakika (60_000 ms).
 *    Ders programı, öğrenci listesi ve denetim kayıtları saniyeler içinde değişmez.
 *    Sıfır bayatlama süresi diyalog ve sayfa geçişlerinde aşırı ağ trafiği yaratır;
 *    1 dakikalık kısa bellek paylaşılan istemcide akıcı bir deneyim sunar.
 *
 * 4. Ağ kipi "always": ayrıntı aşağıda, `networkMode` satırında.
 *
 * 5. Hata yönetimi: Genel bildirim (toast) kurulmaz. Hata sorgunun kendisinde
 *    bırakılır ve doğrudan ilgili ekrana yansır; global toast hangi ekranın çöktüğünü
 *    gizler ve ekran düzeyindeki hata durumlarını (EmptyState) anlamsızlaştırır.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isPermissionOrAuthError(error)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
      // Bağlantı yokken ya da sekme arka plandayken BEKLEME, dene ve hatayı
      // ver (2026-10-07). Varsayılan "online" kipinde sorgu duraklatılıyor;
      // duraklatılmış sorgu ne yükleniyor ne hata sayılıyor ve ekranlar onu
      // "veri yok" diye çiziyordu: internet kesilen yönetici Raporlar'da
      // "dikkat gerektiren öğrenci yok" görüyordu (tarayıcıda ölçüldü).
      // Bağlantı gelince hatalı sorgular `refetchOnReconnect` ile yenilenir.
      networkMode: "always",
    },
    mutations: {
      // Aynı sebeple: çevrimdışı bir kayıt "Kaydediliyor…" durumunda asılı
      // kalmasın, hemen Türkçe bağlantı hatasıyla dönsün.
      networkMode: "always",
    },
  },
});

/**
 * `<StrictMode>` — yalnızca geliştirmede etkin, üretim derlemesinde hiçbir şey
 * yapmaz (v1.3-02).
 *
 * Açtığı şey şu: React her efekti bir kez kurup söküp yeniden kuruyor ve her
 * render'ı iki kez çalıştırıyor. Bu, temizliği eksik bir efekti ve saf olmayan
 * bir render'ı **geliştirmede** görünür kılar; kapalıyken ikisi de yalnızca
 * üretimde, kullanıcıda ortaya çıkar.
 *
 * Bugüne kadar kapalıydı ve bunun bir bedeli ölçüldü: #213 (kimlik çözümü
 * sürerken yapılan çıkışın geri alınması) ve #221 (her girişte kimliğin iki
 * kez okunması) ikisi de efekt zamanlaması hatalarıydı ve ikisi de aylarca
 * fark edilmedi.
 *
 * **Neden şimdi açılabiliyor:** v1.3-01 ve v1.3-02 bu efektlerin neredeyse
 * hepsini yeniden yazdı. `eslint-plugin-react-hooks` v7 aynı turda açıldı ve
 * depoda gösterdiği 10 hatanın onu da kapandı (#196). Daha önce açmak,
 * yeniden yazılacak kodu düzeltmek olurdu.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
