#!/usr/bin/env bash
# Yedek anahtar çiftini üretir (2026-10-07). Kurum sahibi kendi bilgisayarında
# BİR KEZ çalıştırır; ajan çalıştırmaz (AGENTS.md kısıt 4: şifre ve gizli
# anahtar ajana yaptırılmaz).
#
#   bash ops/yedek/anahtar-uret.sh
#
# Üretilenler:
#   ops/yedek/yedek-acik-anahtar.asc   → AÇIK anahtar. Repoya girer; yalnız
#                                         kilitler, açamaz.
#   Masaüstü/ORBIT-yedek-GIZLI-anahtar.asc
#                                       → GİZLİ anahtar. Yedekleri açan tek
#                                         şey. Şifre yöneticisine taşınır,
#                                         masaüstünden silinir. Kaybolursa
#                                         yedekler açılamaz; başkasına
#                                         geçerse yedekler okunabilir.
#
# Anahtar geçici bir anahtarlıkta üretilir ve iş bitince o anahtarlık silinir;
# bilgisayarın kendi gpg anahtarlığına hiçbir şey eklenmez.
set -euo pipefail

kok="$(cd "$(dirname "$0")/../.." && pwd)"
acik="$kok/ops/yedek/yedek-acik-anahtar.asc"
gizli="$HOME/Desktop/ORBIT-yedek-GIZLI-anahtar.asc"

if [ -e "$gizli" ]; then
  echo "DUR: $gizli zaten var. Eski anahtarın üzerine yazılmaz; önce onu şifre yöneticisine taşıyıp silin." >&2
  exit 1
fi

gecici="$(mktemp -d)"
trap 'rm -rf "$gecici"' EXIT
export GNUPGHOME="$gecici"
chmod 700 "$gecici"

kimlik="ORBIT yedek $(date +%Y-%m-%d) <yedek@orbit.invalid>"
# future-default: ed25519 imza + cv25519 şifreleme alt anahtarı.
gpg --batch --quiet --passphrase '' --quick-gen-key "$kimlik" future-default default never

gpg --batch --armor --export "$kimlik" > "$acik"
( umask 077; gpg --batch --armor --pinentry-mode loopback --passphrase '' \
    --export-secret-keys "$kimlik" > "$gizli" )

parmak="$(gpg --batch --with-colons --fingerprint "$kimlik" | awk -F: '/^fpr/{print $10; exit}')"

echo
echo "Hazır."
echo "  Açık anahtar (repoya girecek): ops/yedek/yedek-acik-anahtar.asc"
echo "  GİZLİ anahtar:                 $gizli"
echo "  Parmak izi:                    $parmak"
echo
echo "Şimdi: gizli anahtar dosyasını şifre yöneticinize ekleyin, sonra masaüstünden silin."
