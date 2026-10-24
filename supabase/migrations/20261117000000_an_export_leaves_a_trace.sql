-- Kurum verisinin dışa aktarılması denetim kaydına yazılır (2026-10-24, ana plan 2.4).
--
-- Dışa aktarma kişisel veriyi (öğrenci, veli telefonu, yoklama, not, ödeme)
-- sistemin dışına çıkarır. Okuma zaten RLS'le sınırlı (yönetici kendi
-- kurumunu görür); bu fonksiyon yetki VERMEZ, yalnız iz bırakır: kim, ne
-- zaman, hangi veri kümelerini, kaç satır. İstemci dosyayı bu kayıt
-- başarıyla yazılmadan indirmez (iz bırakmayan dışa aktarma yok).
--
-- Yalnız etkin yönetici çağırabilir; ilk giriş kilidi açıksa reddedilir.
-- Veri kümesi adları sabit bir listeden gelir; içerik yazılmaz.

create function public.record_data_export(
  target_organization_id uuid,
  datasets text[],
  row_counts jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  kayit_id bigint;
  bilinmeyen text;
begin
  if (select public.current_user_must_change_password())
     or not public.current_user_has_membership(
       target_organization_id, null, array['admin']::public.app_role[]
     ) then
    raise exception 'Kurum verisini yalnız kurum yöneticisi dışa aktarabilir.'
      using errcode = '42501';
  end if;

  if datasets is null or cardinality(datasets) = 0 then
    raise exception 'Dışa aktarılacak en az bir veri kümesi seçilmeli.'
      using errcode = '22023';
  end if;

  select ad into bilinmeyen
  from unnest(datasets) as ad
  where ad not in ('students', 'guardians', 'attendance', 'exam_results', 'payments')
  limit 1;
  if bilinmeyen is not null then
    raise exception 'Bilinmeyen veri kümesi: %', bilinmeyen using errcode = '22023';
  end if;

  if row_counts is null or jsonb_typeof(row_counts) <> 'object' then
    row_counts := '{}'::jsonb;
  end if;

  insert into public.audit_events (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  values (
    target_organization_id,
    (select auth.uid()),
    'organization.data_exported',
    'organization',
    target_organization_id,
    jsonb_build_object('datasets', to_jsonb(datasets), 'rows', row_counts)
  )
  returning id into kayit_id;

  return kayit_id;
end;
$$;

revoke all on function public.record_data_export(uuid, text[], jsonb) from public, anon;
grant execute on function public.record_data_export(uuid, text[], jsonb) to authenticated;

comment on function public.record_data_export(uuid, text[], jsonb) is
  'Kurum verisinin dışa aktarıldığını denetim kaydına yazar (organization.data_exported): kim, hangi veri kümeleri, kaç satır. Yetki vermez; yalnız etkin yönetici. İstemci kayıt yazılmadan dosyayı indirmez. 2026-10-24, ana plan 2.4.';
