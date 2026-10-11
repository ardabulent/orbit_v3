#!/usr/bin/env bash
#
# Issue #35 — Sentetik e-posta ile hesap oluşturma ve giriş kanıtı.
#
# `DECISION_LOG.md` — "Kimlik ve Giriş Bilgisi Mimarisi" kararının tamamı şu
# varsayıma dayanıyor: Supabase, teslim edilemez bir alan adına ait e-postayla
# (`<numara>@orbit.invalid`) kullanıcı oluşturmayı kabul eder ve bu kullanıcı
# e-posta/şifre ile giriş yapabilir.
#
# Varsayım yanlışsa mimari değişir: giriş için `service_role` yetkili bir Edge
# Function gerekir ve kullanıcı şifresi sunucu kodumuzdan geçmeye başlar. Bu,
# ADR'de bilinçli olarak reddedilen tasarımdır.
#
# Bu test SQL ile yapılamaz. `admin.createUser` bir GoTrue API çağrısıdır;
# `auth.users` tablosuna doğrudan INSERT yapmak GoTrue'nun doğrulamasını atlar
# ve hiçbir şey kanıtlamaz. Bu nedenle yerel Auth API'sine gerçek HTTP
# istekleri yapılır. Yerel GoTrue, production ile aynı kod tabanıdır.
#
# Tek seferlik bir kanıt değil, kalıcı bir regresyon testidir: Supabase bu
# davranışı ileride değiştirirse bunu bir müşteri değil CI bildirir.

set -uo pipefail

fail() {
  echo "HATA: $*" >&2
  exit 1
}

eval "$(supabase status -o env)" 2>/dev/null || fail "supabase status okunamadı"

: "${API_URL:?API_URL alınamadı}"
: "${ANON_KEY:?ANON_KEY alınamadı}"
: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY alınamadı}"

# Yerel config minimum 8 karakter ve küçük+büyük harf+rakam istiyor.
readonly PASSWORD="Orbit2026Test"

# 2026-10-11 (#448): test arkasını temizler ve Windows'ta (Git Bash) da koşar.
#   * Geçici dosyalar `mktemp` ile; JSON Node'a yol değil standart girdi olarak
#     verilir — Git Bash'in `/tmp`'si ile Node'un gördüğü `/tmp` farklıydı.
#   * Başta sabit adresli eski kullanıcı (yarıda kalmış koşu) silinir, sonda
#     açılan kullanıcı silinir; aksi halde sonraki koşu 422 `email_exists`
#     alıp yanlış teşhis koyuyordu.
#   * Profil kontrolü `psql` yerine REST'ten (service_role) yapılır.
GECICI="$(mktemp -d)"
user_id=""

kullanici_sil() {
  curl -s -o /dev/null -X DELETE "${API_URL}/auth/v1/admin/users/$1" \
    -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
}

temizle() {
  [ -n "$user_id" ] && kullanici_sil "$user_id"
  rm -rf "$GECICI"
}
trap temizle EXIT

eski_id=$(curl -s "${API_URL}/auth/v1/admin/users?per_page=1000" \
  -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" |
  node -e "
    const r = JSON.parse(require('fs').readFileSync(0, 'utf8') || '{}');
    const u = (r.users || []).find(x => x.email === process.argv[1]);
    process.stdout.write(u ? u.id : '');
  " "${SYNTHETIC_EMAIL}")
[ -n "$eski_id" ] && kullanici_sil "$eski_id"
readonly LOGIN_NUMBER="10421137"
readonly SYNTHETIC_EMAIL="${LOGIN_NUMBER}@orbit.invalid"

echo "API_URL: ${API_URL}"
echo "Sınanan adres: ${SYNTHETIC_EMAIL}"
echo

# --- 1) Sentetik adresle kullanıcı oluşturulabiliyor mu? ---------------------

create_response=$(curl -s -o "$GECICI/create_body" -w '%{http_code}' \
  -X POST "${API_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SYNTHETIC_EMAIL}\",\"password\":\"${PASSWORD}\",\"email_confirm\":true}")

if [ "$create_response" != "200" ] && [ "$create_response" != "201" ]; then
  echo "--- yanıt ---"
  cat "$GECICI/create_body"
  echo
  fail "sentetik adresle kullanıcı oluşturulamadı (HTTP ${create_response}).
Supabase teslim edilemez alan adlarını reddediyorsa ADR'deki kimlik mimarisi
geçersizdir ve giriş için Edge Function'lı tasarıma dönülmelidir."
fi

user_id=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).id||'')" < "$GECICI/create_body")
[ -n "$user_id" ] || fail "kullanıcı oluşturuldu ama id dönmedi"

echo "1/5 kullanıcı oluşturuldu (HTTP ${create_response}, id ${user_id})"

# --- 2) Bu kullanıcı e-posta/şifre ile giriş yapabiliyor mu? -----------------

signin_response=$(curl -s -o "$GECICI/signin_body" -w '%{http_code}' \
  -X POST "${API_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SYNTHETIC_EMAIL}\",\"password\":\"${PASSWORD}\"}")

if [ "$signin_response" != "200" ]; then
  echo "--- yanıt ---"
  cat "$GECICI/signin_body"
  echo
  fail "sentetik adresle giriş yapılamadı (HTTP ${signin_response})"
fi

access_token=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).access_token||'')" < "$GECICI/signin_body")
[ -n "$access_token" ] || fail "giriş başarılı görünüyor ama access_token dönmedi"

echo "2/5 giriş başarılı, geçerli oturum alındı"

# --- 3) Profil trigger'ı sentetik kullanıcı için de çalışıyor mu? ------------
#
# handle_new_auth_user, auth.users insert'inde profil satırı oluşturur.
# Sentetik adresli kullanıcı bu akışın dışında kalırsa kimlik çözümlemesi
# sessizce kırılırdı.

profile_count=$(curl -s "${API_URL}/rest/v1/profiles?id=eq.${user_id}&select=id" \
  -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" |
  node -e "const r = JSON.parse(require('fs').readFileSync(0, 'utf8') || '[]'); process.stdout.write(String(Array.isArray(r) ? r.length : 0))")

[ "$profile_count" = "1" ] ||
  fail "sentetik kullanıcı için profil oluşmadı (bulunan: ${profile_count:-yok})"

echo "3/5 profil kaydı oluştu"

# --- 4) Yanlış şifre reddediliyor mu? ---------------------------------------
#
# Kontrol testi: ilk üç adım, giriş her koşulda başarılı olsaydı da geçerdi.

wrong_response=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${API_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SYNTHETIC_EMAIL}\",\"password\":\"YanlisSifre123\"}")

[ "$wrong_response" = "400" ] ||
  fail "yanlış şifre reddedilmedi (HTTP ${wrong_response})"

echo "4/5 yanlış şifre reddedildi"

# --- 5) E-posta sağlayıcısı açıkken yeni kayıt kapalı mı? -------------------
#
# `[auth] enable_signup` ile `[auth.email] enable_signup` ayrı şeylerdir ve
# isimleri yanıltıcıdır. İkincisi sağlayıcının kendisini açar. Bu ayrımın
# karışması production'da e-posta girişini tamamen durdurmuştu (Issue #29).
# Bu adım, yerel yapılandırmanın doğru kombinasyonda olduğunu sabitler:
# sağlayıcı açık, yeni kayıt kapalı.

signup_response=$(curl -s -o "$GECICI/signup_body" -w '%{http_code}'   -X POST "${API_URL}/auth/v1/signup"   -H "apikey: ${ANON_KEY}"   -H "Content-Type: application/json"   -d '{"email":"yeni-kayit-kontrol@orbit.invalid","password":"Orbit2026Test"}')

if ! grep -q "signup_disabled" "$GECICI/signup_body"; then
  echo "--- yanıt ---"
  cat "$GECICI/signup_body"
  echo
  fail "yeni kayıt kapalı olmalıydı (HTTP ${signup_response}).
email_provider_disabled dönüyorsa sağlayıcı da kapalıdır ve 2. adım zaten
başarısız olurdu; başka bir kod dönüyorsa yeni kayıt açık kalmış demektir."
fi

echo "5/5 yeni kayıt kapalı, sağlayıcı açık"
echo
echo "Sentetik e-posta mimarisi doğrulandı."
