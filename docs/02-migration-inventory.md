# 迁移清单与迁移矩阵

> 目标：在完整保留青岛 v2.4 基线的前提下，建立可长期扩展的全球旅行系统。  
> 原则：逐项判断 **保留 / 复用 / 包装 / 重写 / 废弃**，禁止整体复制。

## 1. 迁移总体策略

采用“双轨并存”迁移：

```text
Legacy Qingdao v2.4                    Global Core Phase 1
────────────────────                  ─────────────────────────
现有 index / versions / assets        apps/web
现有 src-v2                           packages/domain
稳定分支 v1.0.15                      packages/data-schema
基线标签 v2.4                         packages/planner
                                      packages/providers
                                      packages/map-adapters
                                      fixtures/
```

在新系统达到第一阶段完成定义前：

- 不删除青岛入口、版本页面、压缩载荷和稳定分支。
- 不将旧版重新包装成 React 后直接称为全球核心。
- 不让新代码依赖旧 `window.*` 状态。
- 新系统只通过明确的 legacy import adapter 读取经过审核的旧数据。
- 新旧应用使用不同的缓存前缀和分享数据 Schema。

---

## 2. 代码模块迁移矩阵

| 当前模块/资产 | 决策 | 理由 | 目标位置或替代方案 | 阶段 | 验收条件 |
|---|---|---|---|---|---|
| `archive/v1.0.15-stable` | **保留** | 已验证的长期稳定回退 | 原分支不修改 | 全程 | 分支 SHA 不变，可读取入口 |
| `legacy-qingdao-v2.4-baseline` | **保留** | 全球重构前不可变证据 | Git tag | 全程 | 标签始终指向 `416076...` |
| `versions/`、`assets/v1*`、`assets/v2*` | **保留** | 历史版本和回退链 | Legacy 发布资产 | 全程 | 新构建不修改历史版本 |
| 根 `index.html` v2.4 loader | **包装后保留** | 在全球新版验收前仍需运行旧页面 | 迁移期保留根入口；后续通过 ADR 决定 `/legacy/qingdao/` 与新版首页切换 | Phase 2/3 | 切换前有可回滚部署记录 |
| `src-v2/data/generated/points.js` | **筛选复用** | POI 坐标和来源线索有价值 | `fixtures/destinations/qingdao/`，通过 importer 变成新 POI | Phase 1 | WGS84、SourceRef、Schema 校验通过 |
| `schedules.js` | **作为 fixture 复用** | 可作为 planner 回归样例，不应作为规则 | `fixtures/trip-requests/qingdao-legacy.json` 和 expected snapshot | Phase 1 | 只标记为 legacy fixture，不称算法生成结果 |
| `hotels.js` | **人工审核后复用** | 可能包含过期价格/评分 | 仅迁移住宿区域；具体酒店进入 reviewed fixture 或丢弃动态字段 | Phase 1/2 | 显示“需在预订平台复核” |
| `bookings.js` | **筛选复用** | 预约要求和渠道可作为事实线索 | POI reservationRequirement + SourceRef | Phase 2 | 来源、更新时间和状态可追溯 |
| `sources.js` | **包装并审核** | 有 URL 但缺 SourceRef 元数据 | SourceRef importer；补 publisher/type/retrievedAt/confidence/licenseNotes | Phase 1 | 每条正式数据引用有效 SourceRef |
| `recommendations.js` | **作为演示数据保留** | 主观推荐，不应自动成为全球生产数据 | `fixtures/` | Phase 1 | 明确 `manual-review` 和置信度 |
| `coordinate-service.js` | **重写式复用** | WGS84→GCJ-02 边界原则正确 | `packages/map-adapters/src/coordinates/`，纯 TS + 单元测试 | Phase 1 | domain 永远保存 WGS84；往返误差测试通过 |
| `leaflet-adapter.js` | **复用接口思路，重写实现** | 显式 ctx 有价值，但依赖 globals/UI | `packages/map-adapters` 的 `MapAdapter` + `apps/web` Leaflet implementation | Phase 2 | 不依赖 planner/DOM globals；contract test 通过 |
| `amap-adapter.js` | **延期重写** | 需要公开凭据隔离和服务条款确认 | 只定义 capability；未有安全方案时不可用 | Phase 3 或独立 ADR | 无前端秘密；GCJ 仅在边界；授权明确 |
| `service-result.js` | **复用概念，扩展重写** | 统一信封有价值，但字段不足 | `packages/providers` typed `ProviderResult<T>` | Phase 1 | 含 errorKind/status/stale/observedAt/source/capability |
| `service-facade.js` | **重写** | 修改全局函数、静默安装失败 | 显式 Provider registry + dependency injection | Phase 1 | Provider 可独立 mock；无 `window.*` |
| `travel-services.js` | **废弃** | 通过字符串从 globalThis 调用服务 | typed interfaces | Phase 1 | 编译期发现缺失 Provider |
| `search-service.js` | **拆分重写** | Provider、DOM、地图、导航混合 | Geocoding/Place/Routing provider + UI feature | Phase 2 | Provider 不访问 DOM；UI 不直接 fetch |
| `weather-service.js` | **拆分重写** | 固定青岛/8 月并直接渲染 | WeatherProvider + observation mapper + weather UI | Phase 2 | 多时区 fixture；stale/失败测试 |
| `traffic-service.js` | **主动延期** | 静态第一阶段非必需，且依赖高德 | capability unavailable | Phase 3 | 经过 ADR 和授权后再启用 |
| `risk-metrics-service.js` | **拆分重写** | 估算/实测区分思路可用，但硬编码中文和外部网络 | planner effort estimator + Provider enrichment | Phase 1/2 | Haversine 不冒充路线；method/confidence 明确 |
| `core/app-state.js` | **重写** | 青岛数据、凭据、DOM、地图和状态集中 | domain entities + web store | Phase 1/2 | core 无浏览器/网络依赖 |
| `state/preferences.js` | **包装后重写** | 简单，但静默失败且无 Schema | StorageAdapter + versioned preferences | Phase 2 | 迁移、失败和 quota 测试 |
| `state/local-data-manager.js` | **重写** | 多代 key 和 broad reset | Storage migration registry + UI data manager | Phase 2 | 不误删其他应用数据；可预览清理范围 |
| `ui/app-bootstrap.js` | **废弃并重写** | 直接 DOM、固定中心和旧运行时启动 | React app shell/router/bootstrap | Phase 2 | 页面初始化无未捕获异常 |
| `ui/trip-operations.js` | **规则下沉后重写** | 包含状态、日期、风险和渲染 | planner/replanner + React feature | Phase 1/2 | 锁定项重规划和不变量测试通过 |
| `src-v2/service-worker.js` | **保留旧版，重写新版** | 旧页面离线经验有价值，但策略不安全 | 新 `apps/web` SW；导航和资产策略分离 | Phase 2 | 更新、旧缓存、离线和回滚测试 |
| `scripts/build-v2.mjs` | **旧版冻结** | 保留基线重建能力，但不能作为新核心 build | 新系统使用 Vite；旧脚本只用于 legacy 验证 | Phase 1 | 新 build 不写 canonical source |
| `migrate-v2.*`、`patch-v2.*` | **废弃于新构建链** | build-time replace/patch 技术债 | 独立、一次性、可删除的 migration CLI | Phase 1 | `npm run build` 后工作区干净 |
| `validate-data-schema.mjs` | **概念复用，重写** | 基础引用校验有价值，模型过于专项 | Zod runtime + JSON Schema export + data validation CLI | Phase 1 | 全球地点、多时区、多语言 fixture 通过 |
| `tests/v2-risk.spec.js` | **保留旧测试并转化场景** | 能验证服务信封和估算标记 | legacy E2E 保留；新核心增加 Vitest/fast-check | Phase 1 | 旧测试继续通过，新 planner 属性测试通过 |
| `tests/v2-visual.spec.js` | **场景复用** | 设备矩阵有价值 | 新 Playwright E2E + visual snapshots | Phase 2 | 真正截图基线；成功/失败地图 mock |
| bundle budget 报告 | **复用机制** | 控制首次加载有效 | Vite bundle report + CI budget | Phase 2 | 超预算 CI 失败且有解释 |
| `.github/workflows/build-v2.yml` | **旧版冻结/禁用于新核心** | 固定分支并自动 push | 新 CI + 单独 Pages deploy workflow | Phase 1/2 | PR head 被验证；验证工作流只读 |

---

## 3. 数据迁移方案

### 3.1 数据分层

旧数据不会直接复制到 `data/` 正式目录，而是经过三层：

```text
旧 JS 常量
  ↓ legacy extractor（只读）
fixtures/legacy/qingdao-v2.4/raw
  ↓ mapper + Zod validation
fixtures/destinations/qingdao
  ↓ 人工来源审核
正式 data/destinations/qingdao（仅审核通过内容）
```

第一阶段只需要 fixture 完成跨国家纵向闭环，不进行全球批量填充。

### 3.2 POI 迁移

每个旧 POI 至少转换：

- `id`：加目的地 namespace，避免全球冲突；
- `names`：中文名称进入 `zh-CN`；英文缺失时保留 missing 状态，不机器伪造；
- `coordinates`：按 WGS84 保存；
- `placeId` / `planningUnitId`；
- `recommendedDuration`；
- `physicalIntensity`；
- `indoorLevel`；
- `reservationRequirement`；
- `sourceRefs`；
- `updatedAt` / uncertainty。

旧 `status`、`time` 等混合文本必须解析成结构化字段；无法可靠解析的内容进入 `legacyNotes`，不能猜测。

### 3.3 动态信息迁移

旧价格、天气、路线估价和评分不得直接成为当前值。

处理规则：

- 有原始观察时间：迁为 `DynamicObservation` 并保留 observedAt。
- 没有观察时间：只保留在 legacy fixture，不展示为当前事实。
- 已超过 expiresAt：显示“数据可能已过期”。
- 不知道 Provider 或来源：删除数值，只保留“需复核”提示。

### 3.4 SourceRef 迁移

旧 sources 逐条转换并审核：

```ts
{
  id,
  title,
  url,
  publisher,
  sourceType,
  retrievedAt,
  reviewedAt,
  reviewer,
  confidence,
  licenseNotes
}
```

正式数据至少要求：URL 可访问、发布者明确、sourceType 正确、retrievedAt 存在、confidence 非空。

---

## 4. 状态迁移方案

### 4.1 迁移范围

第一阶段只迁移用户仍有价值的状态：

- 已锁定的行程活动；
- 活动顺序；
- 站点完成/跳过状态；
- 语言和货币偏好；
- 地图偏好；
- 分享 JSON。

不迁移：

- 旧天气缓存；
- 旧实时路况；
- 旧 API 原始响应；
- 已过期动态价格；
- 旧 UI 抽屉像素状态。

### 4.2 版本化策略

```ts
interface StoredEnvelope<T> {
  schemaVersion: number;
  appVersion: string;
  savedAt: string;
  data: T;
}
```

迁移要求：

1. 每个迁移为纯函数 `vN -> vN+1`。
2. 原始值迁移成功前不得删除。
3. 迁移失败时使用默认状态并给出可见警告。
4. 分享 JSON 与本地状态使用不同 namespace。
5. 测试覆盖空值、损坏 JSON、旧版、未来未知版本和重复执行。

---

## 5. 缓存迁移方案

### 5.1 命名空间

- Legacy：继续使用现有 `travel-plans-*`，不修改。
- Global Web：使用 `global-travel-plans:web:<schemaVersion>:<buildId>`。
- Provider cache：`global-travel-plans:provider:<provider>:<schemaVersion>`。

### 5.2 更新策略

- HTML/navigation：network-first，失败时 app shell fallback。
- hashed JS/CSS/assets：cache-first，版本变化自然失效。
- fixture/data manifest：stale-while-revalidate，并验证 Schema。
- Provider 动态响应：由 Provider 定义 TTL；不得被 Service Worker 无条件缓存。
- 不允许把 JS、CSS、JSON 请求统一回退到 HTML。

### 5.3 清理策略

- 新版本激活后至少保留上一可用 app shell，直到新页面完成启动确认。
- 只删除明确属于旧 Global Web namespace 的缓存。
- Legacy 缓存由旧版自行管理，新 SW 不跨 namespace 删除。

---

## 6. 回滚方案

### 6.1 代码回滚

- `main` 在新系统达到完成定义前仍保持青岛 v2.4。
- 所有重构只存在于 Draft PR 分支。
- 任意阶段失败可关闭 PR，不影响线上旧版。
- 基线可由 `legacy-qingdao-v2.4-baseline` 精确恢复。
- 更早稳定版由 `archive/v1.0.15-stable` 恢复。

### 6.2 Pages 回滚

未来切换新版入口时，必须：

1. 保存切换前 Pages deployment artifact 和 commit SHA。
2. 新版先部署 preview/base-path 环境。
3. smoke test 通过后再切生产。
4. 生产失败时将 Pages 重新部署到上一个 artifact，不重写 Git 历史。
5. Legacy Qingdao 提供独立可访问路径。

### 6.3 数据回滚

- 新 Schema migration 不覆盖旧 localStorage。
- 分享 JSON 保留 schemaVersion。
- 不识别的未来版本只读并提示，不自动降级写回。
- Provider cache 可以删除，用户锁定和行程输入不能因缓存清理丢失。

---

## 7. 分阶段验收标准

### Phase 0：审计基线

- 完整历史已导入。
- 基线标签存在。
- 开发分支和 Draft PR 存在。
- 既有 install/build/validate/E2E 真实运行并保留日志。
- 构建修改源码、凭据和耦合问题已登记。

### Phase 1A：工程骨架和领域模型

- npm workspaces、TypeScript strict、Vite、React、Vitest、Zod 建立。
- `packages/domain` 不依赖 DOM、React、网络。
- `packages/planner` 不调用 Provider。
- Place/POI/TripRequest/TripPlan/SourceRef Schema 可导出 JSON Schema。
- 至少一个中国和一个海外 fixture、两个时区、两种货币、两种语言通过校验。
- build 后 `git diff --exit-code` 通过。

### Phase 1B：确定性 Planner

- 相同输入、数据版本、seed 输出相同。
- 必去/排除/锁定/每日时间窗/跨时区/住宿/TravelLeg 建模。
- 15 项规划不变量全部通过。
- 属性测试覆盖空数据、单日、超量必去、多时区、跨国、重复、不可达、Provider 全失败和锁定后重规划。

### Phase 1C：最小纵向闭环

- 多目的地选择和约束输入。
- 天数分配、每日活动、TravelLeg、住宿区域。
- Leaflet 地图展示 fixture 路线。
- 拖拽后保留锁定项重规划。
- 中英文、分享 JSON、打印/PDF。
- 来源、新鲜度、假设、冲突和降级可见。

### Phase 2：发布与迁移

- CI 全部门禁通过。
- GitHub Pages base-path smoke test 通过。
- Provider 全失败页面仍可用。
- 移动/桌面/键盘/基础无障碍通过。
- Service Worker 更新和旧缓存升级通过。
- Legacy Qingdao 路径仍可访问。

---

## 8. 主动延期

第一阶段不迁移或实现：

- 实时全球酒店价格和库存；
- 高德生产 Provider；
- 实时交通；
- Visa 动态自动抓取；
- 大规模全球行政区数据库；
- 爬虫；
- 账号、支付、社交；
- 自动发布社交媒体；
- 复杂后台。

这些能力只有在授权、成本、数据责任和技术边界明确后，才能通过新 ADR 进入范围。
