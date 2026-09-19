# allowlist-lookup

当 Agent 需要确认某个目标路径是否可写时，按以下步骤在会话中复现 hook 的判定：

1. **定位 allowlist 文件**：

   ```text
   <Agent 启动目录>/.pi/write-allowlist.json
   ```

   Agent 启动目录一般是 `apps/<agent-id>`，例如 `apps/agent-java8-vue3`。

2. **文件存在性**：

   - 存在 → 继续；
   - 不存在 → 视为“无可写根”，所有写操作必须停手。

3. **读取字段**：

   ```json
   {
     "roots": ["<绝对路径>", ...],
     "confirmRoots": ["<绝对路径>", ...]
   }
   ```

   - `roots` = 永久允许写入；不需任何运行时授权，长期生效。
   - `confirmRoots` = 临时写入；每次必须由用户当场授权一次，TUI 走“选择 + ALLOW”流程，headless / SDK 模式因用户不在场直接拒绝。
   - Agent 自己的 `PM/` 子目录同样视为永久允许，与上述字段无关。
   - 其他路径一律越权，不允许任何写盘。

4. **路径判定**（三种状态）：

   - **永久允许**：目标路径落在 `roots` 任意根内，或落在 Agent 自己的 `PM/` 子目录内；直接允许写入，不需要用户授权。
   - **临时写入**：目标路径落在 `confirmRoots` 任意根内；只有用户当场授权后才能写一次，TUI 选择 + `ALLOW`，headless 模式直接拒绝。
   - **越权**：目标路径既不在 `roots` 也不在 `confirmRoots` 也不在 `PM/`；一律拒绝；Agent 不得“换个工具重试”。

5. **如果需要新增永久允许目录**：

   - 不得直接修改 `apps/<agent>/.pi/write-allowlist.json`；
   - 由用户修改 `workgroup.yaml` 中对应 Agent 的 `permissions.writeDirectories`；
   - hook 在下次 `tool_call` 时会自动重新解析 workgroup.yaml 并重写 allowlist，之后才能看到新的根。

6. **如果需要新增临时写入目录**：

   - 由用户修改 `permissions.temporaryWriteDirectories`；
   - hook 重新生成 allowlist 后，该目录下每次写盘都会弹出授权；不得因为“麻烦”而要求改为永久允许。

7. **allowlist 状态只能由 hook 维护**：

   - Agent 不得创建、重写、删除或重命名 `apps/<agent>/.pi/write-allowlist.json`；
   - Agent 不得手工合并、patch 上述 json；
   - Agent 不得通过 hook 等下文件的 mtime/size 来推断 allowlist 是否过期。

8. **hook 未挂载的 Agent**：

   - 上述规则仍然适用，但 allowlist 不会被自动生成；
   - Agent 必须以 `workgroup.yaml` 的 `permissions` 作为唯一真相，手工计算每个目标路径落点；
   - 拒绝后同样不得重试，只能要求用户调整 yaml。

## 与脚本同步

- 启动器 (`packages/script/launch-workgroup.mjs`) 不会直接生成 allowlist；
- 当前生成逻辑在 hook (`packages/agent-script/write-allowlist.ts`) 内部基于 `workgroup.yaml` 同步；
- 因此只要 hook 启动并读到正确的 `workgroup.yaml`，allowlist 会自动更新；
- 如果发现 hook 未挂载或 allowlist 与 workgroup 不一致，先解决 hook 装载问题，不要手工同步 allowlist。