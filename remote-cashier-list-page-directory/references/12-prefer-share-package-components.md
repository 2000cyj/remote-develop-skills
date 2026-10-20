# 目标 12：优先复用 share 包，禁止重复造组件

share 包路径：`D:/OB/ob_web/packages/share`，包名 `@ob-web/share`。
参考仓库内位置：`packages/micro/<微应用>/src/pages/**`。

## 规则

**share 包是页面组件 / 组合式函数的第一来源。** 写任何 `.vue` / `.composable.ts` 之前，先确认 share 里没有等价物。

优先级（与「枚举三级」同一套思路，高优先级覆盖低优先级）：

| 级 | 来源 | 说明 |
|---|---|---|
| 1 | `@ob-web/share` 的 `components/` / `composables/` | 本文档下半部分的清单 |
| 2 | `@ob-common` 或微应用 `common/` | 跨微应用的公共层 |
| 3 | 本业务块 `components/` | **只有 1、2 都没有才允许写** |

**「本块 `components/`」是最后一级，不是第一级。** 新建组件前必须先走完 1 → 2 两级并留下「都没有」的证据。

## 怎么查（先查再写，不要凭印象）

```bash
# 1. 列出 share 全部公开组件 + 导出名（不猜，直接读 index.ts）
grep -rn "^export" D:/OB/ob_web/packages/share/components/*/index.ts

# 2. 列出 share 全部组合式函数
ls -1 D:/OB/ob_web/packages/share/composables/

# 3. 查本页现有 import，确认已经用了哪些
grep -rn "@ob-web/share" packages/micro/cashier/src/pages/<业务块>

# 4. 全文搜同功能实现（避免换个名字又造一遍）
grep -rn "<功能关键词>" packages/micro/cashier/src/pages/
```

**逐个 read `share/components/<组件>/index.ts` 确认导出名**，不要按目录名猜。名字不一致的已知例子：`DynamicForm/SearchForm`、`Business/Approval/*`、`Drawer` 导出的实际是 `renderDrawer` 而不是 `Drawer` 组件。

## 清单（2026-10-15 快照）

**清单会过期。** share 包加了新组件后，用上面的命令重新拉，不要照抄本表。
本表只给「导出名 + 源码路径」；props / slots / emits 一律用前 read 源码 `.vue`。

### 布局 / 表格 / 列表（页面骨架，列表页默认用这几个）

| 导出名 | 源码路径 |
|---|---|
| `ListPageLayout` | `components/Layout/ListPageLayout.vue` |
| `PageVxeTable` / `CommonVxeTable` / `BaseVxeTable` | `components/VxeTable/*.vue` |
| `useListPage` | `composables/useListPage.ts` |
| `usePagination` | `composables/usePagination.ts` |
| `useListViewControls` | `composables/useListViewControls.ts` |
| `useWatermark` / `useTitle` / `useFullscreenLoading` | `composables/use*.ts` |
| `Business/HistoryTable` | `components/Business/HistoryTable/` |

### 表单 / 输入

| 导出名 | 源码路径 |
|---|---|
| `DynamicForm` / `SearchForm` | `components/DynamicForm/` |
| `NumberRange` | `components/NumberRange/NumberRange.vue` |
| `ExpandTextarea` | `components/ExpandTextarea/ExpandTextarea.vue` |
| `RichText` | `components/RichText/RichText.vue` |
| `Upload` / `UploadCropper` | `components/Upload/` `components/UploadCropper/` |
| `Qrcode` / `renderQrcodeDialog` | `components/Qrcode/` |

### 弹层 / 反馈

| 导出名 | 源码路径 |
|---|---|
| `renderDialog` / `renderPreview` / `installRenderDialog` | `components/Dialog/index.ts` |
| `renderDrawer` / `installRenderDrawer` / `extendsDrawerApp` | `components/Drawer/index.ts` |
| `LoadingButton` | `components/LoadingButton/LoadingButton.vue` |
| `Notify` | `components/Notify/Notify.vue` |
| `ExportButton` / `ImportButton` | `components/ExportButton/` `components/ImportButton/` |
| `StatusTaps` | `components/StatusTaps/StatusTaps.vue` |
| `Descriptions` | `components/Descriptions/Descriptions.vue` |

### 预览 / 导航

| 导出名 | 源码路径 |
|---|---|
| `PdfPreview` / `DocxPreview` / `ExcelPreview` / `ImagePreview` / `VideoPreview` / `AllPreview` / `PreviewOverlay` | `components/Preview/components/` |
| `SearchMenu` | `components/SearchMenu/SearchMenu.vue` |
| `Screenfull` / `ThemeSwitch` | `components/Screenfull/` `components/ThemeSwitch/` |
| `ViewControls` | `components/ViewControls/ViewControls.vue` |

### 业务审批（cashier 微应用常用）

| 导出名 | 源码路径 |
|---|---|
| `FlowableDialog` / `FlowableOperationButton` / `ForwardTransferDialog` | `components/Business/Approval/*/` |

### 常量 / 工具（`@ob-web/share/utils/*`、`constants/*`）

`useEventBus` `useExpose` `useFetchData` `useFetchSelect` `useRouteListener` `useTheme`
`datetime` `format` `validate` `file` `downLoadFile` `dictionary` `router` `pushRouter`
`appKey` `cacheKey` `pagination` `publicEnum`

## 判定表

| 页面里出现 | 先查 share | 有 → | 无 → |
|---|---|---|---|
| 列表页骨架（搜索区 + 按钮区 + 表格 + 分页） | `ListPageLayout` + `PageVxeTable` + `useListPage` | 直接用 | 仍需自定义布局才写本块 |
| 搜索表单 / 详情表单 | `DynamicForm` / `SearchForm` | 直接用 | 字段结构特殊才写 |
| 金额 / 数量区间输入 | `NumberRange` | 直接用 | — |
| 提交按钮的 loading 防重 | `LoadingButton` | 直接用 | — |
| 状态标签页筛选 | `StatusTaps` | 直接用 | — |
| 详情键值展示 | `Descriptions` | 直接用 | — |
| 弹窗 / 抽屉 | `renderDialog` / `renderDrawer` | 直接用 | 需受控 DOM 场景才写 `.vue` 壳 |
| 导出 / 导入按钮 | `ExportButton` / `ImportButton` | 直接用 | — |
| 附件预览（pdf/图片/视频） | `Preview/*` | 直接用 | — |
| 文件上传 / 裁剪 | `Upload` / `UploadCropper` | 直接用 | — |
| 本块特有的业务控件 | 上面全查过 | — | 才写 `components/` |

## 违规标志

- 1️⃣ 页面里出现自写的表格容器 / 分页条，而 share 的 `PageVxeTable` 能覆盖 —— 必须整改
- 2️⃣ 自写的提交按钮 loading 逻辑，而 share 的 `LoadingButton` 能覆盖 —— 必须整改
- 3️⃣ 自写 `xxxSearchForm` / `xxxDialog` / `xxxDrawer`，而 share 的 `SearchForm` / `renderDialog` / `renderDrawer` 能覆盖 —— 必须整改
- 4️⃣ 别的业务块已有同名同功能组件，本块又造一个 —— 改 import 路径复用
- 5️⃣ 造组件时没有查过 share 的任何证据（报告里写不出「share 里没有 X」）—— 视为未查，必须整改

## 合法例外（必须在报告里写明理由）

- ✅ share 组件 props 满足不了，改造成本 > 复制成本（如表格列要动态注入且与 share 的类型系统冲突）
- ✅ share 组件依赖了本业务块不该引入的接口 / store
- ✅ 该组件只在 1 处使用且只有 2~3 行（低于建组件的收益）
- ✅ 产品有明确视觉稿要求，与 share 默认样式冲突

**例外不是默认。** 拿不出上面 4 条之一，按必须整改处理。

## 反模式

- ❌ 「先写完再说」—— 先写后查等于没查
- ❌ 查了 share 目录名就下结论 —— 导出名和目录名经常不一致（`renderDrawer` / `FlowableDialog`）
- ❌ 把 share 组件复制进 `components/` 再改 —— 改 import 路径复用，复制会让上游修复无法同步
- ❌ 因为「share 组件不支持我要的样式」就重写 —— 先看 props 能不能配；不能配再走例外条款
- ❌ 在本块 `components/` 造 `GenericTable` / `BaseDialog` / `SearchForm` 这类通用名 —— 通用名归 share
- ❌ 改了 share 组件的 props 语义来迁就单个页面 —— 加可选 props，别改已有行为

## 自检

审查时对每个 `components/*.vue` 和 `addOrEdit/*.vue`：

```bash
# 本页从 share 用了什么
grep -rn "@ob-web/share" packages/micro/cashier/src/pages/<业务块>
# 本页自己造了什么
find packages/micro/cashier/src/pages/<业务块> -name "*.vue" | sed 's|.*/||'
```

两份清单对照着看：本块自造组件里，有几个能对上 share 清单？每个对得上的都是违规项。