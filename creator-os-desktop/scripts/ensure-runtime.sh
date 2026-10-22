#!/bin/sh
set -eu
app_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
case "$(uname -s)" in Darwin) platform=darwin;; Linux) platform=linux;; *) echo 'This launcher supports macOS and Linux.' >&2; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) arch=arm64;; x86_64|amd64) arch=x64;; *) echo 'A 64-bit Intel or Apple/ARM computer is required.' >&2; exit 1;; esac
runtime_dir="$app_root/runtime/$platform-$arch"
node_ok() { "$1" -e 'if(parseInt(process.versions.node)<22)process.exit(1)' >/dev/null 2>&1; }
if [ -x "$runtime_dir/bin/node" ] && node_ok "$runtime_dir/bin/node"; then printf '%s\n' "$runtime_dir/bin/node"; exit 0; fi
if [ "${CREATOR_SKIP_SYSTEM_NODE:-0}" != 1 ] && command -v node >/dev/null 2>&1 && node_ok "$(command -v node)"; then command -v node; exit 0; fi
command -v curl >/dev/null 2>&1 || { echo 'curl is required for the first download.' >&2; exit 1; }
mkdir -p "$app_root/runtime"
staging=$(mktemp -d "$app_root/runtime/.install-XXXXXX")
trap 'rm -rf "$staging"' EXIT
trap 'exit 130' HUP INT TERM
echo 'First launch: downloading the official Node.js 22 runtime. No global installation is needed.' >&2
curl --fail --location --retry 2 --connect-timeout 15 --max-time 120 --proto '=https' --tlsv1.2 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt' -o "$staging/checksums.txt"
record=$(awk -v suffix="-$platform-$arch.tar.gz" '$2 ~ /^node-v22\.[0-9]+\.[0-9]+-/ && substr($2,length($2)-length(suffix)+1)==suffix {print $1 " " $2;exit}' "$staging/checksums.txt")
expected=${record%% *}
filename=${record#* }
case "$expected" in ''|*[!a-fA-F0-9]*) echo 'Invalid official checksum manifest.' >&2; exit 1;; esac
[ "${#expected}" = 64 ] || { echo 'Invalid checksum length.' >&2; exit 1; }
case "$filename" in node-v22.*-"$platform"-"$arch".tar.gz) ;; *) echo 'No matching official Node.js download was found.' >&2; exit 1;; esac
version=${filename#node-}; version=${version%%-$platform-*}
curl --fail --location --retry 2 --connect-timeout 15 --max-time 600 --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$version/$filename" -o "$staging/runtime.tar.gz"
if command -v shasum >/dev/null 2>&1; then actual=$(shasum -a 256 "$staging/runtime.tar.gz" | awk '{print $1}'); else actual=$(sha256sum "$staging/runtime.tar.gz" | awk '{print $1}'); fi
[ "$actual" = "$expected" ] || { echo 'Download checksum mismatch. Nothing was installed; please retry.' >&2; exit 1; }
tar -xzf "$staging/runtime.tar.gz" -C "$staging"
extracted="$staging/${filename%.tar.gz}"
node_ok "$extracted/bin/node" || { echo 'Downloaded Node.js cannot run on this computer.' >&2; exit 1; }
[ ! -d "$runtime_dir" ] || rm -rf "$runtime_dir"
mv "$extracted" "$runtime_dir"
printf '%s\n' "$runtime_dir/bin/node"
