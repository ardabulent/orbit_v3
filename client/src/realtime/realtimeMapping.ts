import { educationKeys } from "@/education/educationQueries";
import { settingsKeys } from "@/settings/settingsQueries";

/**
 * Realtime bildirimlerini tetikleyen iş tabloları (v1.3-17, v1.4-09 · #284).
 *
 * `audit_events` (geçmişe dönük/sayfalı) ve `organization_memberships` (kimlik akışı)
 * bilinçli olarak bu kapsamın dışındadır.
 */
export type EducationTable =
  | "students"
  | "classes"
  | "class_enrollments"
  | "schedule_entries"
  | "attendance_sessions"
  | "attendance_records"
  | "exams"
  | "exam_results"
  | "payment_plans"
  | "installments"
  | "homework_assignments"
  | "homework_submissions"
  | "guardians"
  | "student_guardians"
  | "branches"
  | "subjects"
  | "class_teachers"
  | "daily_feed_posts"
  | "exam_absences"
  | "exam_sections"
  | "exam_section_results"
  | "substitute_assignments"
  | "schedule_templates"
  | "schedule_template_slots";

/**
 * Toplu tetikleyici veya içe aktarma sırasındaki mesajları birleştirme süresi (ms).
 *
 * 300 ms seçilme gerekçesi:
 * 1. İnsan algı eşiği: 100-300 ms aralığındaki güncellemeler kullanıcıya anlık (instant) görünür.
 * 2. Veritabanı toplu işlemleri: Tek bir PostgreSQL transaction'ında çoklu satır ekleme/güncelleme
 *    (sınıf kaydı, sınav puanları, taksitler) tetikleyicileri milisaniyeler içinde peş peşe üretir.
 *    300 ms'lik pencere bu dalgaları tek bir sorgu tazelemesine sıkıştırır.
 * 3. React Query tekilleştirmesi ve ağ yükü: Ekranın peş peşe gereksiz GET istekleriyle
 *    boğulmasını (query storming) önler.
 */
export const REALTIME_BATCH_DEBOUNCE_MS = 300;

export type RealtimeChangePayload = {
  table: string;
  op?: "INSERT" | "UPDATE" | "DELETE" | string;
};

/**
 * Tablo adından etkilenecek React Query sorgu anahtarlarını çözer (K-06: Tek doğruluk kaynağı).
 *
 * Veritabanı tetikleyicisi (`broadcast_organization_change`) satır düzeyinde RLS'ten
 * geçmediği için veri taşımayan boş bir dürtme yayınlar: `{ table: "...", op: "..." }`.
 *
 * Burada her tablonun hangi sorguları etkilediği açık ve merkezi olarak eşlenir.
 * Eşleme İKİ yoldan çıkarılır ve ikisi de gerekli:
 *
 * 1. **Türetilmiş alanlar** — `Student.attendance`, `Student.score`,
 *    `Student.payment`, `ClassGroup.studentCount`. Bunlar `studentService`'in
 *    çağırdığı toplu yardımcılardan geliyor.
 * 2. **Gömülü okumalar** — bir servisin `select` dizgesine gömdüğü ilişkili
 *    tablolar. Bunlar kolayca gözden kaçıyor: örneğin öğrenci adı yalnız
 *    öğrenci listesinde değil, `attendanceService` ve `paymentService`'in
 *    `select`'lerinde de okunuyor; sınıf adı da `scheduleService`'te.
 *
 * İkincisi atlanırsa sonuç sessiz bir bayatlıktır: yönetici bir öğrencinin
 * adını düzeltir, öğrenci listesi tazelenir, ama ödeme ekranı eski adı
 * göstermeye devam eder.
 *
 * ⛔ Toptan tazeleme (`educationKeys.all`) yapılmaz; yalnızca ilgili sorgu anahtarları döner.
 */
export function getAffectedQueryKeys(
  table: string,
  organizationId: string
): readonly (readonly unknown[])[] {
  if (!organizationId) {
    return [];
  }

  switch (table) {
    case "students":
      // Öğrenci listesi; ayrıca öğrenci ADI `attendanceService` ve
      // `paymentService`'in `select`'lerine gömülü okunuyor
      // (`students ( full_name )`), yani ad değişince o iki ekran da bayatlar.
      return [
        educationKeys.students(organizationId),
        educationKeys.attendance(organizationId),
        educationKeys.payments(organizationId),
      ];

    case "classes":
      // Sınıf listesi, öğrencinin sınıf adını gösteren öğrenci listesi, ve
      // ders programı — `scheduleService` sınıf adını gömülü okuyor
      // (`classes ( id, name, archived_at )`).
      return [
        educationKeys.classes(organizationId),
        educationKeys.students(organizationId),
        educationKeys.schedule(organizationId),
      ];

    case "class_enrollments":
      // Sınıfın aktif öğrenci sayısı (studentCount) ve öğrencinin kayıtlı sınıfı (group)
      return [
        educationKeys.classes(organizationId),
        educationKeys.students(organizationId),
      ];

    case "schedule_entries":
      // Ders programı tablosu
      return [educationKeys.schedule(organizationId)];

    case "attendance_sessions":
      // En son yoklama oturumu ve öğrencinin devam yüzdesi (Student.attendance)
      return [
        educationKeys.attendance(organizationId),
        educationKeys.students(organizationId),
      ];

    case "attendance_records":
      // Yoklama oturumu detay kayıtları ve öğrencinin devam yüzdesi (Student.attendance)
      return [
        educationKeys.attendance(organizationId),
        educationKeys.students(organizationId),
      ];

    case "exams":
      // En son sınav oturumu, öğrencinin son sınav puanı (Student.score) ve
      // açık sınav detayı (examSheet, 2026-10-12)
      return [
        educationKeys.exam(organizationId),
        educationKeys.students(organizationId),
        ["education", "examSheet"] as const,
      ];

    case "exam_results":
      // Sınav katılımcı sayısı, öğrencinin son sınav puanı (Student.score) ve
      // açık sınav detayındaki puanlar (examSheet, 2026-10-12)
      return [
        educationKeys.exam(organizationId),
        educationKeys.students(organizationId),
        ["education", "examSheet"] as const,
      ];

    case "payment_plans":
      // Ödeme planları listesi, özet kartları ve öğrencinin ödeme durumu (Student.payment)
      return [
        educationKeys.payments(organizationId),
        educationKeys.paymentOverview(organizationId),
        educationKeys.students(organizationId),
      ];

    case "installments":
      // Vadesi geçmiş taksitler, özet istatistikleri, taksit listesi ve öğrencinin ödeme durumu (Student.payment)
      return [
        educationKeys.payments(organizationId),
        educationKeys.planInstallments(organizationId),
        educationKeys.paymentOverview(organizationId),
        educationKeys.students(organizationId),
      ];

    case "homework_assignments":
      // Ödev listesi ve öğrenci listesi (submissions_recorded_at değiştiğinde Student.homework oranı değişir)
      return [
        educationKeys.homework(organizationId),
        educationKeys.students(organizationId),
      ];

    case "homework_submissions":
      // Ödev teslimi işaretlendiğinde veya kaldırıldığında ödev listesi (Tamamlandı / teslim sayıları)
      // ve öğrenci listesi (Student.homework oranı) etkilenir (v1.4-15 · #294)
      return [
        educationKeys.homework(organizationId),
        educationKeys.students(organizationId),
      ];

    case "guardians":
      // Veli listesi ve öğrenci listesi — öğrenci listesi veli adını gömülü okuyor
      // (`student_guardians ( archived_at, guardians ( full_name, archived_at ) )`),
      // yani veli adı değişince veya veli arşivlenince öğrenci listesi de bayatlar.
      return [
        educationKeys.guardians(organizationId),
        educationKeys.students(organizationId),
      ];

    case "student_guardians":
      // Veli listesi (öğrenci sayısı), öğrenci listesi (veli adı), ve öğrenci–veli bağları
      return [
        educationKeys.guardians(organizationId),
        educationKeys.students(organizationId),
        educationKeys.studentGuardians(organizationId),
      ];

    case "branches":
      // Şube listesi ve şube adını gösteren üye listesi (v1.4-09 · #284)
      return [
        settingsKeys.branches(organizationId),
        settingsKeys.members(organizationId),
      ];

    case "subjects":
      // Ders adı değişince veya ders eklenip/arşivlenince ders listesi,
      // program, ödev ve sınav sorguları etkilenir (#287)
      return [
        educationKeys.subjects(organizationId),
        educationKeys.schedule(organizationId),
        educationKeys.homework(organizationId),
        educationKeys.exam(organizationId),
        educationKeys.exams(organizationId),
      ];

    case "class_teachers":
      // Sınıfın öğretmen ataması değişince atama listesi, sınıf kartı ve program etkilenir (#287)
      return [
        educationKeys.classTeachers(organizationId),
        educationKeys.classes(organizationId),
        educationKeys.schedule(organizationId),
      ];

    case "daily_feed_posts":
      // Günlük akış duyurusu eklenince, güncellenince veya arşivlenince pano sorgusu etkilenir (#288)
      return [educationKeys.feed(organizationId)];

    // 2026-10-11: göç 20261026000000 bu altı tabloya yayın tetikleyicisi ekledi.
    case "exam_absences":
    case "exam_sections":
    case "exam_section_results":
      // Sınav listesindeki sonuç durumu ("Sonuç gir · 2/4"), ortalama,
      // öğrencinin son sınav puanı ve açık sınav detayı (2026-10-12'ye kadar
      // detay kendi verisini yalnız açılışta okuyordu).
      return [
        educationKeys.exam(organizationId),
        ["education", "examList"] as const,
        educationKeys.students(organizationId),
        ["education", "examSheet"] as const,
      ];

    case "substitute_assignments":
      // Vekil listesi ve vekilin bugünkü dersleri / Genel Bakış sayıları
      return [
        educationKeys.substitutes(organizationId),
        educationKeys.todayLessons(organizationId),
        educationKeys.myLessonsToday(organizationId),
        educationKeys.teacherOverview(organizationId),
        educationKeys.classes(organizationId),
      ];

    case "schedule_templates":
    case "schedule_template_slots":
      return [educationKeys.scheduleTemplates(organizationId)];

    default:
      // Bilinmeyen veya dinlenmeyen tablolar sessizce yoksayılır
      return [];
  }
}
