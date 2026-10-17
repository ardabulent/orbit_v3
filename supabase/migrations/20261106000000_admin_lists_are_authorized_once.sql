-- Sınıf, üyelik ve profil listeleri satır başına değil sorgu başına
-- yetkilendirilir (2026-10-17, Hız 2).
--
-- ÖLÇÜM (yerel, `supabase/perf/seed_olcum.sql`, kurum 1000: 400 öğrenci;
-- kurumun yöneticisi, `explain analyze`):
--   classes                    72 ms (20 satır döner)
--   profiles                  104 ms (683 satır)
--   organization_memberships   28 ms (683 satır)
-- Üçü de her personel girişinde ve her panel açılışında okunuyor.
--
-- SEBEP: göç 20261027000000'ın on iki tabloda kapattığı durumun aynısı. Bu
-- üç tabloda rol başına ayrı `permissive` okuma kuralı var ve kurallar yetki
-- fonksiyonunu SATIR BAŞINA çağırıyor (`current_user_has_membership(org,
-- branch, admin)`, `…_teaches_class(id)`, `…_administers_person(id)`,
-- `…_shares_person(id)`). Postgres kuralları VEYA'layıp her satırda hepsini
-- çalıştırıyor. Supabase danışmanı da aynı üç tabloyu "multiple permissive
-- policies" olarak işaretliyordu.
--
-- ÇÖZÜM: kullanıcının yetkili olduğu kurumlar, şubeler, kişiler ve sınıflar
-- SORGU BAŞINA BİR KEZ dizi olarak hesaplanır (`(select …)` → initPlan),
-- satırlar diziyle karşılaştırılır; her tabloda tek okuma kuralı kalır.
--
-- ANLAM DEĞİŞMEZ. Diziler, satır başına çağrılan fonksiyonların gövdesinden
-- birebir türetildi:
--
--   current_user_has_membership(org, branch, {admin})
--     = etkin bir yönetici üyeliği var, kurumu satırın kurumu ve
--       (üyeliğin şubesi boş VEYA satırın şubesi boş VEYA ikisi aynı)
--     → göç 20261027000000'daki `students_select`'in üç durumu, aynı dizi
--       fonksiyonlarıyla: kurum geneli yönetici (`…_full_admin_org_ids`),
--       şubesiz satırda herhangi bir yönetici (`…_admin_org_ids`), şubeli
--       satırda o şubenin yöneticisi (`…_admin_branch_ids`; şube kimlikleri
--       küresel tekil ve şube kendi kurumuna bağlı).
--   current_user_teaches/attends/guards_class(id)
--     → id = any(current_user_visible_class_ids())  (göç 20261027000000,
--       aynı üç fonksiyonla kurulur)
--   current_user_administers_person(id)
--     = id'nin herhangi bir üyeliği, çağıranın etkin yönetici olduğu bir
--       kurumda (şubeye bakılmaz, üyeliğin durumuna bakılmaz)
--     → id = any(current_user_administered_user_ids())
--   current_user_shares_person(id)
--     = id ile çağıran aynı kişiye (person_id) bağlı
--     → id = any(current_user_linked_profile_ids())
--
-- Şifre kilidi ve "kendi satırı" dalları olduğu gibi korunur: kendi üyeliğini
-- ve profilini kilitli hesap da görür (giriş akışı ona bakıyor), geri kalan
-- her dal kilitliyken kapalıdır.
--
-- DOĞRULAMA: tek bir işlemde, yerel verideki 4.504 kullanıcının HER BİRİ için
-- üç tabloda görülen satırların parmak izi göçten önce ve sonra alındı ve
-- birebir aynı çıktı; işlem geri alındı. Yerel veride bulunmayan durumlar
-- işlemin içinde kuruldu: şube yöneticisi (iki şubeli kurumda), şifre kilidi
-- açık yönetici/öğretmen/öğrenci, aynı kişiye bağlı iki hesap (PR açıklaması).
--
-- KAPSAM: yalnız OKUMA kuralları. Yazma kuralları (`classes_update_admin`
-- vb.) ve satır başına çalışan eski yetki fonksiyonları yerinde kalır; yazma
-- kuralları ve RPC'ler onları kullanıyor.

create function public.current_user_administered_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct uye.user_id), '{}'::uuid[])
  from public.organization_memberships as uye
  where uye.organization_id = any ((select public.current_user_admin_org_ids())::uuid[]);
$$;

comment on function public.current_user_administered_user_ids() is
  'Kullanıcının etkin yöneticisi olduğu kurumlarda üyeliği bulunan bütün hesaplar; `current_user_administers_person(id)`''in sorgu başına bir kez hesaplanmış karşılığı. 2026-10-17.';

create function public.current_user_linked_profile_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(digeri.id), '{}'::uuid[])
  from public.profiles as ben
  join public.profiles as digeri
    on digeri.person_id = ben.person_id
  where ben.id = (select auth.uid());
$$;

comment on function public.current_user_linked_profile_ids() is
  'Kullanıcıyla aynı kişiye (person_id) bağlı hesaplar, kendisi dahil; `current_user_shares_person(id)`''in sorgu başına bir kez hesaplanmış karşılığı. 2026-10-17.';

revoke all on function public.current_user_administered_user_ids() from public, anon;
grant execute on function public.current_user_administered_user_ids() to authenticated;
revoke all on function public.current_user_linked_profile_ids() from public, anon;
grant execute on function public.current_user_linked_profile_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
drop policy classes_select_admin on public.classes;
drop policy classes_select_teacher on public.classes;
drop policy classes_select_student on public.classes;
drop policy classes_select_guardian on public.classes;

create policy classes_select
  on public.classes
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
      or id = any ((select public.current_user_visible_class_ids())::uuid[])
    )
  );

-- ---------------------------------------------------------------------------
-- organization_memberships
-- ---------------------------------------------------------------------------
drop policy memberships_select_admin on public.organization_memberships;
drop policy memberships_select_self on public.organization_memberships;

create policy memberships_select
  on public.organization_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      not (select public.current_user_must_change_password())
      and (
        organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
        or (branch_id is null
            and organization_id = any ((select public.current_user_admin_org_ids())::uuid[]))
        or branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
      )
    )
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy profiles_select_self on public.profiles;
drop policy profiles_select_organization_admin on public.profiles;
drop policy profiles_select_linked_account on public.profiles;
drop policy profiles_select_platform_operator on public.profiles;

create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (
      not (select public.current_user_must_change_password())
      and (
        id = any ((select public.current_user_administered_user_ids())::uuid[])
        or id = any ((select public.current_user_linked_profile_ids())::uuid[])
        or (
          (select public.current_user_is_platform_operator())
          and exists (
            select 1
            from public.platform_operators as operator
            where operator.user_id = profiles.id
          )
        )
      )
    )
  );
