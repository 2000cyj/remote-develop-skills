#!/usr/bin/env bash
# skill 自检：编号冲突 / 入口文件膨胀 / 审查主文件残留命令 / 断链
# 用法：bash scripts/check-duplication.sh [skill 目录]
set -uo pipefail

DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fail=0

echo "== 1. 编号冲突 =="
dup=$(cd "$DIR/references" && ls *.md 2>/dev/null | sed -E 's/^([0-9]+)-.*/\1/' | sort | uniq -d)
if [ -n "$dup" ]; then
  echo "FAIL 编号冲突：$(echo "$dup" | tr '\n' ' ')"
  fail=1
else
  echo "OK   无编号冲突"
fi

echo
echo "== 2. 入口文件不得膨胀（SKILL.md / 07 只放链接） =="
for f in SKILL.md references/07-quick-reference.md; do
  n=$(wc -l < "$DIR/$f" | tr -d ' ')
  if [ "$n" -gt 80 ]; then
    echo "FAIL $f 有 $n 行（>80）—— 入口文件只放路由与链接，规范正文写在 02"
    fail=1
  else
    echo "OK   $f $n 行"
  fi
done

echo
echo "== 3. 审查主文件不得含扫描命令 =="
g=$(grep -c 'grep ' "$DIR/references/02-audit-page-compliance.md" | head -1)
if [ "${g:-0}" -gt 0 ]; then
  echo "FAIL 02 里还有 $g 处 grep —— 执行器不是规范，命令只匹配写法必然漏检"
  fail=1
else
  echo "OK   02 无 grep"
fi

echo
echo "== 4. 断链检查 =="
broken=0
for f in $(cd "$DIR" && grep -rhoE 'references/[0-9]{2}-[a-z0-9-]+\.md' --include=*.md . | sort -u); do
  if [ ! -f "$DIR/$f" ]; then echo "FAIL 断链：$f"; broken=1; fail=1; fi
done
[ "$broken" -eq 0 ] && echo "OK   无断链"

echo
[ "$fail" -eq 0 ] && echo "全部通过" || echo "有 FAIL 项，先修再 commit"
exit "$fail"
