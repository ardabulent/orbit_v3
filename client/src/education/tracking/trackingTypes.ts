/**
 * Takip sekmesinin veri tipleri (2026-11-24).
 *
 * Satır `tracking_student_metrics`'in döndürdüğü HAM sayılardır; bant ve sıra
 * bunlardan istemcide hesaplanır (`trackingBands.ts`). Tipler servisten ayrı
 * durur ki saf hesap dosyaları Supabase istemcisine bağlanmasın.
 */

export type TrackingSubjectNet = {
  subjectId: string;
  subjectName: string;
  avgNet: number;
  /** Öğrencinin sınıflarının ders ortalaması; üçten az öğrencide yok. */
  classAvg?: number;
  examCount: number;
};

/** Hedef net (4.10b): `subjectId` yoksa toplam hedef. */
export type TrackingTarget = {
  subjectId?: string;
  targetNet: number;
};

export type TrackingStudentRow = {
  studentId: string;
  studentName: string;
  classNames: string;
  /** İzinli hariç: geldi + geç + gelmedi. */
  lessonCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  /** En son dersten geriye kesintisiz "gelmedi" sayısı (izinli zinciri kırmaz). */
  absenceStreak: number;
  examExpected: number;
  examMissed: number;
  lastNet?: number;
  previousNet?: number;
  netAvg3?: number;
  classAvgLast?: number;
  subjectNets: TrackingSubjectNet[];
  homeworkExpected: number;
  homeworkSubmitted: number;
  targets: TrackingTarget[];
};
