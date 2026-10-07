#!/usr/bin/env bash
# Şifreli gece yedeğini BOŞ bir veritabanına geri yükler (2026-10-07).
# Tarif ve ne zaman kullanılacağı: ops/yedek/README.md.
#
#   HEDEF_DB_URL='postgresql://…' bash ops/yedek/geri-yukle.sh \
#     orbit-yedek-YYYYMMDD-HHMM.tar.gz.gpg  ORBIT-yedek-GIZLI-anahtar.asc
#
# Ön koşul: hedefte göçler uygulanmış olmalı (yapı göçlerden gelir, veri
# yedekten). Sebep README'de: yedeğin şema dosyası kullanıcı hesabı
# tablolarındaki üç tetikleyiciyi taşımıyor; yalnız ondan kurulan sistem
# yeni kullanıcıya profil açmaz. Prova 2026-10-07'de bunu gösterdi.
#
# Hedefteki uygulama tabloları (public) BOŞALTILIR. Bu yüzden betik, hedefte
# zaten kurum varsa durur; üzerine yazmak için GERI_YUKLE_UZERINE_YAZ=evet.
set -euo pipefail

yedek="${1:?Kullanım: geri-yukle.sh <yedek.tar.gz.gpg> <gizli-anahtar.asc>}"
anahtar="${2:?Kullanım: geri-yukle.sh <yedek.tar.gz.gpg> <gizli-anahtar.asc>}"
: "${HEDEF_DB_URL:?HEDEF_DB_URL tanımlı değil}"

# psql yoksa (Windows'ta Git Bash) Docker'daki psql kullanılır.
psql_calistir() {
  if command -v psql >/dev/null 2>&1; then
    psql "$HEDEF_DB_URL" "$@"
  else
    # Git Bash'te /tmp yolu Docker'a Windows biçiminde verilmeli.
    kaynak="$calisma"
    command -v cygpath >/dev/null 2>&1 && kaynak="$(cygpath -w "$calisma")"
    MSYS_NO_PATHCONV=1 docker run --rm -i --network host \
      -v "$kaynak:/yedek:ro" postgres:17-alpine psql "$HEDEF_DB_URL" "$@"
  fi
}

calisma="$(mktemp -d)"
gnupg="$(mktemp -d)"
trap 'rm -rf "$calisma" "$gnupg"' EXIT
chmod 700 "$gnupg"

echo "1/5 Şifre açılıyor"
GNUPGHOME="$gnupg" gpg --batch --quiet --import "$anahtar"
GNUPGHOME="$gnupg" gpg --batch --quiet --decrypt "$yedek" | tar -xzf - -C "$calisma"

echo "2/5 Bütünlük denetleniyor"
( cd "$calisma" && sha256sum -c --quiet SHA256SUMS )

echo "3/5 Hedef denetleniyor"
kurum=$(psql_calistir -tAc "select count(*) from public.organizations" 2>/dev/null || echo "yok")
if [ "$kurum" = "yok" ]; then
  echo "DUR: hedefte public.organizations yok. Önce göçleri uygulayın (README, 3. adım)." >&2
  exit 1
fi
if [ "$kurum" != "0" ] && [ "${GERI_YUKLE_UZERINE_YAZ:-}" != "evet" ]; then
  echo "DUR: hedefte $kurum kurum var. Üzerine yazmak için GERI_YUKLE_UZERINE_YAZ=evet." >&2
  exit 1
fi

echo "4/5 Veri yükleniyor (tek işlem: ya hepsi ya hiçbiri)"
tablolar=$(grep -o '^COPY "public"\."[a-z_]*"' "$calisma/data.sql" | sed 's/^COPY //' | paste -sd, -)
printf 'truncate %s cascade;\n' "$tablolar" > "$calisma/bosalt.sql"
if command -v psql >/dev/null 2>&1; then
  dizin="$calisma"
else
  dizin="/yedek"
fi
psql_calistir --single-transaction -v ON_ERROR_STOP=1 -q \
  -f "$dizin/bosalt.sql" \
  -c 'SET session_replication_role = replica' \
  -f "$dizin/data.sql" >/dev/null

echo "5/5 Sayım"
psql_calistir -tAc "select 'kullanıcı ' || (select count(*) from auth.users) || ' · kurum ' || (select count(*) from public.organizations) || ' · öğrenci ' || (select count(*) from public.students) || ' · veli ' || (select count(*) from public.guardians)"
echo "Tamam. README'deki 'Geri yüklemeden sonra' adımlarına geçin."
