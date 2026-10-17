/**
 * Rol bazlı kapsam filtreleri — **artık bir güvenlik sınırı değil.**
 *
 * Kapsam v1.2-01…09'da veritabanına taşındı: on sekiz iş tablosu, 97 RLS
 * politikası ve altı kapsam yardımcısı. Yönetici kurumdan, öğretmen
 * **atamadan**, öğrenci kendi kaydından, veli **bağdan** görüyor — ve bu karar
 * artık sunucuda, çağıranın kimliğiyle veriliyor.
 *
 * Bu dosyanın üretim dalı bu yüzden **gelen satırları olduğu gibi geçiriyor.**
 * Kapsamlama zaten yapılmış hâlde geliyor; burada ikinci kez filtrelemek
 * yanlış olurdu.
 *
 * **Neden artık boş küme dönmüyor (v1.2-10).** Önceki hâl `return []` idi ve o
 * gün doğruydu: kapsamı çözecek hiçbir şey yoktu, bilinmeyende dar tarafta
 * kalınmıştı (K-04). Ama kapsam artık bilinmiyor değil — biliniyor ve
 * uygulanıyor. Boş küme bırakılsaydı, gerçek veri aktığı gün **RLS'in doğru
 * getirdiği satırları ekran yok ederdi**: her öğretmen, öğrenci ve veli boş bir
 * panel görür, sebebi de hiçbir hata mesajında görünmezdi. Bu satırlar bir
 * koruma değil, patlamayı bekleyen bir mayındı.
 *
 * **Sınırın nerede olduğu önemli:** bu dosya güvenlik yapmıyor, RLS yapıyor.
 * Buradaki `if (isDemo)` dalları yalnızca satış sunumunun tutarlı görünmesi
 * için; demo verisi RLS'ten geçmediği için kendi filtresine ihtiyaç duyuyor.
 *
 * **Geçirgenliğin tek dayanağı:** üretim dalına yalnızca RLS'ten geçmiş veri
 * ulaşmalı. Bugün bu yapısal olarak garanti: `isDemoMode` derleme zamanı
 * sabitidir ve veri kaynağı (`educationData.ts`) aynı sabitle kapılıdır, yani
 * demo verisiyle üretim dalı bir araya gelemez. Bu ikisi bir gün ayrışırsa
 * geçirgenlik sızıntıya döner — o yüzden ayrışmamalı.
 *
 * Referans: Issue #136, K-04, K-06, K-11.
 */

import {
  DEMO_CLASS_MENTOR,
  DEMO_STUDENT_CLASS_GROUP,
  DEMO_STUDENT_ID,
  DEMO_STUDENT_NAME,
  DEMO_TEACHER_CLASS_GROUPS,
  DEMO_TEACHER_NAMES,
} from "./demoData";
import { isDemoMode } from "@/auth/runtime";
import type {
  ClassGroup,
  Homework,
  PaymentRow,
  Role,
  ScheduleItem,
  Student,
} from "./types";

/**
 * Derleme anında belli olan demo bayrağı (2026-10-17, Hız 2). Ayrıntı ve
 * gerekçe: `educationData.ts`'teki aynı adlı sabit. Kapı:
 * `scripts/check-demo-leak.mjs`.
 */
const DEMO_BUILD =
  typeof __ORBIT_DEMO_MODE__ === "boolean" ? __ORBIT_DEMO_MODE__ : isDemoMode;

/**
 * Öğretmen paneli (TeacherDashboard) için ders programı filtresi.
 */
export function filterScheduleForTeacher(
  schedule: ScheduleItem[],
  isDemo: boolean
): ScheduleItem[] {
  if (DEMO_BUILD && isDemo) {
    return schedule.filter(item =>
      DEMO_TEACHER_NAMES.includes(
        item.teacher as (typeof DEMO_TEACHER_NAMES)[number]
      )
    );
  }
  // Kapsam sunucuda çözüldü; gelen satırlar zaten bu kullanıcıya ait.
  return schedule;
}

/**
 * Öğrenci listesi (EducationPlatform / StudentsPage) için rol bazlı filtre.
 */
export function filterStudentsForRole(
  students: Student[],
  role: Role,
  isDemo: boolean
): Student[] {
  if (role === "admin") {
    return students;
  }
  if (DEMO_BUILD && isDemo) {
    if (role === "teacher") {
      return students.filter(student =>
        DEMO_TEACHER_CLASS_GROUPS.includes(
          student.group as (typeof DEMO_TEACHER_CLASS_GROUPS)[number]
        )
      );
    }
    if (role === "student" || role === "parent") {
      return students.filter(student => student.id === DEMO_STUDENT_ID);
    }
    // Demo modunda bu rol için tanımlı bir filtre yok; kapı kapalı.
    // Bu `return` ÜRETİM dalı değil — üretimin cevabı aşağıdaki
    // geçirgenliktir. İkisi ayrı olmak zorunda: demo verisi RLS'ten
    // geçmediği için kendi kapısına muhtaç.
    return [];
  }
  // Kapsam sunucuda çözüldü; gelen satırlar zaten bu kullanıcıya ait.
  return students;
}

/**
 * Yoklama ekranı (AttendancePage) için öğrenci filtresi.
 */
export function filterAttendanceStudents(
  students: Student[],
  role: Role,
  isDemo: boolean
): Student[] {
  if (role === "admin") {
    return students;
  }
  if (DEMO_BUILD && isDemo) {
    if (role === "teacher") {
      return students.filter(student =>
        DEMO_TEACHER_CLASS_GROUPS.includes(
          student.group as (typeof DEMO_TEACHER_CLASS_GROUPS)[number]
        )
      );
    }
    // Demo modunda bu rol için tanımlı bir filtre yok; kapı kapalı.
    // Bu `return` ÜRETİM dalı değil — üretimin cevabı aşağıdaki
    // geçirgenliktir. İkisi ayrı olmak zorunda: demo verisi RLS'ten
    // geçmediği için kendi kapısına muhtaç.
    return [];
  }
  // Kapsam sunucuda çözüldü; gelen satırlar zaten bu kullanıcıya ait.
  return students;
}

/**
 * Sınıflar ekranı (ClassesPage) için sınıf filtresi.
 */
export function filterClassesForRole(
  classes: ClassGroup[],
  role: Role,
  isDemo: boolean
): ClassGroup[] {
  if (role === "admin") {
    return classes;
  }
  if (DEMO_BUILD && isDemo) {
    if (role === "teacher") {
      return classes.filter(group => group.mentor === DEMO_CLASS_MENTOR);
    }
    // Demo modunda bu rol için tanımlı bir filtre yok; kapı kapalı.
    // Bu `return` ÜRETİM dalı değil — üretimin cevabı aşağıdaki
    // geçirgenliktir. İkisi ayrı olmak zorunda: demo verisi RLS'ten
    // geçmediği için kendi kapısına muhtaç.
    return [];
  }
  // Kapsam sunucuda çözüldü; gelen satırlar zaten bu kullanıcıya ait.
  return classes;
}

/**
 * Ödevler ekranı (HomeworkPage) için ödev listesi filtresi.
 */
export function filterHomeworkForRole(
  homework: Homework[],
  role: Role,
  isDemo: boolean
): Homework[] {
  if (role === "admin") {
    return homework;
  }
  if (DEMO_BUILD && isDemo) {
    if (role === "teacher") {
      return homework.filter(item =>
        DEMO_TEACHER_CLASS_GROUPS.includes(
          item.classGroup as (typeof DEMO_TEACHER_CLASS_GROUPS)[number]
        )
      );
    }
    if (role === "student" || role === "parent") {
      return homework.filter(
        item => item.classGroup === DEMO_STUDENT_CLASS_GROUP
      );
    }
    // Demo modunda bu rol için tanımlı bir filtre yok; kapı kapalı.
    // Bu `return` ÜRETİM dalı değil — üretimin cevabı aşağıdaki
    // geçirgenliktir. İkisi ayrı olmak zorunda: demo verisi RLS'ten
    // geçmediği için kendi kapısına muhtaç.
    return [];
  }
  // Kapsam sunucuda çözüldü; gelen satırlar zaten bu kullanıcıya ait.
  return homework;
}

/**
 * Kayıt ve ödemeler ekranı (PaymentsPage) için satır filtresi.
 */
export function filterPaymentsForRole(
  paymentRows: PaymentRow[],
  role: Role,
  isDemo: boolean
): PaymentRow[] {
  if (role === "admin") {
    return paymentRows;
  }
  if (DEMO_BUILD && isDemo) {
    if (role === "parent") {
      return paymentRows.filter(item => item.student === DEMO_STUDENT_NAME);
    }
    // Demo modunda bu rol için tanımlı bir filtre yok; kapı kapalı.
    // Bu `return` ÜRETİM dalı değil — üretimin cevabı aşağıdaki
    // geçirgenliktir. İkisi ayrı olmak zorunda: demo verisi RLS'ten
    // geçmediği için kendi kapısına muhtaç.
    return [];
  }
  // Kapsam sunucuda çözüldü; gelen satırlar zaten bu kullanıcıya ait.
  return paymentRows;
}

/**
 * Ders programı ekranı (SchedulePage) için program filtresi.
 */
export function filterScheduleForRole(
  schedule: ScheduleItem[],
  role: Role,
  isDemo: boolean
): ScheduleItem[] {
  if (role === "admin") {
    return schedule;
  }
  if (DEMO_BUILD && isDemo) {
    if (role === "student" || role === "parent") {
      return schedule.filter(
        item =>
          item.group === DEMO_STUDENT_CLASS_GROUP ||
          item.group === DEMO_STUDENT_NAME
      );
    }
    if (role === "teacher") {
      return schedule.filter(item =>
        DEMO_TEACHER_NAMES.includes(
          item.teacher as (typeof DEMO_TEACHER_NAMES)[number]
        )
      );
    }
    // Demo modunda bu rol için tanımlı bir filtre yok; kapı kapalı.
    // Bu `return` ÜRETİM dalı değil — üretimin cevabı aşağıdaki
    // geçirgenliktir. İkisi ayrı olmak zorunda: demo verisi RLS'ten
    // geçmediği için kendi kapısına muhtaç.
    return [];
  }
  // Kapsam sunucuda çözüldü; gelen satırlar zaten bu kullanıcıya ait.
  return schedule;
}
