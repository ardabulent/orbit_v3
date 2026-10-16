// ORBIT Education Platform: Modern, multi-role CRM and operations dashboard for education centers.
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { lazy, Suspense } from "react";

// Platform paneli ve şifre ekranları ayrı parça (2026-10-11): dershane
// kullanıcısının telefonuna operatör paneli inmesin.
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const Platform = lazy(() => import("./pages/Platform"));
const NotFound = lazy(() => import("@/pages/NotFound"));

/**
 * ⚠️ Bu rota listesinin **derleyicinin göremediği bir ikizi var**:
 * `vercel.json`'daki `rewrites` girdisi. Buraya yeni bir rota eklerken oraya da
 * eklenmeli, yoksa rota yalnızca uygulama içi gezinmede çalışır ve adres
 * çubuğuna yazıldığında Vercel 404 döner.
 *
 * Neden böyle: eskiden `vercel.json` her yolu (`/(.*)`) `index.html`'e
 * yönlendiriyordu. SPA'da yaygın olan bu kalıp, olmayan bir sayfaya da
 * `HTTP 200` döndürüyordu — `/olmayan-sayfa` ve hatta `/robots.txt` dahil
 * (#146). Tarayıcı ve botlar sayfayı geçerli sanıyordu.
 *
 * Rota sayısı beş ve hepsi sabit olduğu için liste açıkça yazıldı; bilinen
 * yollar `index.html`'e gider, geri kalan her şey Vercel'in gerçek 404'üne
 * düşer. Bedeli bu ikizlik — ama sessiz bir yalan yerine, unutulduğunda hemen
 * görülen bir hata.
 *
 * Aşağıdaki `<Route component={NotFound} />` yine de gerekli: uygulama içi
 * gezinmede sunucuya istek gitmez, o durumda bu dal devreye girer.
 */
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      {/*
        Şifre akışı rotaları kimlik doğrulaması gerektirmez; kullanıcı buraya
        zaten oturumu olmadığı için gelir. /sifre-belirle adresi, Supabase
        şifre sıfırlama e-postasındaki bağlantının hedefidir ve bu değer
        Supabase Redirect URL listesiyle uyumlu olmalıdır
        (bkz. .ai/PLATFORM_SETTINGS.md bölüm 3.2).
      */}
      <Route path="/sifre-sifirla" component={ForgotPassword} />
      <Route path="/sifre-belirle" component={SetPassword} />
      {/*
        Platform operatörü paneli. Giriş ekranı ayrı DEĞİL — tek giriş, girişten
        sonra dallanma; bkz. `.ai/DECISION_LOG.md`.
      */}
      <Route path="/platform" component={Platform} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Suspense
            fallback={
              <div
                role="status"
                className="grid min-h-screen place-items-center text-[12px] font-semibold text-slate-400"
              >
                Yükleniyor…
              </div>
            }
          >
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
