#!/bin/sh
app_root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
cd "$app_root" || exit 1
creator_node=$(sh "$app_root/scripts/ensure-runtime.sh")
if [ $? -ne 0 ]; then
  printf '\nStartup failed. Check your connection and folder permissions.\nPress Enter to close…'
  read answer
  exit 1
fi
"$creator_node" "$app_root/launcher.mjs"
code=$?
if [ "$code" -ne 0 ]; then printf '\nPress Enter to close…'; read answer; fi
exit "$code"
