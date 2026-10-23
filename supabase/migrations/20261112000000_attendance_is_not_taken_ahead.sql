-- İleri tarihe yoklama oturumu açılamaz (2026-10-23, ana plan 1.6).
--
-- Test turu B5: API bugün+7'ye yoklama oturumu açabiliyordu. Ekran tarih
-- seçicisini bugünle sınırlıyor (`max={today}`) ama kural veritabanında
-- yoktu; yanlışlıkla açılan gelecek oturum "yoklama alınmış" görünebilir ve
-- devam yüzdelerine girer. Bugün kurumun takvim günüdür (`orbit_today()`,
-- Türkiye saati) — sunucunun UTC günü değil.
--
-- Canlıda önce ölçüldü (salt okuma): ileri tarihli oturum 0.

create function public.enforce_attendance_session_not_in_future()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.session_date > public.orbit_today() then
    raise exception 'Gelecek bir tarihe yoklama açılamaz; bugün ya da geçmiş bir gün seçin.'
      using errcode = '22023',
            detail = format('session_date=%s bugün=%s', new.session_date, public.orbit_today());
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_attendance_session_not_in_future()
  from public, anon, authenticated;

create trigger attendance_sessions_not_in_future
  before insert or update of session_date on public.attendance_sessions
  for each row execute function public.enforce_attendance_session_not_in_future();
