import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  History,
  FileText,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  NotebookPen,
  School,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import type { Section } from "./types";

export const allNav: {
  label: Section;
  icon: typeof LayoutDashboard;
  group: "Ana çalışma alanı" | "Kurum yönetimi";
}[] = [
  {
    label: "Genel Bakış",
    icon: LayoutDashboard,
    group: "Ana çalışma alanı",
  },
  {
    label: "Gün Planı",
    icon: ListTodo,
    group: "Ana çalışma alanı",
  },
  {
    label: "Öğrenciler",
    icon: Users,
    group: "Ana çalışma alanı",
  },
  {
    label: "Sınıflar",
    icon: School,
    group: "Ana çalışma alanı",
  },
  {
    label: "Ders Programı",
    icon: CalendarDays,
    group: "Ana çalışma alanı",
  },
  {
    label: "Yoklama",
    icon: ClipboardCheck,
    group: "Ana çalışma alanı",
  },
  {
    label: "Sınavlar",
    icon: BarChart3,
    group: "Ana çalışma alanı",
  },
  {
    label: "Ödevler",
    icon: NotebookPen,
    group: "Ana çalışma alanı",
  },
  {
    label: "İletişim",
    icon: MessageSquare,
    group: "Ana çalışma alanı",
  },
  {
    label: "Kayıt ve Ödemeler",
    icon: WalletCards,
    group: "Kurum yönetimi",
  },
  {
    label: "Raporlar",
    icon: FileText,
    group: "Kurum yönetimi",
  },
  {
    label: "Denetim Kaydı",
    icon: History,
    group: "Kurum yönetimi",
  },
  {
    label: "Ayarlar",
    icon: Settings,
    group: "Kurum yönetimi",
  },
];
