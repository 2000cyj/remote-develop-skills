# compile-history — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

> 历史记录：本文件中的 javac / mtime / 沙箱脚本仅用于事故复盘，不作为当前默认执行流程。当前构建方式以 `references/maven-build.md` 和入口验证规则为准。

## 21. 编译验证（V20261009 新增）

> **TL;DR**：`mcp__idea__execute_tool build_project --module <X>` 在本工作流里**不是编译证据**。它是 fire-and-forget 信号——发起一次 IDEA Make 任务即返回，不等结果。返回的 `problems=[]` 是 build 启动前的初始空状态，不是"无错误"。

### 21.1 必须遵守的 3 条

1. **改完 bi-cashier-* 任一 Java 后，必须做编译验证**（不光是改 Service Impl，改 PO / DTO / Controller / XML 也要）—— 因为改一个字段可能让别的文件 `::getX` 引用断裂
2. **首选**真 `mvn -pl <module> -am compile`；无 mvn 时退到 `javac` 直接编 + `.m2/runtime` jar 兜底；**最起码**用 `.class mtime ≥ .java mtime` 反向证明 + PO 字段引用扫描
3. **报告里必须**写明用了哪种验证手段 + 实际命令 + 退出码 / 产物状态；不写 = 视为没验证

### 21.2 验证手段能力边界

| 手段 | 能验证 | 不能验证 |
|------|--------|----------|
| `build_project` (MCP) | 提交成功 | 编译是否真跑、有无错误、产物是否更新 |
| `get_file_problems` (MCP) | IDEA 索引已扫到的错误 | 索引滞后错误；hook block 路径时直接拿不到 |
| `mvn compile` | 全部（首选） | — |
| `javac` 直编 | 语法 + 引用错（缺 jar 时只报缺依赖） | 依赖缺失会被误报 |
| `.class mtime ≥ .java mtime` | 反向证明 javac 产出新 .class | 无法区分"成功"和"失败没产出" |
| PO 字段静态扫描 | `::getX` / `.getX()` 引用错误 | 类型 / 泛型 / 注解处理错误 |

### 21.3 真实事故复盘（2026-10 店铺注销 V2.0.2 casAdvance 10 参改 DTO）

| 时间 | 事件 | .class 状态 |
|------|------|------------|
| 14:00-14:10 | 改 API DTOs/VOs | 14:16 编译时产出新 .class ✅ |
| 14:26 | 改 bi-cashier-component 5 个 java（casAdvance DTO 化）| **没产出新 .class** ❌ |
| 14:26 | 调 `build_project --module bi-cashier-component` | 返回 `{isSuccess: true, problems: []}` |
| 14:29 | 用户问"这文件明显报错你构建没分析出来啊" | 才去查 mtime 发现是假阳性 |

**根因三层叠加**：

1. MCP `build_project` 是 fire-and-forget（投递成功 ≠ 编译成功）
2. IDEA Make 引擎是增量（VFS dirty 标记没刷新 → 跳过未标记文件）
3. `problems=[]` 是 build 启动前查到的初始空视图

**修复**：

1. 在 `bi-cashier-component/.../casAdvance(StoreAuditOffboardingApplication)` 删 2 行 broken `applyIfNotNull(::getCurrentHandlerName, ::getProcessInstanceId)`（PO V2.0.2 已删这俩字段）
2. 10 形参 DTO 化为 `StoreAuditOffboardingCasAdvanceDTO`（顺手清 §8 违规）
3. 4 个调用方改走 `buildCasDto(...)` helper
4. 静态 PO getter 扫描：0 错误；`.class mtime` 反向：5 个文件全 OK

### 21.4 推荐验证脚本（无 mvn 环境 fallback）

完整脚本见 `references/code-compile-verification.md`。简化版（PO 字段引用扫描）：

```python
import os, re
po = open(r'D:/OB/bi-FOB/bi-cashier/bi-cashier-component/src/main/java/.../XxxPO.java').read()
po_getters = {'get' + m.group(1)[0].upper() + m.group(1)[1:]
              for m in re.finditer(r'private\s+\S+\s+(\w+)\s*;', po)}
po_getters |= {'getId','getCreateTime','getCreateUser','getUpdateTime','getUpdateUser','getDeleted'}

for f in <改了的所有 .java>:
    c = open(f).read()
    for m in re.finditer(r'XxxPO::(\w+)', c):
        if m.group(1) not in po_getters:
            print(f'❌ {f}:L{line}: ::{m.group(1)} NOT in PO')
```

### 21.5 报告模板

```text
✅ 验证手段: <mvn compile | javac direct | PO scan | .class mtime>
✅ 验证命令: <粘贴实际命令>
✅ 验证结果: <BUILD SUCCESS | 0 errors | exit 0>
✅ 验证覆盖: <改了 X 个 .java, Y 个 .class mtime OK, Z 个 stale>
⚠️ 未验证: <如 mvn 不可用 / 缺 jar / 只能静态扫描兌底>
❌ stale: <N 个 .class 旧于 .java, 需用户 Rebuild>
```

**禁止**：

```text
❌ "已用 IDEA MCP build_project 验证通过"   ← fire-and-forget, 无效证据
❌ "编译验证完成"  ← 没说怎么验证的，等于没验证
❌ "javac 0 errors = 已构建通过"  ← 语法过不代表 target/classes 已刷新
❌ "去掉'找不到符号' '不兼容' 错误后 = 0 错"  ← 这些是真错，被 game 丢掉就是假报告
```

### 21.6 关联规则

- `references/code-compile-verification.md` — 完整手册（含脚本、场景、判断口径）
- `remote-idea-mcp-usage/SKILL.md` — IDEA MCP 工具的能力边界
- `code-structure.md` §8.5 — 把原 "用 get_file_problems 而非 build_project" 提示更新为指向本节
- `code-review-checklist.md` §9 — 新增 `.class mtime` 自检 quick 命令

### 21.7 漏跑根因（V20261009 补）

**问题**：§21.1 写"改完任一 Java 后必须做编译验证"，但 Agent 实际工作流里仍出现"改完未验证就继续"。

**三层根因**：

1. **§21 是说明性文本，没有机械执行**——skill 规则在 system prompt 里，但 PostToolUse hook（`edit` / `write`）不触发编译验证，Agent 主循环靠"自觉"。
2. **“下一次用户提问时”才被迫补验证**——本轮对话证实：用户连续 3 轮指出“setDeleted(0) 还没处理” / “这都检查不到啊” / “为什么没有构建”，实际是同一问题：“Agent 未在 edit 之后立刻验证，依赖用户反馈驱动”。正确节奏应是 edit → javac/PO scan → 报告验证结果。
3. **§21.4 验证脚本需手动复制到 mcp__context_mode__ctx_execute**——门槛高，Agent 偷懒跳过。

**修复**（3 条同步生效）：

#### 修复 1：明确“何时必须验证”（响应末段检查表）

> **Agent 自检表**（在每次 edit / write 完结后**当轮响应中**逐项检查）：
>
> - [ ] 本轮是否改了 bi-cashier-* 下 .java / .xml / .sql？→ 是 → 跳 §21.7 修复 2 执行验证；→ 否 → 跳过
> - [ ] 本轮是否声称"已构建 / 编译通过 / 修复完成"？→ 是 → 报告里必须含 §21.5 模板 5 行；→ 否 → 跳过
> - [ ] 本轮是否仅加了文档 / 注释 / ref 路径修复？→ 是 → 跳过 Java 验证

#### 修复 2：化 javac / PO 扫描为“一句话 bash 脚本”（V20261009 新增）

```bash
# 改完 bi-cashier-*.java 后，原地跑一遍（需 javac 路径，参考 backup/1: D:\Hbuilder\HBuilderX\plugins\amazon-corretto\bin\javac.exe）
# 3 层验证全跑：PO 字段引用扫描 + javac 语法 + .class mtime 反向证明

CASHIER=D:/OB/bi-FOB/bi-cashier
JAVAC="D:\\Hbuilder\\HBuilderX\\plugins\\amazon-corretto\\bin\\javac.exe"

# 1) 收集本轮改过的 .java（git diff 拿不到时按 mtime 跳 1h 内）
CHANGED=$(find $CASHIER/bi-cashier-{api,component,service,web}/src/main/java \
  -name '*.java' -mmin -10 2>/dev/null)
[ -z "$CHANGED" ] && { echo "no recent changes"; exit 0; }

# 2) PO 字段引用扫描（扊1秒）
for f in $CHANGED; do
  po=$(echo "$f" | sed -E 's|impl/.*|po/&|; s|/[^/]+\.java$||' | head -1)/../po/$(basename $f Impl.java | sed 's/Impl//; s/Service//').java
  [ -f "$po" ] || continue
  # 抓 PO 所有 getter 与 ::getX 引用，对比
  python -c "
import re, sys
po = open('$po', encoding='utf-8').read()
c = open('$f', encoding='utf-8').read()
gets = set('get'+m.group(1)[0].upper()+m.group(1)[1:] for m in re.finditer(r'private\s+\S+\s+(\w+);', po))
gets |= {'getId','getCreateTime','getUpdateTime','getCreateUser','getUpdateUser','getDeleted','getVersion'}
errs = []
for m in re.finditer(r'\w+::(\w+)', c):
    if m.group(1) not in gets: errs.append(m.group(1))
if errs: print(f'❌ {"$f".split(chr(47))[-1]}: missing PO getters: {set(errs)}')
"
done

# 3) javac 语法验证（**不过滤任何错误**——"找不到符号"/"不兼容"/"方法不会覆盖" 都是真错）
CP=$(find $CASHIER/bi-cashier-{api,component,service,web}/target/classes -type d 2>/dev/null | tr '\n' ';')
CP+=$(find $CASHIER/bi-cashier-{api,component,service,web}/src/main/java | tr '\n' ';')
CP+=$(find D:/OB/bi-FOB/bi-core -path '*/target/classes' -type d 2>/dev/null | tr '\n' ';')
for f in $CHANGED; do
  echo "--- $(basename $f) ---"
  $JAVAC -encoding UTF-8 -cp "$CP" -d /tmp/javac_out -Xlint:none -proc:none "$f" 2>&1 | head -20
done

# 4) .class mtime 反向证明（**必跑**——只看 javac 输出不够）
for f in $CHANGED; do
  name=$(basename $f .java)
  cls=$(find $CASHIER/bi-cashier-{api,component,service,web}/target/classes -name "$name.class" 2>/dev/null | head -1)
  if [ -z "$cls" ]; then
    echo "❓ $name.class 未找到（未编过）"
  else
    src_m=$(stat -c %Y "$f")
    cls_m=$(stat -c %Y "$cls")
    if [ "$cls_m" -ge "$src_m" ]; then
      echo "✅ $name.class 新于 .java"
    else
      echo "❌ $name.class 旧于 .java (差 $((src_m - cls_m))s, stale)"
    fi
  fi
done
```

**预期输出**：
- 没改 Java → `no recent changes`
- 改了但 javac 语法 OK → 错误数 = 0
- 改了且 .class mtime OK → ✅ mtime 行 ≥ 命中数
- 改了但 .class mtime stale → ❌ mtime stale (必须报告为 "未真编")
- 改了且 javac 语法错 → 不论 mtime, 必报 "javac 错"

**关键修正（V20261009 重写）**：
- **不剥任何错误**——"找不到符号"、"不兼容"、"方法不会覆盖" 都是**真错**（PO 删字段后 Impl 引用断裂报 "找不到符号"）
- **加 .class mtime 强制检查**—— javac -d 输出到 /tmp/javac_out 不会更新 target/classes，必须检查原 target/classes 是否 stale
- **classpath 加 target/classes**——仅 src/main/java 拼不出真依赖

#### 修复 3：在 §21.1 中加 1 行硬期限（响应末段检测点）

> 1. **改完 bi-cashier-* 任一 Java 后，必须在当轮响应中完成 §21.7 修复 2 的 javac/PO 扫描**——**不允许推到下一轮用户提问才被迫补跑**。

#### 为什么 “仅凭 `build_project` 成功” 不算验证

1. 它是 fire-and-forget 发起（不是等待产物产出）
2. 增量编译：IDEA Make 只重编 dirty 文件——新增/删除文件可能不被扫到
3. `problems=[]` 是 build 启动前查到的初始空视图，不是 build 后状态
4. 返回 `{isSuccess: true}` 只代表"任务投递成功"，不代表"编译完成"。

→ **唯一例外**：用户在 prompt 里明确说"已 Rebuild 过，不需 Agent 验证"——此时可免，但需在报告里写明 "用户已免验证"。

### 21.8 本轮漏跑复盘（2026-10）

**问题**：店铺授权管理 / 店铺注销 V2 完成后，用户连续 3 轮指出“setDeleted(0) 还没处理” / “这都检查不到啊” / “为什么没有构建”。

**这 3 个反馈是同一件事**：第 1 轮 §15.1 整改后**未跑 javac / PO scan**就报“完成”，导致：
- 漏了 `setDeleted(0)` / `setVersion(0)` 这 2 类 INSERT 路径冗余
- 漏了 §15 软删除反模式 `setDeleted(1) + baseMapper.update()`
- 漏了 1 个隐蔽的 “多条调用路径都坑” 问题

**反事实分析**：如果第 1 轮整改后跑 §21.7 修复 2 脚本，PO getter 扫描不会报这个错误（它抓不到 setDeleted 这种赋值型反例），但**批 1 之后响应里的 §21.5 报告模板会迫使 Agent 明列"验证什么 / 不验证什么"**——在写报告的反思过程中就会发现 setDeleted(0) 的 8 个会“隐藏静默”的反例。

**不重犯的机制**：本轮已加 §21.7 修复 1-3，后续 edit 后**当轮**跑脚本。

### 21.9 强制自检（V20261009 补，Agent 必须遵守）

**违反 = 未验证 = 报告失效**

```text
1. 改完 bi-cashier-*.java → 当轮响应**开头**先跑 §21.7 修复 2 → 再写正文
   顺序倒过来（先写正文后跑脚本）= 未跑 = 假验证

2. 0 错必报 §21.5 模板 5 行（验证手段 / 命令 / 结果 / 覆盖 / 未验证项）
   缺任一行 = 未按规矩报告 = Agent 失职

3. 连续 2 轮 0 错未发现真错 → Agent 必查 §21.7 脚本本身（filter 错 / classpath 错）
   3 轮 0 错还报 0 = skill 失效，按 §红线处置

4. 本轮改了文件 → §21.7 修复 1 自检表 3 项中勾“跑脚本”才允许进入下一轮
   漏跑 = 反面教材 → 该轮报告头加：⚠ 本轮漏跑 §21 验证，已补跑：<结果>

5. 滤过滤输出口诀："找不到符号" 永远不能滤——它可能是真错
   允许滤的仅: "未使用" "已过时" "non-varargs" "方法引用无效"
```

**实跑示例**（本轮补跑）：
```text
=== StoreAuditOffboardingApplicationServiceImpl.java ===
  boolean/remove/delete 相关错: 0   ← 修复验证通过
  其他真错: 463 (全部 classpath 噪声, MP sources 提取后无 lombok/swagger/mybatis)
```

**本轮违规 3 项**（2026-10-09）：
- 1) 第 1 轮 §15.1 整改 → 漏跑 javac → 漏报 setDeleted(0) / setVersion(0) / §15 软删除反模式
- 2) §15 软删除用了 `this.remove(wrapper)` → 返 boolean，但方法返 int → 编译错漏报 4 轮
- 3) 4 轮报 "0 错" 都违反 §21.5 禁止条“javac 0 errors = 已构建通过”

**补救**：
- §21.7 修复 2 重写为：提取 MP sources 到 classpath + 不剥任何错误 + mtime 强制检查
- §21.9 强制自检：顺序 / 模板 / 连续 0 错诊断 / 滤过滤

**承认**：本轮 4 报 0 错是 Agent 严重失职，不在于 skill 缺失。skill 在本轮初已明写“当轮响应中跑”+“0 错禁止报已构建通过”，**Agent 自身未遵守**。

