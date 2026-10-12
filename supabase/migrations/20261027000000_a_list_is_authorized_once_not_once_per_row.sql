-- Liste okumaları satır başına değil sorgu başına yetkilendirilir
-- (2026-10-12, ROADMAP v1.5-24 / §4.23 B14).
--
-- ÖLÇÜM (yerel, `supabase/perf/seed_olcum.sql`, kurum 1000: 400 öğrenci,
-- 1.200 ödev; beş tekrarın ortalaması, ısınmadan sonra):
--   ödev listesi  öğrenci 418 ms · veli 446 ms · yönetici 459 ms
--   duyuru akışı  öğrenci 159 ms · veli 168 ms
--   ders programı öğrenci  36 ms · veli  41 ms
-- Eşzamanlılık ölçümünde (§4.23) veritabanı süresinin ~%85'i öğrencinin ödev
-- listesindeydi.
--
-- SEBEP: üç tabloda rol başına ayrı `permissive` okuma kuralı var (yönetici,
-- öğretmen, öğrenci, veli; akışta ayrıca kurum geneli). Postgres bunları
-- VEYA'layıp HER SATIR için ayrı ayrı çağırıyor: 1.200 ödevde satır başına
-- dört fonksiyon. Yöneticide de aynı maliyet.
--
-- ÇÖZÜM — kiracı ön süzgecinin (`current_user_scope_org_ids`, v1.5-19)
-- kalıbı: kullanıcının görebileceği sınıflar ve yöneticisi olduğu kurumlar
-- SORGU BAŞINA BİR KEZ dizi olarak hesaplanır (`(select …)` → initPlan),
-- satırlar diziyle karşılaştırılır ve indeks kullanılabilir.
--
-- ANLAM DEĞİŞMEZ, ve bu ölçüldü: dizi, satır başına çağrılan fonksiyonların
-- AYNILARIYLA kurulur (`current_user_teaches_class`, `…_attends_class`,
-- `…_guards_class`); yönetici dalı `current_user_has_membership(org, null,
-- admin)`'in birebir karşılığı olan `current_user_admin_org_ids()`'dir.
-- Sınıflar `current_user_scope_org_ids()` ile sınırlanır: o fonksiyon
-- üyelikleri, öğrenci kayıtlarını ve veli kayıtlarını birlikte kapsar, yani
-- üç yetki fonksiyonunun doğru dönebileceği her kurum içindedir. Göçten önce
-- ve sonra 200 kullanıcının üç tabloda gördüğü satırların parmak izi alındı
-- ve birebir aynı çıktı (PR açıklaması).
--
-- KAPSAM: üç bölüm, on iki tablo — (1) ödev, ders programı, duyuru;
-- (2) öğrenci, sınıf kaydı, öğrenci–veli bağı; (3) yoklama kaydı ve oturumu,
-- sınav sonucu, ödev teslimi, taksit, veli. Yalnız OKUMA (select) kuralları
-- değişir; yazma kuralları ve kısıtlayıcı kurallar (`*_tenant_prefilter`,
-- `daily_feed_posts_audience`) olduğu gibi kalır. Satır başına çağrılan eski
-- yetki fonksiyonları silinmez: yazma kuralları ve RPC'ler onları kullanıyor.

create function public.current_user_visible_class_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(sinif.id), '{}'::uuid[])
  from public.classes as sinif
  where sinif.organization_id = any ((select public.current_user_scope_org_ids())::uuid[])
    and (
      public.current_user_teaches_class(sinif.id)
      or public.current_user_attends_class(sinif.id)
      or public.current_user_guards_class(sinif.id)
    );
$$;

comment on function public.current_user_visible_class_ids() is
  'Kullanıcının okuttuğu (vekillik dahil), okuduğu ya da velisi olduğu sınıflar; satır başına çağrılan üç yetki fonksiyonunun sorgu başına bir kez hesaplanmış birleşimi. 2026-10-12, v1.5-24.';

create function public.current_user_active_membership_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(uyelik.id), '{}'::uuid[])
  from public.organization_memberships as uyelik
  where uyelik.user_id = (select auth.uid())
    and uyelik.status = 'active';
$$;

comment on function public.current_user_active_membership_ids() is
  'Kullanıcının etkin üyelik kimlikleri. Ders programında kişiye yazılmış satırın (vekil) sorgu başına bir kez çözülmesi için. 2026-10-12, v1.5-24.';

revoke all on function public.current_user_visible_class_ids() from public, anon;
grant execute on function public.current_user_visible_class_ids() to authenticated;
revoke all on function public.current_user_active_membership_ids() from public, anon;
grant execute on function public.current_user_active_membership_ids() to authenticated;

-- Ödevler ---------------------------------------------------------------------
drop policy homework_assignments_select_admin on public.homework_assignments;
drop policy homework_assignments_select_teacher on public.homework_assignments;
drop policy homework_assignments_select_student on public.homework_assignments;
drop policy homework_assignments_select_guardian on public.homework_assignments;

create policy homework_assignments_select
  on public.homework_assignments
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or class_id = any ((select public.current_user_visible_class_ids())::uuid[])
    )
  );

-- Ders programı ---------------------------------------------------------------
drop policy schedule_entries_select_admin on public.schedule_entries;
drop policy schedule_entries_select_teacher on public.schedule_entries;
drop policy schedule_entries_select_student on public.schedule_entries;
drop policy schedule_entries_select_guardian on public.schedule_entries;

create policy schedule_entries_select
  on public.schedule_entries
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or class_id = any ((select public.current_user_visible_class_ids())::uuid[])
      -- Öğretmene doğrudan yazılmış satır (sınıfı okutmasa da): eski
      -- `schedule_entries_select_teacher`'ın ikinci dalı, aynı anlamla.
      or membership_id = any ((select public.current_user_active_membership_ids())::uuid[])
    )
  );

-- Duyurular -------------------------------------------------------------------
-- `daily_feed_posts_audience` (kitle) ve `daily_feed_posts_tenant_prefilter`
-- kısıtlayıcı kuralları değişmez; bu kural onlarla VE'lenmeye devam eder.
drop policy daily_feed_posts_select_admin on public.daily_feed_posts;
drop policy daily_feed_posts_select_teacher on public.daily_feed_posts;
drop policy daily_feed_posts_select_student on public.daily_feed_posts;
drop policy daily_feed_posts_select_guardian on public.daily_feed_posts;
drop policy daily_feed_posts_select_organization_wide on public.daily_feed_posts;

create policy daily_feed_posts_select
  on public.daily_feed_posts
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or class_id = any ((select public.current_user_visible_class_ids())::uuid[])
      -- Kurum geneli duyuru: eski `…_select_organization_wide` —
      -- `current_user_has_membership(organization_id)` = etkin üyelik.
      or (
        class_id is null
        and organization_id = any ((select public.current_user_member_org_ids())::uuid[])
      )
    )
  );

-- =============================================================================
-- İKİNCİ BÖLÜM — öğrenci listesi ve gömülü tabloları (2026-10-12)
-- =============================================================================
--
-- Aynı ölçümde yöneticinin kendi kurumunun 400 öğrencisini okuması 206 ms,
-- öğrenci listesi (sınıf ve veli gömülü) 216 ms sürüyordu; personel
-- girişinin asıl maliyeti buydu. Üç tabloda da rol başına satır başına kural.
--
-- Yönetici dalı ŞUBEYE de bakıyor: `current_user_has_membership(org,
-- student.branch_id, admin)` doğru döner ancak ve ancak o kurumda etkin bir
-- yönetici üyeliği varsa ve (öğrencinin şubesi boşsa YA DA üyeliğin şubesi
-- boşsa YA DA ikisi aynıysa). Bu üç durum aşağıda üç diziyle birebir kuruldu.
-- Diğer diziler satır başına çağrılan fonksiyonların tanımlarından harfi
-- harfine türetildi (her birinin yanında karşılığı yazılı).

create function public.current_user_full_admin_org_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- şubesiz (bütün kurum) yönetici üyelikleri
  select coalesce(array_agg(uyelik.organization_id), '{}'::uuid[])
  from public.organization_memberships as uyelik
  where uyelik.user_id = (select auth.uid())
    and uyelik.status = 'active' and uyelik.role = 'admin'
    and uyelik.branch_id is null;
$$;

create function public.current_user_admin_branch_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- şubeye bağlı yönetici üyeliklerinin şubeleri
  select coalesce(array_agg(uyelik.branch_id), '{}'::uuid[])
  from public.organization_memberships as uyelik
  where uyelik.user_id = (select auth.uid())
    and uyelik.status = 'active' and uyelik.role = 'admin'
    and uyelik.branch_id is not null;
$$;

create function public.current_user_taught_student_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- `current_user_teaches_student`: etkin kayıt, arşivlenmemiş sınıf,
  -- `current_user_teaches_class`
  select coalesce(array_agg(distinct kayit.student_id), '{}'::uuid[])
  from public.class_enrollments as kayit
  join public.classes as sinif on sinif.id = kayit.class_id
  where kayit.archived_at is null
    and sinif.archived_at is null
    and sinif.organization_id = any ((select public.current_user_scope_org_ids())::uuid[])
    and public.current_user_teaches_class(sinif.id);
$$;

create function public.current_user_guarded_student_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- `current_user_guards_student`: etkin bağ, arşivlenmemiş veli kaydı
  select coalesce(array_agg(distinct bag.student_id), '{}'::uuid[])
  from public.student_guardians as bag
  join public.guardians as veli on veli.id = bag.guardian_id
  where bag.archived_at is null
    and veli.archived_at is null
    and veli.auth_user_id = (select auth.uid());
$$;

create function public.current_user_own_student_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- `current_user_owns_student_record`
  select coalesce(array_agg(ogrenci.id), '{}'::uuid[])
  from public.students as ogrenci
  where ogrenci.auth_user_id = (select auth.uid());
$$;

create function public.current_user_guardian_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- `student_guardians_select_guardian`'ın alt sorgusu
  select coalesce(array_agg(veli.id), '{}'::uuid[])
  from public.guardians as veli
  where veli.auth_user_id = (select auth.uid())
    and veli.archived_at is null;
$$;

create function public.current_user_teaching_class_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- `current_user_teaches_class` (vekillik dahil)
  select coalesce(array_agg(sinif.id), '{}'::uuid[])
  from public.classes as sinif
  where sinif.organization_id = any ((select public.current_user_scope_org_ids())::uuid[])
    and public.current_user_teaches_class(sinif.id);
$$;

create function public.current_user_attended_class_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- `current_user_attends_class`
  select coalesce(array_agg(sinif.id), '{}'::uuid[])
  from public.classes as sinif
  where sinif.organization_id = any ((select public.current_user_scope_org_ids())::uuid[])
    and public.current_user_attends_class(sinif.id);
$$;

revoke all on function public.current_user_full_admin_org_ids() from public, anon;
revoke all on function public.current_user_admin_branch_ids() from public, anon;
revoke all on function public.current_user_taught_student_ids() from public, anon;
revoke all on function public.current_user_guarded_student_ids() from public, anon;
revoke all on function public.current_user_own_student_ids() from public, anon;
revoke all on function public.current_user_guardian_ids() from public, anon;
revoke all on function public.current_user_teaching_class_ids() from public, anon;
revoke all on function public.current_user_attended_class_ids() from public, anon;
grant execute on function public.current_user_full_admin_org_ids() to authenticated;
grant execute on function public.current_user_admin_branch_ids() to authenticated;
grant execute on function public.current_user_taught_student_ids() to authenticated;
grant execute on function public.current_user_guarded_student_ids() to authenticated;
grant execute on function public.current_user_own_student_ids() to authenticated;
grant execute on function public.current_user_guardian_ids() to authenticated;
grant execute on function public.current_user_teaching_class_ids() to authenticated;
grant execute on function public.current_user_attended_class_ids() to authenticated;

-- Öğrenciler -----------------------------------------------------------------
drop policy students_select_admin on public.students;
drop policy students_select_self on public.students;
drop policy students_select_teacher on public.students;
drop policy students_select_guardian on public.students;

create policy students_select
  on public.students
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      -- yönetici: has_membership(org, branch_id, admin)'in üç durumu
      organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
      or (branch_id is null
          and organization_id = any ((select public.current_user_admin_org_ids())::uuid[]))
      or branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
      or auth_user_id = (select auth.uid())
      or id = any ((select public.current_user_taught_student_ids())::uuid[])
      or id = any ((select public.current_user_guarded_student_ids())::uuid[])
    )
  );

-- Sınıf kayıtları ------------------------------------------------------------
drop policy class_enrollments_select_admin on public.class_enrollments;
drop policy class_enrollments_select_guardian on public.class_enrollments;
drop policy class_enrollments_select_student on public.class_enrollments;
drop policy class_enrollments_select_teacher on public.class_enrollments;

create policy class_enrollments_select
  on public.class_enrollments
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or student_id = any ((select public.current_user_guarded_student_ids())::uuid[])
      or class_id = any ((select public.current_user_attended_class_ids())::uuid[])
      or class_id = any ((select public.current_user_teaching_class_ids())::uuid[])
    )
  );

-- Öğrenci–veli bağları -------------------------------------------------------
drop policy student_guardians_select_admin on public.student_guardians;
drop policy student_guardians_select_guardian on public.student_guardians;
drop policy student_guardians_select_student on public.student_guardians;
drop policy student_guardians_select_teacher on public.student_guardians;

create policy student_guardians_select
  on public.student_guardians
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or guardian_id = any ((select public.current_user_guardian_ids())::uuid[])
      or student_id = any ((select public.current_user_own_student_ids())::uuid[])
      or student_id = any ((select public.current_user_taught_student_ids())::uuid[])
    )
  );

-- =============================================================================
-- ÜÇÜNCÜ BÖLÜM — yoklama, sınav sonucu, ödev teslimi, taksit, veli (2026-10-12)
-- =============================================================================
--
-- Aynı tohumda tabloyu kurumun tamamı için süzgeçsiz okumak (her rolde):
--   yoklama kayıtları ~47 sn · sınav sonuçları ~2,9 sn · yoklama oturumları
--   ~1,3 sn · taksitler ~0,6 sn · ödev teslimleri ~0,3 sn · veliler ~0,2 sn.
-- Uygulama bunları çoğunlukla öğrenciye/oturuma süzerek okuduğu için ekranda
-- bu kadar uzun sürmüyordu; ama rapor ve dışa aktarma gibi geniş okumalarda
-- ve yük altında sebep aynıydı. Dizi kalıbı ve eşdeğerlik ölçümü yukarıdaki
-- gibi (göç öncesi ve sonrası görünür satırların parmak izi aynı).

create function public.current_user_taught_guardian_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- `current_user_teaches_guardian`: etkin bağ + okuttuğu öğrenci
  select coalesce(array_agg(distinct bag.guardian_id), '{}'::uuid[])
  from public.student_guardians as bag
  where bag.archived_at is null
    and bag.student_id = any ((select public.current_user_taught_student_ids())::uuid[]);
$$;

create function public.current_user_visible_payment_plan_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  -- `current_user_can_see_payment_plan`: planın kurumunda yönetici ya da
  -- planın öğrencisinin velisi
  select coalesce(array_agg(plan.id), '{}'::uuid[])
  from public.payment_plans as plan
  where plan.organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
     or plan.student_id = any ((select public.current_user_guarded_student_ids())::uuid[]);
$$;

revoke all on function public.current_user_taught_guardian_ids() from public, anon;
revoke all on function public.current_user_visible_payment_plan_ids() from public, anon;
grant execute on function public.current_user_taught_guardian_ids() to authenticated;
grant execute on function public.current_user_visible_payment_plan_ids() to authenticated;

-- Yoklama kayıtları ----------------------------------------------------------
drop policy attendance_records_select_admin on public.attendance_records;
drop policy attendance_records_select_guardian on public.attendance_records;
drop policy attendance_records_select_student on public.attendance_records;
drop policy attendance_records_select_teacher on public.attendance_records;

create policy attendance_records_select
  on public.attendance_records
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or student_id = any ((select public.current_user_guarded_student_ids())::uuid[])
      or student_id = any ((select public.current_user_own_student_ids())::uuid[])
      or student_id = any ((select public.current_user_taught_student_ids())::uuid[])
    )
  );

-- Yoklama oturumları ---------------------------------------------------------
drop policy attendance_sessions_select_admin on public.attendance_sessions;
drop policy attendance_sessions_select_guardian on public.attendance_sessions;
drop policy attendance_sessions_select_student on public.attendance_sessions;
drop policy attendance_sessions_select_teacher on public.attendance_sessions;

create policy attendance_sessions_select
  on public.attendance_sessions
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or class_id = any ((select public.current_user_visible_class_ids())::uuid[])
    )
  );

-- Sınav sonuçları ------------------------------------------------------------
drop policy exam_results_select_admin on public.exam_results;
drop policy exam_results_select_guardian on public.exam_results;
drop policy exam_results_select_student on public.exam_results;
drop policy exam_results_select_teacher on public.exam_results;

create policy exam_results_select
  on public.exam_results
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or student_id = any ((select public.current_user_guarded_student_ids())::uuid[])
      or student_id = any ((select public.current_user_own_student_ids())::uuid[])
      or student_id = any ((select public.current_user_taught_student_ids())::uuid[])
    )
  );

-- Ödev teslimleri ------------------------------------------------------------
drop policy homework_submissions_select_admin on public.homework_submissions;
drop policy homework_submissions_select_guardian on public.homework_submissions;
drop policy homework_submissions_select_student on public.homework_submissions;
drop policy homework_submissions_select_teacher on public.homework_submissions;

create policy homework_submissions_select
  on public.homework_submissions
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or student_id = any ((select public.current_user_guarded_student_ids())::uuid[])
      or student_id = any ((select public.current_user_own_student_ids())::uuid[])
      -- öğretmen: ödevin sınıfını okutuyor (eski `…_select_teacher` ile aynı)
      or exists (
        select 1
        from public.homework_assignments as odev
        where odev.id = homework_submissions.homework_id
          and odev.class_id = any ((select public.current_user_teaching_class_ids())::uuid[])
      )
    )
  );

-- Taksitler ------------------------------------------------------------------
drop policy installments_select_authorized on public.installments;

create policy installments_select_authorized
  on public.installments
  for select
  to authenticated
  using (
    plan_id = any ((select public.current_user_visible_payment_plan_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

-- Veliler --------------------------------------------------------------------
drop policy guardians_select_admin on public.guardians;
drop policy guardians_select_self on public.guardians;
drop policy guardians_select_teacher on public.guardians;

create policy guardians_select
  on public.guardians
  for select
  to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or auth_user_id = (select auth.uid())
      or id = any ((select public.current_user_taught_guardian_ids())::uuid[])
    )
  );
