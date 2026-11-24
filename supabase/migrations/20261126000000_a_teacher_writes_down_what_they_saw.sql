-- Takip sekmesi, 3. dilim: öğretmen notu ve görüşme kaydı (ana plan 4.10c,
-- karar 2026-11-24).
--
-- Riskli listedeki öğrenciyle ilgilenildi mi? Not ve görüşme kaydı bunu
-- gösterir: gözlem, öğrenci görüşmesi, veli görüşmesi — tarih ve metin.
--
-- Kim:
--   görür   — yönetici (students_select'in üç yönetici dalı, şube kapsamı) ve
--             öğrenciyi okutan öğretmen (vekillik dahil), yazanı fark etmeksizin.
--             Öğrenci ve veli GÖRMEZ.
--   yazar   — aynı kişiler; yazar alanını tetikleyici doldurur.
--   düzeltir / arşivler — yalnız yazan ya da yönetici.
--   silme   — yok; not arşivlenir.
--
-- KVKK: not metni kişisel veridir. Denetim kaydına METİN yazılmaz (yalnız tür,
-- tarih, öğrenci); log'a hiç yazılmaz. Ekran özel nitelikli veri (sağlık, din…)
-- yazılmaması uyarısını gösterir. Saklama: öğrenci kaydı durdukça kalır, ayrı
-- süre yok (karar K9); kurum boşaltması `organization_id` taşıyan her tabloyu
-- kendiliğinden siler (20261118).
--
-- Okuma iki yoldan: tablonun RLS'i (doğrudan erişim) ve yazar adını da veren
-- `student_followup_notes_list` (security definer; öğretmen başka üyelerin
-- profilini okuyamadığı için). İkisi aynı kapsam ifadesini kullanır ve
-- `student_followup_notes.test.sql` her rol için aynı satırları verdiklerini
-- sınar.

create type public.followup_note_kind as enum (
  'observation',
  'student_meeting',
  'guardian_meeting'
);

comment on type public.followup_note_kind is
  'Takip notunun türü: gözlem, öğrenci görüşmesi, veli görüşmesi.';

create table public.student_followup_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  student_id uuid not null,
  kind public.followup_note_kind not null,
  occurred_on date not null,
  body text not null,
  -- İstemci yazamaz; tetikleyici çağıranın üyeliğinden doldurur ve sonra değişmez.
  author_membership_id uuid not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_followup_notes_body_check
    check (char_length(btrim(body)) between 1 and 2000),
  constraint student_followup_notes_student_organization_fkey
    foreign key (student_id, organization_id)
    references public.students (id, organization_id) on delete restrict,
  constraint student_followup_notes_author_organization_fkey
    foreign key (author_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict
);

comment on table public.student_followup_notes is
  'Takip notu ve görüşme kaydı. Yönetici ve öğrenciyi okutan öğretmen görür ve yazar; yalnız yazan ya da yönetici düzeltir/arşivler. Öğrenci ve veli görmez. Silinmez, arşivlenir. Metin denetim kaydına yazılmaz.';

create index student_followup_notes_student_idx
  on public.student_followup_notes (student_id, occurred_on desc)
  where archived_at is null;
create index student_followup_notes_author_idx
  on public.student_followup_notes (author_membership_id);
create index student_followup_notes_organization_idx
  on public.student_followup_notes (organization_id);

create trigger student_followup_notes_set_updated_at
before update on public.student_followup_notes
for each row execute function public.set_updated_at();

-- Yazar eklemede çağırandan alınır (istemcinin değeri ezilir); tarih bugünden
-- ileri olamaz. Check kısıtı `orbit_today()` çağıramadığı için tetikleyicide.
create function public.enforce_followup_note_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select auth.uid()) is not null then
    select uyelik.id
    into new.author_membership_id
    from public.organization_memberships as uyelik
    where uyelik.user_id = (select auth.uid())
      and uyelik.organization_id = new.organization_id
      and uyelik.status = 'active'
    order by uyelik.branch_id nulls first
    limit 1;
  end if;

  if new.occurred_on > public.orbit_today() then
    raise exception 'Görüşme tarihi bugünden ileri olamaz.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.enforce_followup_note_fields() is
  'student_followup_notes: eklemede yazarı çağırandan doldurur, tarihin bugünden ileri olmasını reddeder.';

revoke all on function public.enforce_followup_note_fields()
  from public, anon, authenticated;

create trigger student_followup_notes_enforce_fields
before insert or update on public.student_followup_notes
for each row execute function public.enforce_followup_note_fields();

alter table public.student_followup_notes enable row level security;

revoke all on public.student_followup_notes from anon, authenticated;
grant select on public.student_followup_notes to authenticated;
grant insert (organization_id, student_id, kind, occurred_on, body)
  on public.student_followup_notes to authenticated;
-- Öğrenci, kurum ve yazar güncellenemez: yalnız içerik ve arşiv.
grant update (kind, occurred_on, body, archived_at)
  on public.student_followup_notes to authenticated;

-- Kapsam: yönetici dalları (öğrencinin şubesine göre) ya da okutan öğretmen.
-- Aynı ifade aşağıdaki liste fonksiyonunda da var; eşdeğerlik testle sabit.
create policy student_followup_notes_select_staff
  on public.student_followup_notes
  for select to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      student_id = any ((select public.current_user_taught_student_ids())::uuid[])
      or exists (
        select 1
        from public.students as ogrenci
        where ogrenci.id = student_followup_notes.student_id
          and (
            ogrenci.organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
            or (ogrenci.branch_id is null
                and ogrenci.organization_id = any ((select public.current_user_admin_org_ids())::uuid[]))
            or ogrenci.branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
          )
      )
    )
  );

create policy student_followup_notes_insert_staff
  on public.student_followup_notes
  for insert to authenticated
  with check (
    not (select public.current_user_must_change_password())
    and (
      student_id = any ((select public.current_user_taught_student_ids())::uuid[])
      or exists (
        select 1
        from public.students as ogrenci
        where ogrenci.id = student_followup_notes.student_id
          and ogrenci.organization_id = student_followup_notes.organization_id
          and (
            ogrenci.organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
            or (ogrenci.branch_id is null
                and ogrenci.organization_id = any ((select public.current_user_admin_org_ids())::uuid[]))
            or ogrenci.branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
          )
      )
    )
  );

-- Düzeltme ve arşiv: yazan (hâlâ okutuyorsa) ya da yönetici.
create policy student_followup_notes_update_author_or_admin
  on public.student_followup_notes
  for update to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      (author_membership_id = any ((select public.current_user_active_membership_ids())::uuid[])
        and student_id = any ((select public.current_user_taught_student_ids())::uuid[]))
      or exists (
        select 1
        from public.students as ogrenci
        where ogrenci.id = student_followup_notes.student_id
          and (
            ogrenci.organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
            or (ogrenci.branch_id is null
                and ogrenci.organization_id = any ((select public.current_user_admin_org_ids())::uuid[]))
            or ogrenci.branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
          )
      )
    )
  )
  with check (
    not (select public.current_user_must_change_password())
  );

-- İz: tür, tarih, öğrenci — METİN YOK.
create trigger student_followup_notes_audit_insert
  after insert on public.student_followup_notes
  for each row execute function public.audit_row_change(
    'followup_note', 'student_id', 'kind', 'occurred_on'
  );

create trigger student_followup_notes_audit_update
  after update on public.student_followup_notes
  for each row execute function public.audit_row_change(
    'followup_note', 'student_id', 'kind', 'occurred_on', '~body'
  );

-- =========================================================================
-- Liste: yazar adıyla
-- =========================================================================
--
-- `can_edit` yalnız kullanıcı deneyimidir; yazma yetkisi yukarıdaki kuralda.
-- Kapsam dışı öğrenci boş döner (varlık sızdırmaz).

create function public.student_followup_notes_list(p_student_id uuid)
returns table (
  id uuid,
  kind public.followup_note_kind,
  occurred_on date,
  body text,
  author_name text,
  is_mine boolean,
  can_edit boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  okutuyor boolean;
  yonetiyor boolean;
  uyeliklerim uuid[];
begin
  if p_student_id is null or public.current_user_must_change_password() then
    return;
  end if;

  okutuyor := p_student_id = any (public.current_user_taught_student_ids());

  select exists (
    select 1
    from public.students as ogrenci
    where ogrenci.id = p_student_id
      and (
        ogrenci.organization_id = any (public.current_user_full_admin_org_ids())
        or (ogrenci.branch_id is null
            and ogrenci.organization_id = any (public.current_user_admin_org_ids()))
        or ogrenci.branch_id = any (public.current_user_admin_branch_ids())
      )
  ) into yonetiyor;

  if not (okutuyor or yonetiyor) then
    return;
  end if;

  uyeliklerim := public.current_user_active_membership_ids();

  return query
  select
    notu.id,
    notu.kind,
    notu.occurred_on,
    notu.body,
    coalesce(nullif(btrim(profil.display_name), ''), 'Kurum üyesi') as author_name,
    notu.author_membership_id = any (uyeliklerim) as is_mine,
    yonetiyor or (notu.author_membership_id = any (uyeliklerim) and okutuyor) as can_edit,
    notu.created_at,
    notu.updated_at
  from public.student_followup_notes as notu
  join public.organization_memberships as uyelik on uyelik.id = notu.author_membership_id
  left join public.profiles as profil on profil.id = uyelik.user_id
  where notu.student_id = p_student_id
    and notu.archived_at is null
  order by notu.occurred_on desc, notu.created_at desc
  limit 200;
end;
$$;

comment on function public.student_followup_notes_list(uuid) is
  'Takip notları, yazar adıyla (öğretmen başka üyenin profilini okuyamadığı için security definer). Kapsam student_followup_notes_select_staff ile aynı: yönetici dalları ya da okutan öğretmen; kapsam dışı boş döner. En yeni 200 arşivsiz not. can_edit yalnız kullanıcı deneyimi.';

revoke all on function public.student_followup_notes_list(uuid) from public, anon;
grant execute on function public.student_followup_notes_list(uuid) to authenticated;
