# 当前仓库全面审计

> 项目：全球旅行攻略 / Global Travel Plans  
> 审计对象：由 `1337816143/travel-plans` 完整导入的青岛旅行计划 v2.4  
> 基线提交：`416076e8ea19aa3f19a86faaaa08abfd9d69da90`  
> 不可变标签：`legacy-qingdao-v2.4-baseline`  
> 开发分支：`refactor/global-core-phase-1`  
> 审计日期：2026-07-28

## 1. 审计结论

现有仓库不是一个可随意重写的静态单页，而是一个已经积累了版本回退、压缩发布、离线缓存、双地图实现、数据校验、Playwright 端到端测试和历史分支的青岛专项系统。

青岛 v2.4 当前能够安装、构建、校验并通过既有 Playwright 测试，因此可作为迁移基线保留。但是，它尚不能直接作为全球系统的核心，主要原因如下：

1. 高德凭据已经写入公开前端源码，必须视为已公开。
2. 构建过程会执行迁移和文本补丁，并修改手写源码。
3. 核心状态、服务、DOM 和第三方 API 仍通过全局变量连接。
4. 城市、年份、日期范围、时区、坐标边界和行政编码均与青岛行程绑定。
5. 当前 Schema 只是青岛数据的专项校验，不是全球领域模型。
6. 现有“视觉测试”会截图，但没有稳定截图基线比较，且测试主动阻断外部地图网络。
7. GitHub Pages 校验只验证静态载荷和回退顺序，尚未验证真实 Pages 子路径部署。

因此，迁移策略必须是：**保留青岛版运行基线，在旁边建立新的严格 TypeScript 核心，通过数据导入适配器逐步迁移，不能在旧运行时上继续堆叠全球功能。**

---

## 2. Git 与发布基线

### 2.1 导入完整性

目标仓库已完成完整历史导入，而不是只复制文件快照。

审计证据：

- `main` 指向源仓库基线提交 `416076e8ea19aa3f19a86faaaa08abfd9d69da90`。
- 静态审计统计共有 71 个提交。
- 所有引用只有 1 个根提交，说明历史是连续的，而不是拼接出的独立快照。
- 历史分支已导入，包括 `archive/v1.0.15-stable` 和各代 `agent/*` 分支。
- `archive/v1.0.15-stable` 的 `index.html` 仍可读取，并声明版本 `1.0.15`。
- 已建立不可变标签 `legacy-qingdao-v2.4-baseline`，指向上述基线提交。

### 2.2 当前开发保护

- `main` 未用于重构开发。
- 当前开发分支为 `refactor/global-core-phase-1`。
- Draft PR 为 `#2`，未合并。
- 未执行 force push。
- 青岛历史版本和稳定回退未删除。

---

## 3. 当前目录与模块关系

### 3.1 主要目录

| 路径 | 当前职责 | 审计判断 |
|---|---|---|
| `src-v2/` | v2.4 所称的 canonical source | 应保留为旧版源代码，禁止继续作为全球核心扩展 |
| `src-v2/data/generated/` | 青岛点位、日程、酒店、预约、来源等 JS 数据 | 数据可筛选迁移，但目录名与生成/手写边界不清 |
| `scripts/` | 提取、迁移、patch、Schema 校验、压缩构建 | 构建技术债集中区，全球核心应重写 |
| `assets/v*/` | 各版本压缩载荷和静态资源 | 保留用于历史回退，不作为新核心开发模式 |
| `src/v*.html` | 完整版本页面 | 保留历史证据和回退，不继续生成全球核心单文件 |
| `versions/` | 历史入口 | 保留 |
| `tests/` | Playwright E2E 与布局检查 | 场景可复用，测试架构需升级 |
| `.github/workflows/` | 多代构建、校验、视觉测试工作流 | 历史工作流保留；新核心建立独立 CI 门禁 |

### 3.2 当前构建数据流

```text
src-v2/app/legacy-app.js
        │
        ├─ scripts/migrate-v2.2.mjs
        ├─ scripts/patch-v2.2-source.mjs
        ├─ scripts/migrate-v2.3.mjs
        ├─ scripts/migrate-v2.4.mjs
        ├─ scripts/migrate-v2.4-features.mjs
        ├─ scripts/patch-v2.4-generated.mjs
        └─ scripts/validate-data-schema.mjs
                 │
                 ├─ 可能修改 src-v2、迁移脚本和报告
                 ├─ 拼接 CSS、数据和 JavaScript
                 ├─ 写入 src/v2.4.0.html
                 ├─ 压缩写入 assets/v2.4.0/
                 ├─ 重写 index.html
                 ├─ 重写 service-worker.js
                 └─ 重写 versions/、部署说明和预算报告
```

真实基线运行证明，`npm run build:v2` 成功后，工作区出现以下已跟踪文件修改：

- `MIGRATION_V2.2.json`
- `MIGRATION_V2.3.json`
- `scripts/migrate-v2.3.mjs`

变更统计为 8 行新增、35 行删除。这说明“构建成功”不等于“构建过程纯净或可重复”。

---

## 4. 当前运行时架构

### 4.1 全局状态

`src-v2/core/app-state.js` 维护大量顶层可变变量，包括：

- Leaflet 地图、图层、聚合点；
- 高德地图实例、标记、路线、搜索、天气、定位、路况；
- 当前日期、底图、推荐模式、路线显示状态；
- 多组 LocalStorage key；
- 青岛必去点、可选点、图标和分类。

随后通过 `window.TravelAppContext` 暴露状态、地图、配置、数据、存储和 UI 工具。

这是一层兼容性上下文，不是独立领域核心。它依赖浏览器、DOM、Leaflet、高德和青岛数据，不能迁入 `packages/domain` 或 `packages/planner`。

### 4.2 地图适配器

当前项目已经具备值得保留的设计思路：

- `createLeafletTravelAdapter(ctx)` 使用显式上下文创建适配器。
- `createAmapTravelAdapter(ctx)` 在适配器边界执行 WGS84 → GCJ-02 转换。
- `coordinate-service.js` 将坐标转换独立出来。

但是实际运行时仍通过 `window.TravelLeafletAdapter`、`window.TravelAmapAdapter` 和多组桥接函数注册到全局对象，并依赖 UI 函数、全局日程和 DOM。因此应复用**接口思路和坐标边界原则**，不直接复制实现。

### 4.3 服务层

`TravelServiceFacade` 将天气、路况、搜索、周边、定位和路线结果包装为：

```text
ok / data / error / source / cached / reportedAt
```

这是可复用的结果信封思路，但当前实现仍有以下不足：

- 通过修改全局函数完成安装；
- 安装异常被空 `catch` 静默吞掉；
- 没有 capability 描述；
- 没有统一 timeout 和 `AbortSignal`；
- 没有错误分类；
- 没有 stale、unavailable、expiresAt；
- Provider 原始结果仍容易进入 UI；
- React/领域层边界不存在。

### 4.4 DOM 与服务耦合

地点搜索、天气、路线、定位和地图操作普遍直接调用：

- `document.getElementById`
- `querySelector`
- `innerHTML`
- `window.open`
- 全局地图实例

例如 `src-v2/services/search-service.js` 同时负责：

- 初始化高德插件；
- 读取表单；
- 调用搜索/地理编码 API；
- 生成 HTML；
- 更新状态文案；
- 绘制地图标记；
- 打开导航链接。

这不是可替换 Provider，而是“服务 + 控制器 + View”混合模块。

---

## 5. 硬编码审计

### 5.1 配置项

当前固定配置包括：

- 应用版本 `2.4.0`；
- 构建日期 `2026-07-28`；
- 默认语言 `zh-CN`；
- 稳定回退 `1.0.15`；
- 高德城市“青岛”；
- 高德行政编码 `370200`；
- 默认地图中心 `[36.066, 120.38]`；
- 默认时区 `Asia/Shanghai`。

这些应迁移到类型安全配置和构建元数据模块。

### 5.2 业务数据

当前业务数据包括：

- 青岛 POI ID；
- 8 月 9 日至 16 日固定日程；
- 酒店和住宿区域；
- 预约清单；
- 雨天备选和推荐点；
- 青岛专项图标和分类。

这些应通过旧数据导入器迁入版本化 fixture，不得继续作为新系统常量。

### 5.3 业务规则

当前规则散布在 UI 和服务中，包括：

- 坐标必须位于青岛附近的自检范围；
- 交通方式通过中文关键词和距离阈值判断；
- 日期通过 `2026-` 和 `08-xx` 拼接；
- 体力风险通过正则匹配“公园、海、山、拍照”等词；
- 天气活动时段从行程文本正则提取；
- 直线距离乘 1.25 作为步行降级估算。

这些规则必须进入可测试的规划引擎或明确的估算模块，并在输出中保留估算标记。

### 5.4 静态扫描指标

Phase 0 静态审计扫描了 185 个文本代码/配置文件。由于仓库包含历史页面和旧版本，以下数字是全仓“迁移工作量指标”，不是独立缺陷数量：

| 指标 | 命中次数 |
|---|---:|
| `window.*` / `globalThis.*` | 816 |
| DOM 访问 | 4,772 |
| LocalStorage | 119 |
| 直接 `fetch` | 60 |
| JSONP 相关 | 62 |
| 中文“青岛” | 1,458 |
| `qingdao` key | 472 |
| 固定年份 2026 | 744 |
| `Asia/Shanghai` | 20 |
| 高德凭据变量名 | 112 |
| 高德 API 域名 | 51 |
| Open-Meteo 域名 | 14 |
| migration/patch/replace | 230 |

---

## 6. 外部服务与凭据

### 6.1 高德地图

当前公开源码包含：

- JavaScript API Key；
- Security Code；
- Web Service Key。

并在浏览器中直接使用这些值访问高德 JS API 和 REST API。由于仓库是公开仓库，这些值必须视为已泄露，不能复制到全球系统。

当前 REST 请求在 CORS/fetch 失败后，会对所有错误统一回退到 JSONP。该逻辑无法区分：

- 网络错误；
- 鉴权错误；
- 配额错误；
- 参数错误；
- 服务端错误。

因此可能在鉴权失败后继续发起第二次请求。

### 6.2 Open-Meteo

当前使用：

- Forecast API；
- Elevation API / Copernicus DEM 90m。

它们不需要秘密凭据，适合通过 Provider Adapter 接入 Static-first 架构。但仍需补充：

- capability；
- timeout 和 AbortSignal；
- 缓存与 stale 策略；
- 来源和更新时间；
- 服务条款和速率限制说明；
- fixture/mock。

### 6.3 地图瓦片

当前 Leaflet 支持 OSM、CARTO、OpenTopoMap 和 HOT。必须分别核对瓦片使用政策、归属标注、缓存限制和生产流量要求，不能把公共瓦片服务默认为无限免费生产 CDN。

---

## 7. LocalStorage 与缓存

### 7.1 LocalStorage

当前存在多代 key：

- `qingdao-v107-*`
- `travel-plans-v2:*`
- `travel-plans-weather-*`
- `trip-stop-status-v2.3/v2.4`
- `trip-taxi-budget-v2.3`
- `trip-risk-metrics-v2.4`

部分状态有迁移逻辑，例如重复 POI 的站点状态从 v2.3 迁移到 v2.4；但没有统一的 Storage Schema、迁移注册表和失败恢复策略。多个读写函数会静默吞掉 JSON 解析或存储异常。

### 7.2 Service Worker

当前 Service Worker：

- 安装时缓存固定版本和固定日期文件；
- 激活时删除所有其他 `travel-plans-*` 缓存；
- 对同源 GET 请求使用 network-first；
- 网络失败后先匹配请求，再统一回退到 `index.html`。

主要风险：

- 静态资源请求可能错误回退为 HTML，产生 MIME/解析问题；
- 删除旧缓存没有独立 Schema 迁移和回滚窗口；
- 固定日期文件使构建和版本发布强耦合；
- 未验证新旧分享数据和 LocalStorage 升级。

---

## 8. 版本与文档一致性

当前版本信息存在多个来源：

- `package.json`：2.4.0；
- `scripts/build-v2.mjs`：2.4.0；
- HTML meta 和运行时常量；
- Service Worker cache version；
- manifest；
- `DEPLOYMENT.md`；
- `PAGES_SETUP.md`；
- `README.md`。

其中根 `README.md` 仍声明当前版本为 v1.0.0，与实际 v2.4.0 不一致。

全球系统必须只有一个版本源，并在构建时生成页面、manifest、Service Worker 和文档中的版本信息。

---

## 9. 测试现状

### 9.1 已有能力

- Playwright 覆盖桌面 Chromium、移动 Chromium 和移动 WebKit。
- 覆盖桌面 1080p、2.5K、手机竖屏和横屏。
- 覆盖布局遮挡、抽屉状态、旅行工具懒加载、重复站点状态、风险数据和服务结果结构。
- 外部 API 通过 route fixture 拦截，减少网络不确定性。
- 已有 bundle budget。
- 已有基础 Schema 校验。

### 9.2 缺口

当前 package scripts 只有：

- `build:v2`
- `validate:v2`
- `test:e2e`

尚无统一命令覆盖：

- format check；
- lint；
- TypeScript typecheck；
- 单元测试；
- 规划不变量；
- 属性测试；
- Provider contract；
- secret scan；
- 可访问性扫描；
- Pages base-path 浏览器 smoke test。

现有“visual regression”测试只是调用 `page.screenshot()` 保存图片，没有 `toHaveScreenshot()` 基线比较。测试还会阻断所有非本地网络，因此验证的是页面降级和布局，而不是实际地图瓦片或高德地图成功渲染。

---

## 10. GitHub Actions 与 Pages

### 10.1 构建工作流

旧 `.github/workflows/build-v2.yml` 在 job 中固定 checkout：

```yaml
ref: agent/v2.4.0-context-services-risk
```

随后构建、提交并推送生成结果到该固定分支。该设计存在两个问题：

1. Pull Request 触发时，可能测试固定分支而不是 PR head。
2. CI 同时承担校验、代码生成、提交和推送，破坏只读验证原则。

### 10.2 Pages 校验

`validate-pages-payload.yml` 会：

- 构建 v2.4；
- 验证压缩 payload；
- 验证 loader 语法；
- 验证回退顺序和标题。

它没有验证：

- GitHub Pages 当前发布源和设置；
- `https://<owner>.github.io/Global-travel-plans/` 子路径；
- Service Worker scope；
- 部署后的资源路径；
- 浏览器真实加载和刷新；
- 404 回退。

---

## 11. 数据来源与合规

当前 POI 数据要求 `source` 非空，SOURCES 要求 URL 合法，这是有价值的基础。但现有 Source 数据模型缺少：

- publisher；
- sourceType；
- retrievedAt；
- reviewedAt；
- reviewer；
- confidence；
- licenseNotes；
- 对动态观察值的 expiresAt。

当前“来源存在”不能等同于“授权和数据新鲜度已核验”。迁移时必须逐条审核，尤其是酒店、社交媒体、地图搜索结果和第三方价格信息。

---

## 12. 主要发现及处理决策

| ID | 问题与证据 | 严重度 | 可能后果 | 修复方案 | 修复阶段 | 阻塞后续 |
|---|---|---|---|---|---|---|
| AUD-001 | `src-v2/core/app-state.js:5` 存在公开高德 Key/Security Code/Web Key | P0 | 凭据滥用、配额消耗、服务停用、合规风险 | 原平台撤销/轮换；新系统不复制；Pages 默认禁用需秘密凭据的动态能力；仅通过安全网关使用 | Phase 0/Provider 阶段 | 阻塞高德 Provider 迁移和生产动态服务；不阻塞静态核心与文档 |
| AUD-002 | 基线构建修改 `MIGRATION_V2.2.json`、`MIGRATION_V2.3.json`、`scripts/migrate-v2.3.mjs` | P1 | 构建不可重复、源代码漂移、CI 可能自动提交意外变化 | 将迁移改为一次性工具；构建只读 canonical source；生成文件写入专用目录；CI 检查 `git diff --exit-code` | Phase 1 | 阻塞新核心构建链，不阻塞旧版保留 |
| AUD-003 | `build-v2.yml` 固定 checkout agent 分支并自动 push | P1 | PR 测试对象错误，CI 越权修改仓库 | 新 CI 始终测试当前 SHA；验证工作流只读；发布单独授权 | Phase 0/1 | 阻塞将旧工作流作为新系统门禁 |
| AUD-004 | `window.TravelAppContext`、`TravelServices`、适配器和桥接函数共享状态 | P1 | 难以单测、并发状态污染、组件替换困难 | 新建无浏览器依赖的 domain/planner；UI 通过显式接口和状态容器调用 | Phase 1 | 阻塞全球核心直接复用旧运行时 |
| AUD-005 | Schema 固定 2026-08-09 至 08-16、8 个日程和青岛引用 | P1 | 无法表达全球、多时区、多目的地行程 | 使用 Zod + JSON Schema 建立版本化 Place/POI/TripRequest/TripPlan | Phase 1 | 阻塞全球数据进入生产模型 |
| AUD-006 | 年份、月份、时区、城市、行政编码和坐标边界硬编码 | P1 | 跨国日期错误、错误地点过滤、天气错配 | 规范化时区和地点；WGS84 作为领域坐标；城市配置数据化 | Phase 1 | 阻塞多目的地规划 |
| AUD-007 | 服务模块直接操作 DOM，fetch 失败后统一回退 JSONP | P1 | 鉴权错误重复请求、错误不可分类、Provider 无法替换 | Provider contract、错误分类、timeout/AbortSignal、显式降级；移除 JSONP 自动回退 | Phase 1/2 | 阻塞 Provider 正式接入 |
| AUD-008 | LocalStorage 多代 key，无统一 Schema 注册表 | P2 | 升级丢状态、静默损坏、重规划输入不一致 | 版本化 share/storage schema；纯迁移函数；备份和失败回退 | Phase 2 | 不阻塞领域模型，但阻塞正式状态迁移 |
| AUD-009 | Service Worker 任意同源请求失败后可能回退 HTML | P1 | JS/CSS/JSON 获得错误 MIME，离线故障难诊断 | 按请求类型设置策略；导航请求才回退 app shell；版本化缓存迁移 | Phase 2 | 阻塞新 Pages 离线发布 |
| AUD-010 | README 与 package/build 版本不一致 | P1 | 发布身份不可追溯、用户误判版本 | 单一版本源和 CI 一致性检查 | Phase 1 | 不阻塞建模，阻塞正式发布 |
| AUD-011 | 视觉测试无截图基线且不验证真实地图 | P2 | UI 回归可能漏检，地图成功路径未经证明 | 增加稳定视觉快照；Provider mock 成功/失败场景；独立真实服务人工验证 | Phase 2 | 不阻塞领域核心 |
| AUD-012 | 缺少 lint/typecheck/unit/invariant/provider/secret/Pages smoke 门禁 | P1 | 核心正确性和发布安全无法证明 | 建立新 workspace CI，按规定顺序执行全部门禁 | Phase 1/2 | 阻塞第一阶段完成定义 |
| AUD-013 | SourceRef 缺少授权、新鲜度和审核字段 | P2 | 旧数据来源不可审计，动态数据被误认为实时 | 新 SourceRef 和 DynamicObservation；迁移时逐条审核 | Phase 1/数据迁移 | 阻塞旧数据直接标记为生产数据 |
| AUD-014 | 单文件压缩载荷是核心发布模式 | P2 | 调试、缓存、tree-shaking、按模块升级困难 | 旧版保留；新系统使用 Vite 资产图和可追踪 chunk | Phase 1 | 不阻塞旧版，阻塞新核心沿用该模式 |

---

## 13. 可安全复用的资产

以下资产不是直接复制，而是经过包装或重新实现后复用：

1. 青岛 POI 坐标和来源线索。
2. WGS84 → GCJ-02 只在高德适配器边界发生的原则。
3. Leaflet/高德双适配器的接口化思路。
4. 服务统一结果信封的思路。
5. Playwright 的桌面、手机竖屏和横屏场景。
6. Provider 失败时仍展示静态页面的降级经验。
7. v1.0.15 稳定分支、历史版本和 loader 回退机制。
8. bundle budget 思路。
9. 重复 POI 状态按 occurrence 区分的经验。
10. 估算值与 API 实测值分开标记的经验。

## 14. 审计阶段决定

- 青岛 v2.4 保持原样运行，不在其代码中直接实施全球化重写。
- 新核心采用独立 workspace，并通过 legacy import adapter 读取青岛 fixture。
- 高德公开凭据不进入新目录、fixture 或环境示例。
- 在安全网关确定前，新系统 Pages 版本只提供 Leaflet 和无需秘密凭据的公开 Provider。
- 先完成领域模型、规划引擎和 fixture 纵向闭环，再迁移 UI 和外部服务。
- 任何旧数据只有通过新 Schema 和 SourceRef 审核后，才能从演示数据升级为正式数据。
