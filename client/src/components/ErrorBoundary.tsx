import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";
import { reportError } from "@/errorReporting/installErrorReporting";

interface Props {
  children: ReactNode;
  /**
   * "section": yalnız bir sekmenin yerini alan küçük hata kutusu
   * (2026-10-11). Uygulama kökündeki sınır tek başınayken bir sekmedeki
   * çökme menü dahil bütün uygulamayı hata ekranına çeviriyordu.
   */
  variant?: "page" | "section";
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    reportError("render", error);
  }

  render() {
    if (this.state.hasError && this.props.variant === "section") {
      return (
        <div
          role="alert"
          className="mx-auto mt-10 max-w-xl rounded-2xl border border-rose-100 bg-white p-6 text-center"
        >
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-rose-500" />
          <h2 className="text-[15px] font-extrabold text-slate-900">
            Bu bölüm açılamadı
          </h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Menüden başka bir bölüme geçebilir ya da sayfayı yenileyebilirsiniz;
            sorun sürerse kurum yöneticinize haber verin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-[12px] font-bold text-white hover:bg-slate-800"
          >
            <RotateCcw size={14} />
            Sayfayı yenile
          </button>
        </div>
      );
    }
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-2">Beklenmeyen bir hata oluştu.</h2>
            {/* Teknik ayrıntı kullanıcıya gösterilmiyor: kimseye bir şey
                anlatmıyordu ve kişisel veri taşıyabilirdi. Oturum açıksa hata,
                kişisel veri ayıklanarak platform paneline yazılır (v1.5-06);
                açık değilse yazılamaz, bu yüzden ekran "kaydedildi" demiyor. */}
            <p className="text-sm text-muted-foreground mb-6 text-center">
              Sayfayı yenileyip tekrar deneyin; sorun sürerse kurum yöneticinize
              haber verin.
            </p>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Sayfayı yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
