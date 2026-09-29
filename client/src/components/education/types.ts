import type {
  EducationRole,
  EducationSection,
} from "@/components/educationAccess";

export type Role = EducationRole;
export type Section = EducationSection;
export type AttendanceState = "Katıldı" | "Geç kaldı" | "Gelmedi" | "İzinli";

export type Student = {
  id: string;
  name: string;
  code?: string;
  group: string | null;
  branch: string | null;
  branchId?: string | null;
  parent: string | null;
  attendance?: number;
  score?: number;
  latestExamId?: string;
  latestExamName?: string;
  latestExamDate?: string;
  latestExamMaxScore?: number | null;
  homework?: string;
  payment?: "Güncel" | "Takip gerekli";
  risk?: "Dengeli" | "Takip gerekli";
  hasAccount?: boolean;
};

export type ClassGroup = {
  id: string;
  name: string;
  program: string | null;
  mentor: string | null;
  mentorMembershipId?: string | null;
  branch?: string | null;
  branchId?: string | null;
  capacity?: number | null;
  studentCount: number;
  attendance?: number;
  nextLesson?: string;
};

export type ClassEnrollmentItem = {
  id: string;
  classId: string;
  studentId: string;
  /** Ad okunamıyorsa `null` — servis yokluk etiketi üretmez, kararı ekran verir. */
  studentName: string | null;
  studentNumber?: string | null;
  enrolledAt?: string | null;
  archivedAt?: string | null;
};

import type { WeekDay } from "@/education/weekDays";
export type { WeekDay };

export type ScheduleItem = {
  id?: string;
  day: WeekDay;
  time: string;
  title: string;
  group?: string | null;
  teacher?: string | null;
  room?: string | null;
  duration?: string | null;
  tone?: string;
  classId?: string;
  subjectId?: string | null;
  membershipId?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  dayOfWeek?: number;
};

export type PaymentRow = {
  id: string;
  studentId: string;
  student: string;
  plan: string;
  due: string;
  amount: string;
  totalAmount: number;
  status?: "Güncel" | "Hatırlatma gerekli" | "Gecikme riski" | "Takip gerekli";
  /**
   * `payment_plan_summaries`'tan (2026-09-29, `20261010000000`). Özet
   * alınamadıysa yoktur — sıfır uydurulmaz (K-03).
   */
  overdueCount?: number;
  /** "YYYY-MM-DD" — süzgeç için ham tarih; `due` ekrana yazılan. */
  nextDueDate?: string | null;
  installmentCount?: number;
  paidCount?: number;
  scheduledAmount?: number;
  paidAmount?: number;
};

export type DayPlanRole = Extract<Role, "admin" | "teacher">;

export type DayPlanTaskStatus = "Planla" | "Bugün" | "Odaklan" | "Tamamlandı";

export type DayPlanTaskPriority = "Düşük" | "Orta" | "Yüksek";

export type DayPlanTaskCategory =
  "Yoklama" | "Veli İletişimi" | "Sınav" | "Rapor" | "Kayıt" | "Ders Programı";

export type DayPlanTask = {
  id: string;
  title: string;
  detail: string;
  status: DayPlanTaskStatus;
  priority: DayPlanTaskPriority;
  category: DayPlanTaskCategory;
  duration: string;
  dueLabel: string;
};

export type DayPlanAppointmentMode = "Google Meet" | "Yüz yüze" | "Telefon";

export type DayPlanAppointmentType =
  | "Veli Görüşmesi"
  | "Öğretmen Değerlendirmesi"
  | "Şube Toplantısı"
  | "Rehberlik Görüşmesi"
  | "Aday Kayıt Görüşmesi";

export type DayPlanEvent = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: DayPlanAppointmentMode;
  type: DayPlanAppointmentType;
  title: string;
  subtitle: string;
};

export type HomeworkStatus = "Aktif" | "Süresi Doldu" | "Tamamlandı";

export type Homework = {
  id: string;
  classGroup: string;
  classId?: string;
  subject: string | null;
  subjectId?: string | null;
  title: string;
  description: string;
  assignedBy?: string | null;
  assignedDate: string;
  dueDate: string;
  /**
   * Vade tarihi ISO biçiminde (YYYY-MM-DD) — `dueDate` ise ekrana yazılan
   * Türkçe biçimdir. İkisi birden tutuluyor çünkü düzenleme formu ISO
   * istiyor ve **Türkçe metinden geri çözmek bir tarih mantığının ikinci
   * kopyasıdır**: ay adı eşleşmezse sessizce boş tarih üretir.
   */
  rawDueDate: string;
  status: HomeworkStatus;
  submissionCount?: number;
  totalStudents?: number;
  submissionsRecordedAt?: string | null;
};
