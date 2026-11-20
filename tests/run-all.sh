#!/usr/bin/env bash
# 在瀏覽器裡跑全部測試，每組最後一行會是 ALL PASSED 或 N FAILED。
# 需要 Node 和 Playwright（Claude Code 雲端環境已經裝好）。
cd "$(dirname "$0")"
fail=0
for t in [0-9][0-9]-*.js; do
  out=$(node "$t" 2>&1)
  last=$(printf '%s\n' "$out" | tail -1)
  printf '%-26s %s\n' "$t" "$last"
  printf '%s\n' "$out" | grep '^FAIL' || true
  [ "$last" = "ALL PASSED" ] || fail=1
done
exit $fail
