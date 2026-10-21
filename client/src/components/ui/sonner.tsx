import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

// Tema `next-themes`'ten değil uygulamanın kendi kaynağından okunur:
// `next-themes` sağlayıcısı hiç kurulmamıştı ve kutucuklar hep "system"
// temasında kalıyordu (2026-10-18 depo denetimi).
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
