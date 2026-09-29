/**
 * Yalnızca demo sunumu içindir. Bu dosyadaki hiçbir şey gerçek bir kuruma ait
 * değildir ve production'da gösterilmemelidir.
 *
 * Bugün hâlâ production'da da okunuyor; demo moduna hapsedilmesi Faz E5'in
 * sıradaki dilimidir. Buraya yeni veri eklerken bunu aklında tut.
 */
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileText,
  MessageSquare,
  UserRoundCheck,
  Users,
} from "lucide-react";
import type { OrganizationMember } from "@/organization/memberService";
import type {
  AttendanceState,
  ClassGroup,
  DayPlanEvent,
  DayPlanRole,
  DayPlanTask,
  Homework,
  PaymentRow,
  Role,
  ScheduleItem,
  Student,
} from "./types";

/**
 * Demo ortamında rol bazlı kapsam filtreleme için kullanılan örnek veri sabitleri.
 * Gerçek kapsam (öğretmen-sınıf, veli-öğrenci tabloları) v1.2'de veritabanından
 * gelecektir; o zamana kadar bu sabitler yalnızca demo modunda kullanılır (#136).
 */
export const DEMO_TEACHER_NAMES = ["Merve Karaca", "Seda Kılıç"] as const;
export const DEMO_TEACHER_CLASS_GROUPS = ["YKS 12-A", "YKS 11-C"] as const;
/** Demo sınıflarının danışman öğretmeni. Ayrı sabit: dizinin sırasına
 *  bağlanmak, diziyi yeniden sıralayan birinin davranışı sessizce
 *  değiştirmesine yol açardı. */
export const DEMO_CLASS_MENTOR = "Merve Karaca";
export const DEMO_STUDENT_ID = "stu-001";
export const DEMO_STUDENT_NAME = "Zeynep Kaya";
export const DEMO_STUDENT_CLASS_GROUP = "YKS 12-A";

export const students: Student[] = [
  {
    id: "stu-001",
    name: "Zeynep Kaya",
    code: "YKS-24018",
    group: "YKS 12-A",
    branch: "Çorlu Şube",
    parent: "Murat Kaya",
    attendance: 96,
    score: 84,
    homework: "8/9",
    payment: "Güncel",
    risk: "Dengeli",
  },
  {
    id: "stu-002",
    name: "Efe Demir",
    code: "YKS-24027",
    group: "YKS 12-A",
    branch: "Çorlu Şube",
    parent: "Elif Demir",
    attendance: 88,
    score: 71,
    homework: "5/9",
    payment: "Güncel",
    risk: "Takip gerekli",
  },
  {
    id: "stu-003",
    name: "Derin Yıldız",
    code: "YKS-24031",
    group: "YKS 12-B",
    branch: "Çorlu Şube",
    parent: "Selin Yıldız",
    attendance: 94,
    score: 78,
    homework: "7/9",
    payment: "Takip gerekli",
    risk: "Dengeli",
  },
  {
    id: "stu-004",
    name: "Aras Öztürk",
    code: "YKS-24042",
    group: "YKS 12-B",
    branch: "Çorlu Şube",
    parent: "Berna Öztürk",
    attendance: 82,
    score: 63,
    homework: "3/9",
    payment: "Güncel",
    risk: "Takip gerekli",
  },
  {
    id: "stu-005",
    name: "Nisan Akın",
    code: "YKS-24049",
    group: "YKS 11-C",
    branch: "Çorlu Şube",
    parent: "Emre Akın",
    attendance: 98,
    score: 89,
    homework: "9/9",
    payment: "Güncel",
    risk: "Dengeli",
  },
];

export const classes: ClassGroup[] = [
  {
    id: "cls-1",
    name: "YKS 12-A",
    program: "Sayısal hazırlık",
    mentor: "Merve Karaca",
    studentCount: 18,
    attendance: 94,
    nextLesson: "Bugün · 10:00 Matematik",
  },
  {
    id: "cls-2",
    name: "YKS 12-B",
    program: "Eşit ağırlık hazırlık",
    mentor: "Bora Ekin",
    studentCount: 16,
    attendance: 89,
    nextLesson: "Bugün · 11:30 Türkçe",
  },
  {
    id: "cls-3",
    name: "YKS 11-C",
    program: "Temel yeterlilik",
    mentor: "Merve Karaca",
    studentCount: 20,
    attendance: 97,
    nextLesson: "Yarın · 09:00 Fizik",
  },
];

export const schedule: ScheduleItem[] = [
  {
    day: "Pazartesi",
    time: "09:00",
    title: "TYT Matematik",
    group: "YKS 12-A",
    teacher: "Merve Karaca",
    room: "Derslik 204",
    tone: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  {
    day: "Pazartesi",
    time: "10:30",
    title: "Problem Atölyesi",
    group: "YKS 12-B",
    teacher: "Bora Ekin",
    room: "Derslik 105",
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  {
    day: "Salı",
    time: "13:00",
    title: "Rehberlik Görüşmesi",
    group: "Zeynep Kaya",
    teacher: "Merve Karaca",
    room: "Görüşme Odası",
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  {
    day: "Salı",
    time: "14:30",
    title: "TYT Deneme Analizi",
    group: "YKS 11-C",
    teacher: "Seda Kılıç",
    room: "Etüt Salonu",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  {
    day: "Çarşamba",
    time: "09:00",
    title: "Geometri Soru Çözümü",
    group: "YKS 12-A",
    teacher: "Merve Karaca",
    room: "Derslik 204",
    tone: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  {
    day: "Çarşamba",
    time: "11:00",
    title: "Paragraf ve Sözel Mantık",
    group: "YKS 12-B",
    teacher: "Seda Kılıç",
    room: "Derslik 105",
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  {
    day: "Perşembe",
    time: "10:00",
    title: "Fizik Laboratuvarı",
    group: "YKS 12-A",
    teacher: "Bora Ekin",
    room: "Lab 1",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  {
    day: "Perşembe",
    time: "13:30",
    title: "Bireysel Etüt Takibi",
    group: "Zeynep Kaya",
    teacher: "Seda Kılıç",
    room: "Etüt Salonu",
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  {
    day: "Cuma",
    time: "09:30",
    title: "Haftalık Deneme Sınavı",
    group: "YKS 12-A",
    teacher: "Merve Karaca",
    room: "Konferans Salonu",
    tone: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  {
    day: "Cuma",
    time: "14:00",
    title: "Haftalık Değerlendirme",
    group: "YKS 11-C",
    teacher: "Seda Kılıç",
    room: "Derslik 105",
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
];

export const paymentRows: PaymentRow[] = [
  {
    id: "plan-demo-001",
    studentId: "stu-001",
    student: "Zeynep Kaya",
    plan: "YKS Sayısal Paket",
    due: "05 Eylül 2026",
    amount: "₺7.200",
    totalAmount: 72000,
    status: "Güncel",
  },
  {
    id: "plan-demo-002",
    studentId: "stu-003",
    student: "Derin Yıldız",
    plan: "YKS Eşit Ağırlık Paket",
    due: "28 Ağustos 2026",
    amount: "₺6.800",
    totalAmount: 68000,
    status: "Hatırlatma gerekli",
  },
  {
    id: "plan-demo-003",
    studentId: "stu-004",
    student: "Aras Öztürk",
    plan: "YKS Eşit Ağırlık Paket",
    due: "18 Ağustos 2026",
    amount: "₺6.800",
    totalAmount: 68000,
    status: "Gecikme riski",
  },
];

export const initialHomework: Homework[] = [
  {
    id: "hw-1",
    classGroup: "YKS 12-A",
    subject: "Matematik",
    title: "Fonksiyonlarda Uygulama Seti",
    description:
      "Fonksiyon türleri ve grafik yorumlama üzerine 20 soruluk uygulama seti.",
    assignedBy: "Merve Karaca",
    assignedDate: "18 Ağustos 2026",
    dueDate: "22 Ağustos 2026",
    rawDueDate: "2026-08-22",
    status: "Süresi Doldu",
  },
  {
    id: "hw-2",
    classGroup: "YKS 12-A",
    subject: "Geometri",
    title: "Üçgenlerde Alan Problemleri",
    description:
      "Üçgende alan bağıntıları ve benzerlik problemlerinden oluşan tekrar kağıdı.",
    assignedBy: "Merve Karaca",
    assignedDate: "20 Ağustos 2026",
    dueDate: "27 Ağustos 2026",
    rawDueDate: "2026-08-27",
    status: "Aktif",
  },
  {
    id: "hw-3",
    classGroup: "YKS 12-A",
    subject: "Türkçe",
    title: "Paragrafta Anlam Çalışma Kağıdı",
    description:
      "Paragrafta anlatım biçimleri ve yardımcı düşünce sorularından oluşan tekrar seti.",
    assignedBy: "Merve Karaca",
    assignedDate: "12 Ağustos 2026",
    dueDate: "19 Ağustos 2026",
    rawDueDate: "2026-08-19",
    status: "Tamamlandı",
    submissionCount: 20,
    totalStudents: 20,
  },
  {
    id: "hw-4",
    classGroup: "YKS 11-C",
    subject: "Fizik",
    title: "Kuvvet ve Hareket Soru Seti",
    description:
      "Newton'un hareket yasaları ve sürtünme kuvveti üzerine problem seti.",
    assignedBy: "Merve Karaca",
    assignedDate: "19 Ağustos 2026",
    dueDate: "26 Ağustos 2026",
    rawDueDate: "2026-08-26",
    status: "Aktif",
  },
  {
    id: "hw-5",
    classGroup: "YKS 11-C",
    subject: "Kimya",
    title: "Mol Kavramı Tekrar Testi",
    description:
      "Mol hesaplamaları ve kimyasal tepkimelerde stokiyometri üzerine test.",
    assignedBy: "Merve Karaca",
    assignedDate: "14 Ağustos 2026",
    dueDate: "20 Ağustos 2026",
    rawDueDate: "2026-08-20",
    status: "Süresi Doldu",
  },
  {
    id: "hw-6",
    classGroup: "YKS 12-B",
    subject: "Biyoloji",
    title: "Hücre Bölünmesi Kavram Haritası",
    description:
      "Mitoz ve mayoz bölünme aşamalarını karşılaştıran kavram haritası ödevi.",
    assignedBy: "Bora Ekin",
    assignedDate: "17 Ağustos 2026",
    dueDate: "24 Ağustos 2026",
    rawDueDate: "2026-08-24",
    status: "Aktif",
  },
  {
    id: "hw-7",
    classGroup: "YKS 12-B",
    subject: "Matematik",
    title: "Türev Uygulamaları Deneme Seti",
    description:
      "Türev kuralları ve maksimum-minimum problemlerinden oluşan deneme seti.",
    assignedBy: "Bora Ekin",
    assignedDate: "10 Ağustos 2026",
    dueDate: "17 Ağustos 2026",
    rawDueDate: "2026-08-17",
    status: "Süresi Doldu",
  },
];

export const initialAttendances: Record<string, AttendanceState> = {
  "stu-001": "Katıldı",
  "stu-002": "Katıldı",
  "stu-003": "Geç kaldı",
  "stu-004": "Gelmedi",
  "stu-005": "Katıldı",
};

export const dayPlanTasksByRole: Record<DayPlanRole, DayPlanTask[]> = {
  admin: [
    {
      id: "dpt-a1",
      title: "Ağustos devam ve performans raporu",
      detail: "Şube geneli devam ve akademik özet raporunu hazırla.",
      status: "Planla",
      priority: "Orta",
      category: "Rapor",
      duration: "40 dk",
      dueLabel: "Yarın 09:00",
    },
    {
      id: "dpt-a2",
      title: "Yeni dönem sınıf kontenjanları",
      detail: "YKS 11 ve 12 gruplarında boş kontenjanları güncelle.",
      status: "Planla",
      priority: "Düşük",
      category: "Kayıt",
      duration: "20 dk",
      dueLabel: "25 Ağustos",
    },
    {
      id: "dpt-a3",
      title: "Çorlu şube haftalık değerlendirme toplantısı",
      detail: "Öğretmen kadrosuyla haftalık başarı ve devam özetini paylaş.",
      status: "Bugün",
      priority: "Yüksek",
      category: "Rapor",
      duration: "45 dk",
      dueLabel: "Bugün 15:00",
    },
    {
      id: "dpt-a4",
      title: "Veli şikayeti — Aras Öztürk",
      detail: "Devam durumu hakkında veliyi arayıp bilgilendir.",
      status: "Bugün",
      priority: "Yüksek",
      category: "Veli İletişimi",
      duration: "15 dk",
      dueLabel: "Bugün 11:30",
    },
    {
      id: "dpt-a5",
      title: "Ağustos deneme sınavı sonuç analizi",
      detail: "TYT deneme sonuçlarını şube bazında karşılaştır.",
      status: "Odaklan",
      priority: "Yüksek",
      category: "Sınav",
      duration: "60 dk",
      dueLabel: "Bugün 13:00",
    },
  ],
  teacher: [
    {
      id: "dpt-t1",
      title: "TYT Matematik konu tekrar planı",
      detail: "Geometri ağırlıklı haftalık tekrar planını hazırla.",
      status: "Planla",
      priority: "Orta",
      category: "Ders Programı",
      duration: "35 dk",
      dueLabel: "26 Ağustos",
    },
    {
      id: "dpt-t2",
      title: "YKS 12-A deneme sınavı soru hazırlığı",
      detail: "Hafta sonu denemesi için 20 soruluk ek paket hazırla.",
      status: "Planla",
      priority: "Orta",
      category: "Sınav",
      duration: "50 dk",
      dueLabel: "27 Ağustos",
    },
    {
      id: "dpt-t3",
      title: "YKS 12-A yoklama girişi",
      detail: "Sabah dersinin yoklamasını sisteme işle.",
      status: "Bugün",
      priority: "Yüksek",
      category: "Yoklama",
      duration: "10 dk",
      dueLabel: "Bugün 09:00",
    },
    {
      id: "dpt-t4",
      title: "Efe Demir velisiyle görüşme",
      detail: "Devam durumu ve ödev takibi hakkında bilgi ver.",
      status: "Bugün",
      priority: "Orta",
      category: "Veli İletişimi",
      duration: "20 dk",
      dueLabel: "Bugün 16:00",
    },
    {
      id: "dpt-t5",
      title: "TYT deneme analiz raporu — YKS 11-C",
      detail: "Son deneme sonucunu ders bazlı net grafiğiyle özetle.",
      status: "Odaklan",
      priority: "Yüksek",
      category: "Rapor",
      duration: "45 dk",
      dueLabel: "Bugün 14:30",
    },
    {
      id: "dpt-t6",
      title: "Problem atölyesi ders notu paylaşımı",
      detail: "Bugünkü atölye notlarını sınıf grubuna gönder.",
      status: "Tamamlandı",
      priority: "Düşük",
      category: "Ders Programı",
      duration: "15 dk",
      dueLabel: "Dün tamamlandı",
    },
  ],
};

export const dayPlanEventsByRole: Record<DayPlanRole, DayPlanEvent[]> = {
  admin: [
    {
      id: "dpe-a1",
      date: "2026-08-21",
      startTime: "10:00",
      endTime: "10:30",
      mode: "Google Meet",
      type: "Veli Görüşmesi",
      title: "Kaya ailesi ile görüşme",
      subtitle: "Zeynep Kaya velisi",
    },
    {
      id: "dpe-a2",
      date: "2026-08-21",
      startTime: "13:00",
      endTime: "13:45",
      mode: "Yüz yüze",
      type: "Şube Toplantısı",
      title: "Çorlu şube haftalık toplantı",
      subtitle: "Yönetim ekibi",
    },
    {
      id: "dpe-a3",
      date: "2026-08-24",
      startTime: "11:00",
      endTime: "11:30",
      mode: "Google Meet",
      type: "Öğretmen Değerlendirmesi",
      title: "Bora Ekin performans görüşmesi",
      subtitle: "Dönem ortası değerlendirme",
    },
    {
      id: "dpe-a4",
      date: "2026-08-27",
      startTime: "09:30",
      endTime: "10:00",
      mode: "Telefon",
      type: "Aday Kayıt Görüşmesi",
      title: "Yeni aday velisi görüşmesi",
      subtitle: "YKS 11. sınıf kaydı",
    },
  ],
  teacher: [
    {
      id: "dpe-t1",
      date: "2026-08-21",
      startTime: "13:00",
      endTime: "13:30",
      mode: "Yüz yüze",
      type: "Rehberlik Görüşmesi",
      title: "Zeynep Kaya ile rehberlik görüşmesi",
      subtitle: "Görüşme Odası",
    },
    {
      id: "dpe-t2",
      date: "2026-08-21",
      startTime: "16:00",
      endTime: "16:20",
      mode: "Google Meet",
      type: "Veli Görüşmesi",
      title: "Efe Demir velisiyle görüşme",
      subtitle: "Devam durumu değerlendirmesi",
    },
    {
      id: "dpe-t3",
      date: "2026-08-25",
      startTime: "10:00",
      endTime: "10:30",
      mode: "Yüz yüze",
      type: "Şube Toplantısı",
      title: "Öğretmenler kurulu toplantısı",
      subtitle: "Çorlu şube",
    },
    {
      id: "dpe-t4",
      date: "2026-08-28",
      startTime: "09:00",
      endTime: "09:20",
      mode: "Google Meet",
      type: "Öğretmen Değerlendirmesi",
      title: "Dönem ortası öz değerlendirme",
      subtitle: "Akademik koordinatör ile",
    },
  ],
};

export const roleEmail: Record<Role, string> = {
  admin: "yonetici@orbit.edu.tr",
  teacher: "ogretmen@orbit.edu.tr",
  student: "ogrenci@orbit.edu.tr",
  parent: "veli@orbit.edu.tr",
};

export const organizationMembers: OrganizationMember[] = [
  {
    membershipId: "demo-mem-1",
    displayName: "Ayşe Yalçın",
    loginNumber: "10011001",
    role: "admin",
    branchName: "Çorlu Şube",
    status: "active",
  },
  {
    membershipId: "demo-mem-2",
    displayName: "Merve Karaca",
    loginNumber: "10011002",
    role: "teacher",
    branchName: "Çorlu Şube",
    status: "active",
  },
  {
    membershipId: "demo-mem-3",
    displayName: "Caner Aydın",
    loginNumber: "10011003",
    role: "teacher",
    branchName: null,
    status: "active",
  },
  {
    membershipId: "demo-mem-4",
    displayName: "Zeynep Kaya",
    loginNumber: "10011004",
    role: "student",
    branchName: "Çorlu Şube",
    status: "active",
    linkedPerson: {
      type: "student",
      id: "demo-student-1",
      name: "Zeynep Kaya",
    },
  },
  {
    membershipId: "demo-mem-5",
    displayName: "Efe Demir",
    loginNumber: null,
    role: "student",
    branchName: "Çorlu Şube",
    status: "invited",
    linkedPerson: null,
  },
  {
    membershipId: "demo-mem-6",
    displayName: "Murat Kaya",
    loginNumber: "10011006",
    role: "parent",
    branchName: "Çorlu Şube",
    status: "active",
    linkedPerson: {
      type: "guardian",
      id: "demo-guardian-1",
      name: "Murat Kaya",
    },
  },
  {
    membershipId: "demo-mem-7",
    displayName: "Burak Şen",
    loginNumber: "10011007",
    role: "teacher",
    branchName: "Çorlu Şube",
    status: "suspended",
  },
];

export type OverviewStat = {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone?: "blue" | "green" | "amber" | "violet" | "rose";
};

export type OverviewStatTemplate = {
  key: string;
  label: string;
  icon: typeof Users;
  tone?: "blue" | "green" | "amber" | "violet" | "rose";
  emptyValue: string;
  emptyDetail: string;
};

export type OverviewStatValue = {
  value: string;
  detail?: string;
};

export type AdminOverviewHeader = {
  subtitle: string;
};

export type AdminFollowUpNote = {
  title: string;
  message: string;
  actionLabel: string;
};

export type TeacherFollowUpItem = {
  id: string;
  student: string;
  note: string;
};

export type StudentActionStep = {
  title: string;
  detail: string;
  icon: typeof BookOpen;
  tone: "blue" | "amber" | "violet" | "green" | "rose";
};

export type StudentWeeklyNote = {
  tag: string;
  title: string;
  description: string;
};

export type ParentProgressSummary = {
  examTitle: string;
  examDate: string;
  examComparison: string;
  scoreBadge: string;
  note: string;
};

export type ParentCommunicationItem = {
  title: string;
  detail: string;
  icon: typeof MessageSquare;
  tone: "blue" | "amber" | "violet" | "green" | "rose";
};

export type AttendanceLessonInfo = {
  pageDescription: string;
  groupTitle: string;
  groupDetail: string;
};

export type AssessmentHeaderInfo = {
  title: string;
  date: string;
  participantSummary: string;
  studentName: string;
  statusBadge: string;
};

export type AssessmentSubject = {
  label: string;
  value: number;
  color: string;
};

export type AssessmentFollowUp = {
  personalNote: string;
  institutionNote: string;
};

export type ReportActionItem = {
  title: string;
  detail: string;
  icon: typeof BookOpen;
  tone: "blue" | "amber" | "violet" | "green" | "rose";
};

export type CommunicationItem = {
  id: string;
  name: string;
  detail: string;
  time: string;
  selected?: boolean;
};

export type ConversationMessage = {
  id: string;
  sender: "self" | "other";
  text: string;
};

export type ActiveConversation = {
  audienceByRole: Record<Role, string>;
  contextTitle: string;
  messages: ConversationMessage[];
};

export const adminOverviewHeader: AdminOverviewHeader = {
  subtitle:
    "Çorlu Şube’de aday kayıtları, dersler, yoklamalar ve veli takipleri tek çalışma alanında güncel.",
};

export const demoAdminOverviewStatValues: Record<string, OverviewStatValue> = {
  "active-students": { value: "54", detail: "3 sınıfta kayıtlı" },
  "today-attendance": { value: "%93", detail: "4 yoklama tamamlandı" },
  "follow-up": { value: "4", detail: "Akademik veya devam sinyali" },
  "upcoming-payment": { value: "₺86.400", detail: "7 taksit bu hafta vade" },
};

export const adminFollowUpNote: AdminFollowUpNote = {
  title: "İnsan takibi gerekenler",
  message:
    "Efe Demir’in son iki deneme sonucunda gerileme ve Aras Öztürk’te devamsızlık sinyali var.",
  actionLabel: "Öğrencileri incele",
};

export const demoTeacherOverviewStatValues: Record<string, OverviewStatValue> =
  {
    "today-lessons": { value: "3", detail: "İlk ders 09:00" },
    "class-average": { value: "76", detail: "Son TYT denemesi" },
    "pending-homework": { value: "6", detail: "Problem seti · bugün" },
    "follow-up-recommendation": { value: "2", detail: "Rehberlik görüşmesi" },
  };

export const teacherFollowUpItems: TeacherFollowUpItem[] = [
  {
    id: "tfu-1",
    student: "Efe Demir",
    note: "Matematik netlerinde iki denemedir düşüş var.",
  },
  {
    id: "tfu-2",
    student: "Aras Öztürk",
    note: "Bu hafta bir devamsızlık kaydı oluştu.",
  },
];

export const demoStudentOverviewStatValues: Record<string, OverviewStatValue> =
  {
    "today-lessons": { value: "2", detail: "İlk ders 09:00" },
    "completed-homework": { value: "8/9", detail: "Bu hafta" },
    "last-exam": { value: "84", detail: "+6 puan gelişim" },
    attendance: { value: "%96", detail: "Bu dönem" },
  };

export const studentActionSteps: StudentActionStep[] = [
  {
    title: "TYT Matematik",
    detail: "09:00 · Derslik 204",
    icon: BookOpen,
    tone: "blue",
  },
  {
    title: "Problem Seti 04",
    detail: "Teslim için 1 gün kaldı",
    icon: ClipboardCheck,
    tone: "amber",
  },
  {
    title: "Deneme sonucu",
    detail: "Sözel mantıkta gelişim notunu incele",
    icon: BarChart3,
    tone: "violet",
  },
];

export const studentWeeklyNote: StudentWeeklyNote = {
  tag: "Bu hafta",
  title: "Hedefine sakin ve düzenli ilerliyorsun.",
  description:
    "Son denemede problem çözme alanında 6 puan gelişim var. Bir sonraki odak alanın geometri.",
};

export const demoParentOverviewStatValues: Record<string, OverviewStatValue> = {
  attendance: { value: "%96", detail: "Bu dönem" },
  "last-exam": { value: "84", detail: "+6 puan gelişim" },
  "upcoming-lesson": { value: "09:00", detail: "TYT Matematik" },
  "payment-plan": { value: "Güncel", detail: "Sonraki taksit 5 Eylül" },
};

export const parentProgressSummary: ParentProgressSummary = {
  examTitle: "TYT Deneme 06",
  examDate: "14 Ağustos 2026",
  examComparison: "Sınıf ortalamasının üzerinde",
  scoreBadge: "84 puan",
  note: "Zeynep’in problem çözme performansında düzenli gelişim görülüyor. Geometri alanında öğretmen tarafından ek çalışma önerildi.",
};

export const parentCommunicationItems: ParentCommunicationItem[] = [
  {
    title: "Veli görüşmesi",
    detail: "20 Ağustos · 15:30 önerildi",
    icon: MessageSquare,
    tone: "violet",
  },
  {
    title: "Deneme analiz dosyası",
    detail: "İncelemeye hazır",
    icon: FileText,
    tone: "blue",
  },
];

export const attendanceLessonInfo: AttendanceLessonInfo = {
  pageDescription: "TYT Matematik · YKS 12-A · 15 Ağustos, 09:00",
  groupTitle: "YKS 12-A · TYT Matematik",
  groupDetail: "18 kayıtlı öğrenci · yoklama durumunu ders bitmeden doğrulayın",
};

export const demoPaymentOverviewStatValues: Record<string, OverviewStatValue> =
  {
    "monthly-collection": {
      value: "₺248.600",
      detail: "Planlanan tahsilatın %82’si",
    },
    "upcoming-installments": { value: "7", detail: "Önümüzdeki 7 gün" },
    "follow-up-payments": {
      value: "2",
      detail: "İletişim önerisi oluşturuldu",
    },
  };

export const demoAssessmentHeaderInfo: AssessmentHeaderInfo = {
  title: "TYT Deneme 06",
  date: "14 Ağustos 2026",
  participantSummary: "54 öğrenci",
  studentName: "Zeynep Kaya",
  statusBadge: "Yayınlandı",
};

export const demoAssessmentSubjects: AssessmentSubject[] = [
  { label: "Matematik", value: 82, color: "bg-blue-500" },
  { label: "Türkçe", value: 88, color: "bg-emerald-500" },
  { label: "Fen", value: 71, color: "bg-violet-500" },
  { label: "Geometri", value: 62, color: "bg-amber-400" },
];

export const demoAssessmentFollowUp: AssessmentFollowUp = {
  personalNote:
    "Geometri konularında kısa tekrar ve soru çözüm etüdü öneriliyor.",
  institutionNote:
    "YKS 12-B sınıfında geometri ortalaması kurum eşiğinin altında. Rehberlik ve etüt planı oluşturabilirsiniz.",
};

export const demoReportAttendanceValues = [92, 94, 90, 93];
export const demoReportExamValues = [68, 71, 69, 72];
export const demoReportExamLabels = ["D-03", "D-04", "D-05", "D-06"];
export const demoReportHomeworkValues = [78, 82, 86, 84];
export const demoReportHomeworkLabels = ["May", "Haz", "Tem", "Ağu"];

export const demoReportActions: ReportActionItem[] = [
  {
    title: "YKS 12-B",
    detail: "Geometri etüdü önerildi",
    icon: BookOpen,
    tone: "amber",
  },
  {
    title: "Devam sinyali",
    detail: "2 öğrenci için veli bildirimi",
    icon: ClipboardCheck,
    tone: "rose",
  },
  {
    title: "Kayıt dönüşümü",
    detail: "4 aday için takip görevi",
    icon: UserRoundCheck,
    tone: "blue",
  },
];

export const demoCommunicationsList: CommunicationItem[] = [
  {
    id: "comm-1",
    name: "Merve Karaca",
    detail: "Deneme analiz dosyası paylaşıldı",
    time: "10:24",
    selected: true,
  },
  {
    id: "comm-2",
    name: "Çorlu Şube",
    detail: "20 Ağustos veli görüşmesi",
    time: "Dün",
  },
];

export const demoActiveConversation: ActiveConversation = {
  audienceByRole: {
    teacher: "YKS 12-A velileri",
    parent: "Merve Karaca",
    student: "Merve Karaca",
    admin: "Çorlu Şube velileri",
  },
  contextTitle: "Bağlam: Zeynep Kaya · TYT Deneme 06",
  messages: [
    {
      id: "msg-1",
      sender: "other",
      text: "Merhaba, Zeynep’in son deneme sonucunu ve gelecek haftaki çalışma önerisini paylaştım.",
    },
    {
      id: "msg-2",
      sender: "self",
      text: "Teşekkür ederim. Geometri çalışması için ek kaynak önerir misiniz?",
    },
  ],
};
