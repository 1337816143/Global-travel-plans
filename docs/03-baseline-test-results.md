# 基线测试结果

> 测试对象：青岛旅行计划 v2.4  
> 基线提交：`416076e8ea19aa3f19a86faaaa08abfd9d69da90`  
> 测试分支：`refactor/global-core-phase-1`  
> GitHub Actions run：`30328188263`  
> Job：`90177815770`  
> 证据 artifact：`phase0-baseline-evidence`  
> Artifact SHA-256：`4fa1e50469082c58d3fa358bee9b50f31b42b4d1eba8b6ccd567bd5e43c389d9`

## 1. 结论

现有 v2.4 基线的公开命令均已在干净 GitHub-hosted Ubuntu runner 中真实运行：

- 安装：通过；
- 构建：通过；
- 现有校验：通过；
- Playwright 浏览器安装：通过；
- 现有 E2E/布局测试：通过。

但是，构建完成后修改了已跟踪源码/迁移文件。因此只能得出：

> **现有版本可以构建和运行既有测试，但当前构建不是纯净、只读、完全可复现的构建。**

不得把本次通过扩大解释为：新全球架构、规划引擎、Provider contract、Pages 部署、秘密扫描或全部浏览器功能已经通过。

---

## 2. 测试环境

| 项目 | 值 |
|---|---|
| Runner | GitHub-hosted Ubuntu 24.04 |
| Git | 2.54.0 |
| Node.js | v24.18.0 |
| npm | 11.16.0 |
| Python | 3.12.3 |
| Checkout | 完整历史，`fetch-depth: 0` |
| 权限 | `contents: read` |

首个 PR 测试运行由 GitHub 对 Draft PR 生成 merge revision，以验证分支与 `main` 的组合；artifact 同时记录了 branch 和 commit 信息。

---

## 3. 实际运行命令

### 3.1 安装

```bash
npm install --ignore-scripts
```

结果：**成功**。

注意：仓库基线没有提交 `package-lock.json`。安装过程生成了新的 lockfile 和 `node_modules/`，所以安装虽然成功，但不满足未来 CI 的确定性安装要求。

### 3.2 构建

```bash
npm run build:v2
```

实际脚本：

```bash
node scripts/build-v2.mjs
```

结果：**成功**。

构建输出：

```text
Schema OK: 39 points, 8 schedules, 8 bookings; warnings=0
Built v2.4.0: initial=80670 bytes gzip, lazy=14054, total=94724
```

构建产物 SHA-256：

```text
8c4d55264b1c1bdb2f372aa7cf180d8b2e12d2696976c15937e55454a85f1ebc
```

### 3.3 校验

```bash
npm run validate:v2
```

该命令会再次执行构建，再执行：

```bash
node scripts/validate-v2.mjs
```

结果：**成功**。

输出摘要：

```text
Validation OK: v2.4.0,
initial=80670,
lazy=14054,
legacy=140,
schema=true,
explicit adapters and unified services passed
```

### 3.4 Playwright

```bash
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

结果：**成功**。

统计：

- 总测试实例：18；
- 通过：8；
- 跳过：10；
- 失败：0；
- 用时：约 19.3 秒。

跳过项是测试文件按项目名称主动跳过不适用设备的结果，不是临时删除或放宽断言。

---

## 4. 浏览器和设备覆盖

Playwright 配置包含：

| Project | 浏览器 | Viewport/设备意图 | 结果 |
|---|---|---|---|
| `desktop-1080p-chromium` | Chromium | 1920×1080 | 通过适用测试 |
| `desktop-2.5k-chromium` | Chromium | 2560×1440 | 通过适用测试 |
| `xiaomi17-promax-portrait-chromium` | Chromium | 430×932，移动/触摸 | 通过适用测试 |
| `xiaomi17-promax-landscape-chromium` | Chromium | 932×430，移动/触摸 | 通过适用测试 |
| `iphone17-promax-portrait-webkit` | WebKit | 440×956，移动/触摸 | 通过适用测试 |
| `iphone17-promax-landscape-webkit` | WebKit | 956×440，移动/触摸 | 通过适用测试 |

当前未覆盖：

- 桌面 Firefox；
- 桌面 Safari/WebKit；
- Android 真机浏览器；
- iOS 真机；
- 低端设备性能；
- 屏幕阅读器。

---

## 5. 既有测试实际证明了什么

已证明：

1. v2.4 loader 可以在本地 server 中载入压缩页面。
2. 页面标题和版本标识正确。
3. 页面初始化没有测试捕获到的未处理 `pageerror`。
4. Leaflet/AMap adapter factory 和显式 context 对象存在。
5. Service result 包含 `ok/data/error/source/cached/reportedAt`。
6. 旅行工具可以懒加载。
7. 重复 POI occurrence 的完成/跳过状态可区分。
8. 风险模块可使用 fixture 的步行路线、高程和逐小时天气。
9. 空搜索返回失败信封，而不是伪造成功数据。
10. 桌面路线卡片、地图控件和移动抽屉在测试尺寸下没有主要遮挡。
11. 手机竖屏和横屏的 fallback 页面及旅行工具可以操作。

---

## 6. 构建工作区修改

在第一次 `npm run build:v2` 后，审计记录到以下已跟踪文件发生变化：

```text
M MIGRATION_V2.2.json
M MIGRATION_V2.3.json
M scripts/migrate-v2.3.mjs
```

差异统计：

```text
3 files changed, 8 insertions(+), 35 deletions(-)
```

另外安装产生：

```text
?? package-lock.json
?? node_modules/
```

判定：

- 严重程度：P1；
- 后果：构建可能迁移或修补 canonical source，无法用工作区干净证明完全可重复；
- 修复：新核心使用 Vite 的只读构建；迁移脚本独立运行；生成目录明确；CI 增加 `git diff --exit-code`；
- 修复阶段：Phase 1；
- 是否阻塞：阻塞新核心构建链，但不阻塞保留和运行旧青岛基线。

---

## 7. Schema 与 bundle 基线

现有 Schema 报告：

| 数据 | 数量 |
|---|---:|
| Points | 39 |
| Schedules | 8 |
| Hotels | 3 |
| Bookings | 8 |
| Sources | 24 |
| Recommended | 9 |

当前报告无 errors 和 warnings，但它只校验青岛固定日期范围和现有引用，不等同于全球 Schema。

Bundle budget：

| 指标 | 字节 |
|---|---:|
| 上一版本 initial gzip | 85,517 |
| 当前 initial gzip | 80,670 |
| lazy gzip | 14,054 |
| total gzip | 94,724 |
| initial budget | 83,806 |
| total budget | 107,517 |

现有预算报告为通过。

---

## 8. 视觉测试的准确解释

`tests/v2-visual.spec.js` 会保存截图，但没有使用 Playwright `toHaveScreenshot()` 和受版本控制的期望图片。因此当前测试是：

- 布局几何断言；
- DOM 状态断言；
- 测试失败/完成时截图留证。

它不是严格意义上的自动视觉回归比较。

同时，测试会对所有非 localhost 请求执行 fixture 或 abort：

- 高德步行、Open-Meteo 高程/天气使用 mock；
- 其他外部请求被中止；
- 地图瓦片和高德 JS API 成功加载路径未被真实验证。

人工检查 artifact 截图可见：

- 桌面页面主体和控件正常显示，但地图区域没有真实瓦片；
- 移动截图进入“地图组件未加载”的离线 fallback，同时抽屉和工具仍可用。

因此只能声明“外部服务失败时静态 UI 基本可用”，不能声明“实际地图服务已验证成功”。

---

## 9. GitHub Pages 基线

仓库存在 `validate-pages-payload.yml`，它验证：

- v2.4 payload 可以重新构建；
- 最新有效版本为 v2.4.0；
- lazy-tools 存在；
- loader JavaScript 语法正确；
- fallback 顺序为 v2.4.0 → v1.0.15；
- 标题为青岛旅行计划。

本轮尚未证明：

- 目标仓库 GitHub Pages 当前设置；
- 真实 Pages deployment 成功；
- `/Global-travel-plans/` base path；
- Service Worker scope；
- 部署后的刷新、404 和资源路径；
- Pages 上的移动/桌面浏览器 smoke test。

这些必须在新架构进入部署阶段后单独验证。

---

## 10. 当前没有运行或没有建立的门禁

以下项目不得标记为通过：

| 门禁 | 当前状态 |
|---|---|
| Format check | 未建立 |
| ESLint | 未建立 |
| TypeScript strict typecheck | 未建立 |
| Vitest unit tests | 未建立 |
| Planner invariant tests | Planner 尚未建立 |
| 属性/随机测试 | 未建立 |
| Provider contract tests | 未建立 |
| Secret scan | 未建立；人工审计已确认公开高德凭据 |
| Accessibility audit | 仅有少量 DOM/键盘断言，不完整 |
| True visual snapshot regression | 未建立 |
| Pages base-path smoke | 未建立 |
| Service Worker upgrade test | 未建立 |
| Share Schema migration | 未建立 |
| Provider all-failed test for new app | 未建立 |

---

## 11. Phase 0 基线判定

### 已完成

- 完整历史导入验证；
- 基线标签；
- 独立开发分支；
- Draft PR；
- 真实 install/build/validate/E2E；
- 日志和截图 artifact；
- 构建污染识别；
- 静态耦合与硬编码 inventory。

### 部分完成

- 浏览器覆盖：已有模拟设备，不含全部桌面浏览器和真机。
- 视觉测试：有布局和截图，不是像素回归。
- Pages：有 payload 校验，没有真实部署 smoke。

### 未完成

- 全球新核心的任何测试；
- Planner；
- Provider contract；
- 完整 CI 门禁；
- 新版 Service Worker；
- 新 Pages 部署。

### 被阻塞

- 高德生产 Provider：被公开凭据和 Static Pages 安全限制阻塞。

### 主动延期

- 实时酒店、库存、评分、交通和全球数据批量填充。
