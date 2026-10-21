#!/bin/bash
# Double-click this file to run a local test copy of Rundown on this Mac.
# Rundown uses files from the website and the other apps (styles, icons), so this builds a small
# stand-in for www.davyrockett.com from the folders next to it, then serves that.
# Keep this window open while you use it; close it to stop.
cd "$(dirname "$0")/.."
APPS="$(pwd)"
ROOT="${TMPDIR:-/tmp}/rundown-preview"
PORT=8777
rm -rf "$ROOT" && mkdir -p "$ROOT"
for f in styles.css images apps gigs.json; do ln -s "$APPS/website/$f" "$ROOT/$f"; done
for d in "$APPS"/*/; do d="${d%/}"; n="$(basename "$d")"; [ -e "$ROOT/$n" ] || ln -s "$d" "$ROOT/$n"; done
FF="$HOME/Dropbox/Local/Guitar Method Book/first-frets"
[ -d "$FF" ] && ln -s "$FF" "$ROOT/first-frets"
if ! lsof -i :$PORT >/dev/null 2>&1; then
  (cd "$ROOT" && python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &)
  sleep 1
fi
open -a Safari "http://localhost:$PORT/rundown/"
echo "Rundown is running at http://localhost:$PORT/rundown/"
echo "Close this window when you're done."
wait
