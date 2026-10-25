-- Ana plan 5.1 · Kalan okuma kuralları sorgu başına yetkilendirilir (2026-10-25)
--
-- PR #473 (göç 20261106000000) sınıf, üyelik ve profil okumalarını tek kurala
-- indirmiş ve yetkiyi sorgu başına bir kez hesaplatmıştı; 20261027000000 aynı
-- kalıbı on iki tabloya uygulamıştı. Geriye satır başına yetki fonksiyonu
-- çağıran **15 tabloda 22 okuma kuralı** kalmıştı: kural her satır için
-- `current_user_has_membership(organization_id)` gibi bir fonksiyonu yeniden
-- çağırıyor, fonksiyon da her seferinde üyelik tablosuna gidiyordu.
--
-- Kalıp aynı: yetki bir kez dizi olarak hesaplanır (`(select current_user_*_ids())`
-- — Postgres bunu sorgu başına bir kez çalıştırır), satır yalnız diziyle
-- karşılaştırılır. Birden çok izin veren okuma kuralı olan altı tablo tek
-- kurala indi; Supabase danışmanının altı `multiple_permissive_policies`
-- uyarısı bunlardı.
--
-- Eşleşmeler (her biri satır başı fonksiyonun gövdesiyle birebir):
--   current_user_has_membership(org)              → org = any(current_user_member_org_ids())
--   current_user_has_membership(org, null, admin) → org = any(current_user_admin_org_ids())
--   current_user_has_membership(org, id)  (şube)  → id = any(current_user_visible_branch_ids())  [yeni]
--   current_user_has_membership(org, branch_id, admin) (denetim)
--       → org tam yönetici kurumu ya da satır şubesiz ya da satırın şubesi yöneticinin şubesi
--   current_user_owns_membership(m)               → m = any(current_user_active_membership_ids())
--   current_user_guards_student(s)                → s = any(current_user_guarded_student_ids())
--   current_user_owns_student_record(s)           → s = any(current_user_own_student_ids())
--   current_user_teaches_student(s)               → s = any(current_user_taught_student_ids())
--
-- Kilit davranışı değişmez: kilitsiz olan iki kimlik okuması (şube ve kurumun
-- üye dalı) kilitsiz kalır; geri kalan her dal kilidi taşır.
--
-- Yalnız OKUMA kuralları. Yazma kuralları ve satır başı fonksiyonlar yerinde
-- (yazma yolları ve RPC'ler onları kullanıyor).
--
-- Eşdeğerlik: göçten önce ve sonra, tek işlemde, her kullanıcının 15 tabloda
-- gördüğü satırların parmak izi karşılaştırıldı (PR açıklaması).

-- ---------------------------------------------------------------------------
-- Yeni dizi fonksiyonu: çağıranın görebildiği şubeler
-- ---------------------------------------------------------------------------
create function public.current_user_visible_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  -- `current_user_has_membership(sube.organization_id, sube.id)` ile aynı:
  -- kurum geneli üyelik kurumun her şubesini, şubeli üyelik kendi şubesini
  -- görür. Arşivlenmiş şube de görünür (eski kural da süzmüyordu).
  select coalesce(array_agg(distinct sube.id), '{}'::uuid[])
  from public.branches as sube
  join public.organization_memberships as uyelik
    on uyelik.organization_id = sube.organization_id
  where uyelik.user_id = (select auth.uid())
    and uyelik.status = 'active'
    and (uyelik.branch_id is null or uyelik.branch_id = sube.id);
$$;

comment on function public.current_user_visible_branch_ids() is
  'Çağıranın görebildiği şubeler (aktif üyelik: kurum geneliyse kurumun bütün şubeleri, şubeliyse kendi şubesi). branches okuma kuralı sorgu başına bir kez çağırır.';

revoke all on function public.current_user_visible_branch_ids() from public, anon;
grant execute on function public.current_user_visible_branch_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Kurum ve şube (kimlik okumaları; üye dalı kilitsiz kalır)
-- ---------------------------------------------------------------------------
alter policy branches_select_member on public.branches
  using (id = any ((select public.current_user_visible_branch_ids())::uuid[]));

drop policy organizations_select_member on public.organizations;
drop policy organizations_select_platform_operator on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (
    -- Üye dalı kilitsiz: kilitli kullanıcı da kurumunun adını görür (giriş
    -- akışı ve "kurum kapatıldı" ekranı ona bakıyor).
    id = any ((select public.current_user_member_org_ids())::uuid[])
    or (
      (select public.current_user_is_platform_operator())
      and not (select public.current_user_must_change_password())
    )
  );

-- ---------------------------------------------------------------------------
-- Kurumun her üyesine açık tablolar
-- ---------------------------------------------------------------------------
alter policy exams_select_member on public.exams
  using (
    organization_id = any ((select public.current_user_member_org_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

alter policy exam_sections_select_member on public.exam_sections
  using (
    organization_id = any ((select public.current_user_member_org_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

alter policy subjects_select_member on public.subjects
  using (
    organization_id = any ((select public.current_user_member_org_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

-- ---------------------------------------------------------------------------
-- Yalnız yöneticiye açık tablolar
-- ---------------------------------------------------------------------------
alter policy schedule_templates_select_admin on public.schedule_templates
  using (
    organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

alter policy schedule_template_slots_select_admin on public.schedule_template_slots
  using (
    organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

-- Denetim kaydı: şube yöneticisi şubesiz kayıtları ve kendi şubesininkileri
-- görür, kurum geneli yönetici hepsini (students_select ile aynı üç durum).
alter policy audit_events_select_admin on public.audit_events
  using (
    organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
    and (
      organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
      or branch_id is null
      or branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
    )
    and not (select public.current_user_must_change_password())
  );

-- ---------------------------------------------------------------------------
-- Kişinin kendi kayıtları
-- ---------------------------------------------------------------------------
alter policy calendar_events_select_owner on public.calendar_events
  using (
    owner_membership_id = any ((select public.current_user_active_membership_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

alter policy tasks_select_owner on public.tasks
  using (
    owner_membership_id = any ((select public.current_user_active_membership_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

-- ---------------------------------------------------------------------------
-- Birden çok okuma kuralı olan tablolar: tek kural
-- ---------------------------------------------------------------------------
drop policy class_teachers_select_admin on public.class_teachers;
drop policy class_teachers_select_self on public.class_teachers;
create policy class_teachers_select on public.class_teachers
  for select to authenticated
  using (
    (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or membership_id = any ((select public.current_user_active_membership_ids())::uuid[])
    )
    and not (select public.current_user_must_change_password())
  );

drop policy substitute_assignments_select_admin on public.substitute_assignments;
drop policy substitute_assignments_select_self on public.substitute_assignments;
create policy substitute_assignments_select on public.substitute_assignments
  for select to authenticated
  using (
    (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or substitute_membership_id = any ((select public.current_user_active_membership_ids())::uuid[])
      or absent_membership_id = any ((select public.current_user_active_membership_ids())::uuid[])
    )
    and not (select public.current_user_must_change_password())
  );

drop policy payment_plans_select_admin on public.payment_plans;
drop policy payment_plans_select_guardian on public.payment_plans;
create policy payment_plans_select on public.payment_plans
  for select to authenticated
  using (
    (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or student_id = any ((select public.current_user_guarded_student_ids())::uuid[])
    )
    and not (select public.current_user_must_change_password())
  );

drop policy exam_absences_select_admin on public.exam_absences;
drop policy exam_absences_select_guardian on public.exam_absences;
drop policy exam_absences_select_student on public.exam_absences;
drop policy exam_absences_select_teacher on public.exam_absences;
create policy exam_absences_select on public.exam_absences
  for select to authenticated
  using (
    (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or student_id = any ((select public.current_user_guarded_student_ids())::uuid[])
      or student_id = any ((select public.current_user_own_student_ids())::uuid[])
      or student_id = any ((select public.current_user_taught_student_ids())::uuid[])
    )
    and not (select public.current_user_must_change_password())
  );

drop policy exam_section_results_select_admin on public.exam_section_results;
drop policy exam_section_results_select_guardian on public.exam_section_results;
drop policy exam_section_results_select_student on public.exam_section_results;
drop policy exam_section_results_select_teacher on public.exam_section_results;
create policy exam_section_results_select on public.exam_section_results
  for select to authenticated
  using (
    (
      organization_id = any ((select public.current_user_admin_org_ids())::uuid[])
      or student_id = any ((select public.current_user_guarded_student_ids())::uuid[])
      or student_id = any ((select public.current_user_own_student_ids())::uuid[])
      or student_id = any ((select public.current_user_taught_student_ids())::uuid[])
    )
    and not (select public.current_user_must_change_password())
  );
