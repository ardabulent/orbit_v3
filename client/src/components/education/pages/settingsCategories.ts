import {
  Archive,
  Bell,
  Lock,
  Palette,
  RotateCcw,
  School,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "../types";

export type SettingsCategoryId =
  | "profil"
  | "kurum"
  | "uyeler"
  | "bildirimler"
  | "roller"
  | "sistem"
  | "guvenlik"
  | "tema"
  | "arsiv"
  | "veri-yonetimi"
  | "veri-ice-aktarma";

export type SettingsCategoryMeta = {
  id: SettingsCategoryId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  eyebrow: string;
  roles: Role[];
};

const ALL_ROLES: Role[] = ["admin", "teacher", "student", "parent"];
const ADMIN_ONLY: Role[] = ["admin"];

export const SETTINGS_CATEGORIES: SettingsCategoryMeta[] = [
  {
    id: "profil",
    title: "Profil",
    subtitle: "Kişisel hesap ve iletişim",
    icon: User,
    eyebrow: "Kişisel bilgiler",
    roles: ALL_ROLES,
  },
  {
    id: "kurum",
    title: "Kurum",
    subtitle: "Şube ve kurum bilgileri",
    icon: School,
    eyebrow: "Kurum ve şube bilgileri",
    roles: ADMIN_ONLY,
  },
  {
    id: "uyeler",
    title: "Üyeler",
    subtitle: "Kurum içi kullanıcı listesi",
    icon: Users,
    eyebrow: "Kullanıcılar ve roller",
    roles: ADMIN_ONLY,
  },
  {
    id: "bildirimler",
    title: "Bildirimler",
    subtitle: "Takip ve hatırlatma tercihleri",
    icon: Bell,
    eyebrow: "Bildirim tercihleri",
    roles: ALL_ROLES,
  },
  {
    id: "roller",
    title: "Roller ve Erişim",
    subtitle: "Rol bazlı görünürlük matrisi",
    icon: ShieldCheck,
    eyebrow: "Erişim matrisi",
    roles: ADMIN_ONLY,
  },
  {
    id: "sistem",
    title: "Sistem",
    subtitle: "Genel çalışma varsayımları",
    icon: SlidersHorizontal,
    eyebrow: "Sistem varsayımları",
    roles: ADMIN_ONLY,
  },
  {
    id: "guvenlik",
    title: "Güvenlik",
    subtitle: "Oturum ve erişim tercihleri",
    icon: Lock,
    eyebrow: "Hesap güvenliği",
    roles: ALL_ROLES,
  },
  {
    id: "tema",
    title: "Tema",
    subtitle: "Arayüz renk ve görünüm tercihi",
    icon: Palette,
    eyebrow: "Görünüm tercihleri",
    roles: ALL_ROLES,
  },
  {
    id: "arsiv",
    title: "Arşiv",
    subtitle: "Arşivlenen kayıtları geri alın",
    icon: Archive,
    eyebrow: "Arşivlenen kayıtlar",
    roles: ADMIN_ONLY,
  },
  {
    id: "veri-yonetimi",
    title: "Veri Yönetimi",
    subtitle: "Dışa aktarma ve sıfırlama",
    icon: RotateCcw,
    eyebrow: "Dışa aktarma ve sıfırlama",
    roles: ADMIN_ONLY,
  },
  {
    id: "veri-ice-aktarma",
    title: "Veri İçe Aktarma",
    subtitle: "Eski kayıtları sisteme aktarın",
    icon: UploadCloud,
    eyebrow: "Toplu veri aktarımı",
    roles: ADMIN_ONLY,
  },
];
