import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  // Testler hiçbir .env dosyası OKUMAZ (2026-09-30). Yerelde .env üretim
  // Supabase adresini taşıyor ve taklit edilmemiş bir çağrı gerçek üretime
  // gidiyordu: bir test dosyası her çalıştırmada üretimdeki switch-account'a
  // istek attı (üç günde ~80 reddedilmiş istek). CI'da .env yok; yerel test
  // ortamı artık CI ile aynı. Kapı: supabase/tests/deployment/testsNeverReachProduction.test.ts
  envDir: path.resolve(templateRoot, "supabase", "tests", "no-env"),
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  // Vite 8 JSX'i Oxc ile çevirir ve tsconfig'deki `"jsx": "preserve"`
  // ayarına uyar — testlerdeki .tsx dosyaları çevrilmeden kalıyordu (Vite 7
  // bu ayarı yok sayıyordu). Uygulama derlemesinde React eklentisi çevirir;
  // testlerde eklenti yok. Testler `globalThis.React` koyduğu için klasik
  // çalışma zamanı (React.createElement) kullanılır.
  oxc: {
    jsx: { runtime: "classic" },
  },
  test: {
    environment: "node",
    include: [
      "client/src/**/*.test.ts",
      "client/src/**/*.spec.ts",
      // Depo yapısını ölçen testler. İstemci kodu değiller ama `pnpm test`
      // içinde koşmaları gerekiyor: `quality-gate` dal korumasında zorunlu bir
      // kontrol ve kapının bu tarafta olması, kuralın ayrı bir CI işi olarak
      // eklenmeyi beklemeden yürürlüğe girmesi demek (**K-19**).
      "supabase/tests/deployment/**/*.test.ts",
    ],
  },
});
