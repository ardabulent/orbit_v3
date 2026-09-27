-- Öğrencinin Genel Bakış'ı, öğrencinin kendi haftasını sayar.
--
-- =========================================================================
-- Neden gerekti
-- =========================================================================
--
-- Öğrenci Genel Bakış ekranı kartlarını, "Sıradaki adımlar"ı ve "haftalık
-- not"u demo modülünden alıyordu; gerçek modda boştu. Başlığı, kimse bir plan
-- hazırlamamışken "bugün planınız hazır" diyordu (ROADMAP §4.23 B3,
-- `v1.5-22`, **K-03**). Yönetici ve öğretmen tarafı `20261001000000` ve
-- `20261002000000`'da bağlandı; bu göç öğrenci tarafı.
--
-- =========================================================================
-- Neden kurum değil ÖĞRENCİ kimliği
-- =========================================================================
--
-- Yönetici ve öğretmen fonksiyonları kurumu parametre alıyor, çünkü
-- soruları kurumun ya da çağıranın kendisi hakkında. Öğrencinin sorusu **bir
-- öğrenci** hakkında — ve veli aynı soruyu çocuğu için soracak. Kimlik
-- parametre olunca veli ekranı bu fonksiyonları çocuğun kimliğiyle çağırır;
-- mantık iki yerde yazılmaz (**K-06**).
--
-- Yetki yine RLS'ten gelir: öğrenci satırı çağırana görünmüyorsa (başkasının
-- çocuğu, başka kurum) fonksiyon **hiç satır döndürmez**. Öğrencinin kendisi
-- (`students_select_self`), velisi (`students_select_guardian`), öğretmeni ve
-- yöneticisi görür — bugün de öğrenci kartını kim görebiliyorsa o.
--
-- =========================================================================
-- Sayılar ve tanımları
-- =========================================================================
--
-- * **Bugünkü ders:** öğrencinin aktif kaydı olan, arşivlenmemiş sınıfların
--   bugünkü program satırları.
-- * **Bu hafta teslim:** o sınıfların, teslim tarihi bugün ile 6 gün sonrası
--   arasındaki (7 gün) ödevleri. "Yaklaşan ödevler" listesiyle aynı pencere.
-- * **Yakında teslim:** bugün veya yarın. Dikkat satırı.
-- * **Getirilmedi:** öğretmenin işaretlemeyi bitirdiği (`submissions_recorded_at`)
--   ama bu öğrenci için teslim satırı olmayan ödev. Sayım
--   `student_homework_ratios`'tan gelir (recorded − submitted); o fonksiyonun
--   "kayıttan önce verilmiş ödev sayılmaz" kuralı burada yeniden yazılmaz.
-- * **Devam:** `student_attendance_counts`'tan — gelmedi ve geç kaldı.
-- * **Son sınav:** `student_latest_exam_scores`'tan.
--
-- Hazır fonksiyonların üçü de `security definer` ve kendi yetki kapılarını
-- taşıyor; burada çağrılmaları o kapıları gevşetmez, yalnız aynı sayının iki
-- yerde hesaplanmasını önler.
--
-- Yeni iki fonksiyon `security definer` DEĞİL.

create or replace function public.student_overview_counts(target_student_id uuid)
returns table (
  lessons_today bigint,
  homework_due_this_week bigint,
  homework_due_soon bigint,
  homework_missed bigint,
  absent_count bigint,
  late_count bigint,
  latest_exam_name text,
  latest_exam_date date,
  latest_exam_score numeric,
  latest_exam_max_score numeric
)
language sql
stable
set search_path = ''
as $$
  with student as (
    select pupil.id, pupil.organization_id
    from public.students as pupil
    where pupil.id = target_student_id
      and pupil.archived_at is null
  ),
  classes as (
    select enrollment.class_id
    from public.class_enrollments as enrollment
    join student
      on student.id = enrollment.student_id
     and student.organization_id = enrollment.organization_id
    join public.classes as klass
      on klass.id = enrollment.class_id
    where enrollment.archived_at is null
      and klass.archived_at is null
  ),
  homework as (
    select assignment.due_date
    from public.homework_assignments as assignment
    join student
      on student.organization_id = assignment.organization_id
    where assignment.archived_at is null
      and assignment.class_id in (select classes.class_id from classes)
      and assignment.due_date between public.orbit_today()
                                  and public.orbit_today() + 6
  ),
  ratio as (
    select ratios.recorded_count, ratios.submitted_count
    from public.student_homework_ratios(array[target_student_id]) as ratios
  ),
  attendance as (
    select counts.absent_count, counts.late_count
    from public.student_attendance_counts(array[target_student_id]) as counts
  ),
  exam as (
    select scores.exam_name, scores.exam_date, scores.score, scores.max_score
    from public.student_latest_exam_scores(array[target_student_id]) as scores
  )
  select
    (
      select count(*)
      from public.schedule_entries as entry
      join student
        on student.organization_id = entry.organization_id
      where entry.archived_at is null
        and entry.class_id in (select classes.class_id from classes)
        and entry.day_of_week = extract(isodow from public.orbit_today())::smallint
    ) as lessons_today,
    (select count(*) from homework) as homework_due_this_week,
    (
      select count(*)
      from homework
      where homework.due_date <= public.orbit_today() + 1
    ) as homework_due_soon,
    coalesce(
      (select ratio.recorded_count - ratio.submitted_count from ratio), 0
    ) as homework_missed,
    coalesce((select attendance.absent_count from attendance), 0) as absent_count,
    coalesce((select attendance.late_count from attendance), 0) as late_count,
    (select exam.exam_name from exam) as latest_exam_name,
    (select exam.exam_date from exam) as latest_exam_date,
    (select exam.score from exam) as latest_exam_score,
    (select exam.max_score from exam) as latest_exam_max_score
  where exists (select 1 from student);
$$;

comment on function public.student_overview_counts(uuid) is
  'Bir öğrencinin Genel Bakış sayıları: bugünkü ders, 7 gün içinde teslim edilecek ödev, bugün/yarın teslim, getirilmedi olarak işaretlenen ödev, gelmedi/geç kaldı, son sınav. Öğrenci satırı çağırana görünmüyorsa HİÇ SATIR dönmez. Öğrenci ve veli ekranı aynı fonksiyonu kullanır. `security definer` DEĞİLDİR.';

create or replace function public.student_upcoming_homework(target_student_id uuid)
returns table (
  homework_id uuid,
  title text,
  subject_name text,
  class_name text,
  due_date date
)
language sql
stable
set search_path = ''
as $$
  select
    assignment.id as homework_id,
    assignment.title,
    subject.name as subject_name,
    klass.name as class_name,
    assignment.due_date
  from public.students as student
  join public.class_enrollments as enrollment
    on enrollment.student_id = student.id
   and enrollment.organization_id = student.organization_id
   and enrollment.archived_at is null
  join public.classes as klass
    on klass.id = enrollment.class_id
   and klass.archived_at is null
  join public.homework_assignments as assignment
    on assignment.class_id = klass.id
   and assignment.organization_id = student.organization_id
   and assignment.archived_at is null
  left join public.subjects as subject
    on subject.id = assignment.subject_id
  where student.id = target_student_id
    and student.archived_at is null
    and assignment.due_date between public.orbit_today()
                                and public.orbit_today() + 6
  order by assignment.due_date, assignment.title
  limit 5;
$$;

comment on function public.student_upcoming_homework(uuid) is
  'Bir öğrencinin önümüzdeki 7 günde (bugün dahil) teslim edilecek ilk 5 ödevi, teslim tarihine göre. `student_overview_counts.homework_due_this_week` ile aynı pencere. `security definer` DEĞİLDİR.';

-- Bugünkü dersler: satır mantığı `today_lessons`'tan (**K-06**); yalnız bu
-- öğrencinin aktif sınıflarına süzülür. Velinin iki çocuğu farklı sınıflarda
-- olabilir; kurum düzeyindeki liste ikisini karıştırırdı.
create or replace function public.student_lessons_today(target_student_id uuid)
returns table (
  entry_id uuid,
  starts_at time,
  ends_at time,
  class_id uuid,
  class_name text,
  subject_name text,
  title text,
  room text,
  teacher_name text,
  attendance_taken boolean
)
language sql
stable
set search_path = ''
as $$
  select lesson.*
  from public.students as student
  cross join lateral public.today_lessons(student.organization_id) as lesson
  where student.id = target_student_id
    and student.archived_at is null
    and exists (
      select 1
      from public.class_enrollments as enrollment
      where enrollment.student_id = student.id
        and enrollment.class_id = lesson.class_id
        and enrollment.archived_at is null
    )
  order by lesson.starts_at, lesson.class_name;
$$;

comment on function public.student_lessons_today(uuid) is
  'Bir öğrencinin bugünkü dersleri; satırlar `today_lessons`''tan, öğrencinin aktif sınıflarına süzülmüş. `security definer` DEĞİLDİR.';

revoke all on function public.student_overview_counts(uuid) from public, anon;
grant execute on function public.student_overview_counts(uuid) to authenticated;
revoke all on function public.student_upcoming_homework(uuid) from public, anon;
grant execute on function public.student_upcoming_homework(uuid) to authenticated;
revoke all on function public.student_lessons_today(uuid) from public, anon;
grant execute on function public.student_lessons_today(uuid) to authenticated;
