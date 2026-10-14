-- Yıllık toplamlar sorgu başına yetkilendirilir; ders listesi derslik adını
-- derslik kaydından okur (2026-10-14, ROADMAP v1.5-27 ve v1.5-15'in kalanı).
--
-- 1. `student_attendance_counts` ve `student_homework_ratios` öğrenci
--    listesiyle birlikte her personel girişinde çağrılıyor. Ölçüldü (yerel,
--    400 öğrenci, 93.600 yoklama): yetkisiz ham toplam 19 ms, fonksiyon 72 ms
--    ve 60 ms. Fark veri değil, satır başına yetki çağrısı — her (öğrenci,
--    sınıf) çifti ve her sınıf kaydı için 4–6 ayrı `current_user_*` sorgusu.
--    Göç 20261027000000'daki çözüm burada da geçerli: yetki dizileri sorgu
--    başında BİR KEZ hesaplanır, satırlar `= any(dizi)` ile süzülür. Kural
--    aynı; eşdeğerlik yerelde altı rolle, eski ve yeni fonksiyonun bütün
--    çıktısı karşılaştırılarak ölçüldü (PR açıklaması).
--
--    Dizi karşılıkları:
--      current_user_has_membership(org, null, admin) → etkin yönetici
--        üyeliklerinin kurumları (şube yöneticisi DAHİL; `branch` null
--        verildiği için eski ifade şubeye bakmıyordu)
--      current_user_teaches_student  → current_user_taught_student_ids()
--      current_user_teaches_class    → current_user_teaching_class_ids()
--      current_user_owns_student_record → current_user_own_student_ids()
--      current_user_attends_class    → current_user_attended_class_ids()
--      current_user_guards_student   → current_user_guarded_student_ids()
--      current_user_guards_class     → velisi olunan öğrencinin etkin
--                                       kaydı olan sınıflar (aşağıda)
--
-- 2. `today_lessons` derslik adını `schedule_entries.room` metin kopyasından
--    değil `rooms` kaydından okur. Metin sütunu göç 20261029000000'dan beri
--    tetikleyiciyle tutulan bir kopya; istemci de bu sürümde onu okumayı
--    bırakıyor. Sütunun kendisi bir sonraki sürümde kalkar (genişlet–daralt:
--    açık sekmeler eski sorguyu birkaç saat daha gönderebilir).
--    `my_lessons_today` `today_lessons`'ı çağırdığı için ayrıca değişmez.
--    Kurumun bütün üyeleri derslikleri okuyabilir (`rooms_select_member`),
--    yani öğrenci ve veli derslik adını eskisi gibi görür.

create or replace function public.student_attendance_counts(target_student_ids uuid[])
returns table (
  student_id uuid,
  present_count bigint,
  late_count bigint,
  absent_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with yetki as materialized (
    -- Kilitli hesapta satır yok: aşağıdaki bütün birleştirmeler boş döner.
    select
      coalesce((
        select array_agg(uyelik.organization_id)
        from public.organization_memberships as uyelik
        where uyelik.user_id = (select auth.uid())
          and uyelik.status = 'active'
          and uyelik.role = 'admin'
      ), '{}'::uuid[]) as yonetici_kurumlari,
      public.current_user_taught_student_ids() as ogrettigi_ogrenciler,
      public.current_user_teaching_class_ids() as ogrettigi_siniflar,
      public.current_user_own_student_ids() as kendi_kaydi,
      public.current_user_attended_class_ids() as okudugu_siniflar,
      public.current_user_guarded_student_ids() as velisi_oldugu
    where not (select public.current_user_must_change_password())
  ),
  veli_siniflari as materialized (
    select coalesce(array_agg(distinct kayit.class_id), '{}'::uuid[]) as siniflar
    from public.class_enrollments as kayit, yetki
    where kayit.archived_at is null
      and kayit.student_id = any(yetki.velisi_oldugu)
  ),
  -- Önce (öğrenci, sınıf) başına sayılır, sonra süzülür: 93.600 satırı ara
  -- tabloya yazıp birleştirmek yerine birkaç yüz toplam satırı süzülür
  -- (yönetici için 80 ms'nin asıl kaynağı buydu, yetki değil).
  toplam as materialized (
    select
      kayit.student_id,
      oturum.class_id,
      oturum.organization_id,
      count(*) filter (where kayit.status = 'present') as present_count,
      count(*) filter (where kayit.status = 'late') as late_count,
      count(*) filter (where kayit.status = 'absent') as absent_count
    from public.attendance_records as kayit
    join public.attendance_sessions as oturum
      on oturum.id = kayit.session_id
     and oturum.organization_id = kayit.organization_id
    where kayit.student_id = any(target_student_ids)
      and oturum.archived_at is null
    group by kayit.student_id, oturum.class_id, oturum.organization_id
  )
  select
    toplam.student_id,
    sum(toplam.present_count)::bigint as present_count,
    sum(toplam.late_count)::bigint as late_count,
    sum(toplam.absent_count)::bigint as absent_count
  from toplam, yetki, veli_siniflari
  where toplam.organization_id = any(yetki.yonetici_kurumlari)
     or (toplam.student_id = any(yetki.ogrettigi_ogrenciler)
         and toplam.class_id = any(yetki.ogrettigi_siniflar))
     or (toplam.student_id = any(yetki.kendi_kaydi)
         and toplam.class_id = any(yetki.okudugu_siniflar))
     or (toplam.student_id = any(yetki.velisi_oldugu)
         and toplam.class_id = any(veli_siniflari.siniflar))
  group by toplam.student_id;
$$;

create or replace function public.student_homework_ratios(target_student_ids uuid[])
returns table (student_id uuid, recorded_count bigint, submitted_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with yetki as materialized (
    select
      coalesce((
        select array_agg(uyelik.organization_id)
        from public.organization_memberships as uyelik
        where uyelik.user_id = (select auth.uid())
          and uyelik.status = 'active'
          and uyelik.role = 'admin'
      ), '{}'::uuid[]) as yonetici_kurumlari,
      public.current_user_teaching_class_ids() as ogrettigi_siniflar,
      public.current_user_own_student_ids() as kendi_kaydi,
      public.current_user_guarded_student_ids() as velisi_oldugu
    where not (select public.current_user_must_change_password())
  ),
  -- `materialized`: kayıt tarihi kayıt başına BİR KEZ yerel güne çevrilir.
  -- Satır içine açılınca `orbit_local_date` ödevlerle birleşen her satırda
  -- (yerelde 23.040) yeniden çalışıyordu; yönetici için 60 ms'nin çoğu.
  gorunur_kayit as materialized (
    select
      kayit.student_id,
      kayit.class_id,
      kayit.organization_id,
      public.orbit_local_date(kayit.created_at) as enrolled_on
    from public.class_enrollments as kayit, yetki
    where kayit.student_id = any(target_student_ids)
      and kayit.archived_at is null
      and (
        kayit.organization_id = any(yetki.yonetici_kurumlari)
        or kayit.class_id = any(yetki.ogrettigi_siniflar)
        or kayit.student_id = any(yetki.kendi_kaydi)
        or kayit.student_id = any(yetki.velisi_oldugu)
      )
  ),
  gorunur_odev as (
    select distinct
      kayit.student_id,
      kayit.enrolled_on,
      odev.id as homework_id,
      odev.assigned_on
    from gorunur_kayit as kayit
    join public.homework_assignments as odev
      on odev.class_id = kayit.class_id
     and odev.organization_id = kayit.organization_id
    where odev.archived_at is null
      and odev.submissions_recorded_at is not null
  ),
  teslim as (
    select
      odev.student_id,
      odev.homework_id
    from gorunur_odev as odev
    join public.homework_submissions as kayit_teslim
      on kayit_teslim.homework_id = odev.homework_id
     and kayit_teslim.student_id = odev.student_id
    where kayit_teslim.archived_at is null
  )
  select
    odev.student_id,
    count(*) as recorded_count,
    count(*) filter (where teslim.homework_id is not null) as submitted_count
  from gorunur_odev as odev
  left join teslim
    on teslim.student_id = odev.student_id
   and teslim.homework_id = odev.homework_id
  where teslim.homework_id is not null
     or odev.assigned_on >= odev.enrolled_on
  group by odev.student_id;
$$;

create or replace function public.today_lessons(target_organization_id uuid)
returns table (
  entry_id uuid,
  starts_at time without time zone,
  ends_at time without time zone,
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
  select
    entry.id as entry_id,
    entry.starts_at,
    entry.ends_at,
    entry.class_id,
    klass.name as class_name,
    subject.name as subject_name,
    entry.title,
    derslik.name as room,
    staff.display_name as teacher_name,
    public.lesson_attendance_taken(entry.id, public.orbit_today()) as attendance_taken
  from public.schedule_entries as entry
  join public.classes as klass
    on klass.id = entry.class_id
  left join public.subjects as subject
    on subject.id = entry.subject_id
  left join public.rooms as derslik
    on derslik.id = entry.room_id
  -- Ad `profiles`'tan doğrudan okunmaz (#228); tek yol `class_staff_names`.
  left join lateral (
    select names.display_name
    from public.class_staff_names(array[entry.class_id]) as names
    where names.membership_id = entry.membership_id
    limit 1
  ) as staff on true
  where entry.organization_id = target_organization_id
    and entry.archived_at is null
    and klass.archived_at is null
    and entry.day_of_week = extract(isodow from public.orbit_today())::smallint
  order by entry.starts_at, klass.name;
$$;
