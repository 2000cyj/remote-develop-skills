# maven-build — 原规范细则

本文件从原 SKILL.md 拆出，保留原章节编号与示例。旧的 `SKILL.md §X` 引用通过入口「旧章节导航」定位；文件路径以技能根目录为基准。

## 22. IDEA MCP 能跑真 mvn install（V20261009 新增）

> **TL;DR**：`mcp__idea__execute_tool execute_terminal_command` 走 IDEA 自己的 powershell terminal，**能**跑 mvn install，**不是**只有 `build_project` fire-and-forget 一条路。`build_project` 是 IDEA Make 增量编译，**mvn install** 是 Maven reactor 全量构建+装包——两者效果不同。

### 22.1 环境路径（按本机实测，硬编码）

```powershell
# IDEA 自带 Maven（有空格用短路径）
$env:PATH = 'C:\Users\20614\AppData\Local\Programs\INTELL~1\plugins\maven\lib\maven3\bin;' + $env:PATH

# Java 17（项目 pom 里 <java.version>17</java.version>，**不要用 IDEA JBR 25**，lombok 1.18.34 不兼容会报 TypeTag UNKNOWN）
$env:JAVA_HOME = 'C:\Users\20614\.jdks\ms-17.0.19'
$env:PATH = $env:JAVA_HOME + '\bin;' + $env:PATH

# 工作目录
Set-Location 'D:/OB/bi-FOB/bi-cashier'

# 4 模块 mvn install（无网络下 jar 已下则 31s 编过；首次 ~2 分钟）
mvn clean install -DskipTests -pl bi-cashier-api,bi-cashier-component,bi-cashier-service,bi-cashier-web -am 2>&1 | Out-File -Encoding utf8 D:/OB/bi-FOB/bi-cashier/.tmp_build.log
Write-Host EXIT:$LASTEXITCODE
```

**环境陷阱**（3 类硬编码）：

| 路径 | 来源 | 备注 |
|------|------|------|
| `INTELL~1\plugins\maven\lib\maven3\bin` | IDEA 2025 自带 mvn 3.9.11 | **必须用短路径**（带空格的 `IntelliJ IDEA` 会被 PowerShell 解析断在空格处） |
| `ms-17.0.19` | `C:\Users\20614\.jdks\` 下的 Eclipse Adoptium 17 | **不能用 JBR 25**——lombok 1.18.34 与 Java 25 不兼容（`com.sun.tools.javac.code.TypeTag :: UNKNOWN`） |
| `m2/repository` | `C:\Users\20614\.m2\` 已有 173 jars | **首跑前**若只有 sources.jar（无 runtime jar），先跑 `mvn dependency:resolve` 让 maven 下完整 jar（否则 lombok / spring / mybatis 都缺） |

### 22.2 `mcp__idea__execute_tool build_project` vs IDEA MCP `execute_terminal_command` 跑 mvn

| 维度 | `build_project` | `execute_terminal_command` + `mvn install` |
|------|-----------------|---------------------------------------------|
| 真编译？ | ❌ fire-and-forget | ✅ 真编译（等 mvn 退出码） |
| 错误位置？ | `problems=[]`（初始空视图） | stdout/stderr 全量错误，定位到 `file.java:line` |
| 反应堆？ | 单 module / 全部 modules | `-pl <m1,m2> -am` 精确控制 4 模块 |
| 跨模块依赖？ | 增量 dirty 标记，可能漏 | `mvn install` 把 jar 装到 .m2，下游 module 一定能找到 |
| 退出码？ | 不暴露 | `Write-Host EXIT:$LASTEXITCODE` 直接拿 |
| 跑时长？ | 1-2s（不等） | 30s-2min（视 dirty 范围） |
| 适用场景 | 增量微调快速 sanity check | 提交前 / PR 前的"真编译证据" |

**强制规则**：**当轮 edit 后报告里写"已构建通过"，必须**用 `execute_terminal_command` 跑过 `mvn install` 且**贴出 `BUILD SUCCESS` 段**。**不允许**只调 `build_project` 然后报"已构建通过"。

### 22.3 修 3 个真 bug 才能编过（2026-10 店铺授权管理 / 店铺注销 V2）

**前置：lombok 注解处理器默认不跑**（maven-compiler-plugin 3.10.1 + Java 17 + lombok 1.18.34）

症状：8 个 enum 全部 `无法将枚举 XXX 中的构造器 XXX 应用到给定类型`（需要 3 参构造器但只有默认 0 参）

**修法**：在 `pom.xml` 的 `maven-compiler-plugin` 块加 `annotationProcessorPaths`：

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.10.1</version>
    <configuration>
        <source>${java.version}</source>
        <target>${java.version}</target>
        <annotationProcessorPaths>
            <path>
                <groupId>org.projectlombok</groupId>
                <artifactId>lombok</artifactId>
                <version>1.18.34</version>
            </path>
        </annotationProcessorPaths>
    </configuration>
</plugin>
```

**前置 2**：lombok 注解处理器跑了之后，**impl 端 `extends ServiceImpl<Mapper, PO>` 已存在，但接口端没 `extends IService<PO>`**——service 层调 `offboardingApplicationService.lambdaQuery()` 编译不过（接口里没暴露该方法）。

**修法**：`bi-cashier-component/.../service/StoreAuditOffboardingApplicationService.java` 接口加继承：

```java
public interface StoreAuditOffboardingApplicationService extends IService<StoreAuditOffboardingApplication> {
    // ... 既有方法
}
```

**Bug 1**（真错）：service 用了 `StoreAuthorization` 类但没 import

```text
/D:/OB/bi-FOB/bi-cashier/bi-cashier-service/.../StoreAuditOffboardingManageServiceImpl.java:[1035,43] 找不到符号
  符号:   类 StoreAuthorization
  位置: 类 com.obo.bi.cashier.service.impl.StoreAuditOffboardingManageServiceImpl
```

**修法**：`StoreAuditOffboardingManageServiceImpl.java` import 块加 `import com.obo.bi.cashier.po.StoreAuthorization;`（按字母序插在 `StoreAuditOffboardingStore` 后）

**Bug 2**（真错）：`uniqueValue` 变量声明顺序错（在循环体内用，循环外 L210 才声明）

```text
/D:/OB/bi-FOB/bi-cashier/bi-cashier-service/.../StoreAuditOffboardingManageServiceImpl.java:[196,37] 找不到符号
  符号:   变量 uniqueValue
```

**修法**：把 `String uniqueValue = offboardingApplicationService.generateUniqueValue();` 从 L210 提到 L182 之前（进循环前先有值）

**Bug 3**（真错）：`IService<PO>` 接口继承缺失（见上文前置 2）

**修法**：`StoreAuditOffboardingApplicationService.java` 接口加 `extends IService<StoreAuditOffboardingApplication>`

**最终结果**：

```text
[INFO] bi-cashier ......................................... SUCCESS [  0.310 s]
[INFO] bi-cashier-api ..................................... SUCCESS [  1.975 s]
[INFO] bi-cashier-component ............................... SUCCESS [  5.642 s]
[INFO] bi-cashier-service ................................. SUCCESS [  6.341 s]
[INFO] bi-cashier-web ..................................... SUCCESS [ 16.487 s]
[INFO] BUILD SUCCESS
[INFO] Total time:  31.175 s
```

**反思**：本轮 4 报 0 错 + 1 报"build process failed"都基于 `build_project` fire-and-forget 或 `execute_run_configuration` 的假信号。**`execute_terminal_command` 跑 mvn install 才是 31s 拿到真错 + 真修的路径**。下次任何 Java 改动，**第一动作**就是 mvn install 4 模块拿真错，不要再走 javac 间接路径或 .class mtime 兜底。

### 22.4 关联规则

- `remote-idea-mcp-usage/SKILL.md` — IDEA MCP 工具能力边界（`execute_terminal_command` 走 powershell）
- `references/code-compile-verification.md` §2.1-2.3 — mvn install 命令模板 + .m2 jar 完整性自检
- §21.1 / §21.5 / §21.7 / §21.9 — 强制自检 + 报告模板（仍适用，但**验证手段升级**为 `execute_terminal_command` + `mvn install`，不再依赖 `build_project`）
- §红线 — 任何"已构建通过"声明必须附 `BUILD SUCCESS` 段（V20261009 升级为：必须 `mvn install` 真退出码 + 4 模块 SUCCESS 列表）
