# 风险登记表

> 基线：`legacy-qingdao-v2.4-baseline`  
> 适用分支：`refactor/global-core-phase-1`  
> 状态定义：Open / Mitigated / Accepted / Closed

## 严重程度

- **P0**：安全、数据完整性或迁移前提风险；必须立即隔离。
- **P1**：可能导致核心错误、错误发布或无法维护；进入对应阶段前必须解决。
- **P2**：显著降低质量、可追溯性或用户体验；第一阶段完成前原则上应解决。
- **P3**：优化项或长期维护成本；可在不影响核心正确性的前提下延期。

## 风险清单

| ID | 风险与证据位置 | 严重度 | 可能后果 | 处置方案 | 修复阶段 | 是否阻塞 | 状态 |
|---|---|---|---|---|---|---|---|
| R-001 | 公开 AMap JS Key、Security Code、Web Key：`src-v2/core/app-state.js:5`；`src-v2/map/amap-loader.js:4-5` 明确称凭据内置 | P0 | 凭据被第三方使用、配额耗尽、账号封禁、费用或合规责任 | 视为已泄露；在高德控制台撤销/轮换；禁止复制到新系统；Static Pages 默认禁用需要秘密凭据的能力；如未来启用，必须走安全网关 | Phase 0 / Provider 引入前 | **阻塞高德 Provider 和生产动态服务**；不阻塞静态领域核心 | Open，已通过架构隔离降低扩散风险 |
| R-002 | 构建修改 canonical/source：基线 Actions 实测修改 `MIGRATION_V2.2.json`、`MIGRATION_V2.3.json`、`scripts/migrate-v2.3.mjs` | P1 | 相同提交多次构建结果或工作区状态不同；CI 可能自动提交意外变化 | 新核心构建只读取手写源码；迁移工具从 build 中移出；生成物进入明确 `generated/`；CI 构建后执行 `git diff --exit-code` | Phase 1 | **阻塞新核心构建链** | Open |
| R-003 | `.github/workflows/build-v2.yml:48-50` 固定 checkout `agent/v2.4.0-context-services-risk` | P1 | PR 触发时可能测试旧分支，不是被审查代码 | 新 CI 使用默认 checkout 当前事件 SHA；增加测试 SHA 输出和 PR head 断言 | Phase 0/1 | **阻塞旧 workflow 作为新门禁** | Open |
| R-004 | `.github/workflows/build-v2.yml:58-68` 在 CI 内 commit/push 生成物 | P1 | 验证工作流越权修改仓库；循环触发；审查与构建结果错位 | 验证 CI 只读；发布工作流单独授权并只发布 artifact/Pages；禁止自动回写源码 | Phase 1 | 阻塞新发布流程 | Open |
| R-005 | `package-lock.json` 未提交，基线使用 `npm install` | P1 | 依赖解析随时间变化，基线不可完全复现 | 新 workspace 提交 lockfile；CI 使用 `npm ci`；依赖升级走独立 PR | Phase 1 | 阻塞“确定性安装”门禁 | Open |
| R-006 | 大量 `window.*`/`globalThis.*`；`src-v2/core/app-state.js:47` 暴露整个上下文 | P1 | 隐式依赖、测试隔离困难、并发修改污染、React 迁移困难 | 新建纯 TypeScript `domain`、`planner`；通过构造参数和接口注入；旧版只作为 legacy app | Phase 1 | 阻塞直接复用旧运行时 | Open |
| R-007 | Provider 与 DOM 混合：`src-v2/services/search-service.js:6-46`；天气服务直接写 DOM | P1 | 服务无法独立测试；UI 变更破坏网络层；错误降级不可预测 | Provider 只返回规范化结果；React feature/controller 决定渲染；增加 contract test | Phase 1/2 | 阻塞正式 Provider 接入 | Open |
| R-008 | `amapWebRequest` 对所有 fetch 错误统一回退 JSONP：`src-v2/services/search-service.js:38-40` | P1 | 鉴权/配额/参数错误也被重复请求；CSP 和安全面扩大 | 移除自动 JSONP；建立 timeout、AbortSignal、错误分类和有限重试策略 | Phase 1/2 | 阻塞高德 Provider 复用 | Open |
| R-009 | Schema 固定青岛旅行：`scripts/validate-data-schema.mjs:11-24` 固定版本、日期、8 天和现有 JS 常量 | P1 | 无法表示跨国、多时区、任意日期或多目的地 | Zod + JSON Schema 建立 Place/PlanningUnit/POI/TripRequest/TripPlan/SourceRef | Phase 1 | **阻塞全球数据模型** | Open |
| R-010 | 固定年份、时区和城市：`TRIP_YEAR='2026'`、`Asia/Shanghai`、`AMAP_CITY='青岛'`、`AMAP_ADCODE='370200'` | P1 | 跨时区日期丢失、天气错日、搜索被限制在错误城市 | 使用 IANA timezone；日期时间保留 offset/zone；地点配置来自 Place；Provider 接收明确 context | Phase 1 | **阻塞多目的地规划** | Open |
| R-011 | `runSelfCheck` 将坐标限制在青岛 bbox：`src-v2/core/app-state.js:26` | P1 | 海外 POI 或其他中国城市被误判非法 | 领域坐标只校验全球经纬度；目的地 bbox 作为可选业务校验 | Phase 1 | 阻塞全球 POI | Open |
| R-012 | 交通方式与体力风险依赖中文关键词和直线距离阈值：`src-v2/services/risk-metrics-service.js:11-20` | P1 | 不同语言或城市下错误判定；直线估算可能被误读为路线 | TravelLeg 显式建模；估算引擎输出 method/confidence；不能把 Haversine 当实际路程 | Phase 1 | 阻塞规划不变量和可信解释 | Open |
| R-013 | LocalStorage key 跨多代且分散：`src-v2/state/local-data-manager.js:6-16` | P2 | 升级时状态丢失、重复或静默损坏 | Share/Storage schemaVersion；迁移注册表；纯函数迁移；原数据备份；失败回退 | Phase 2 | 阻塞正式旧状态迁移，不阻塞 fixture | Open |
| R-014 | 多处存储异常被静默吞掉：`src-v2/core/app-state.js:21-22`、`preferences.js:7-16` | P2 | 用户以为状态已保存，实际失败；无法诊断 | 统一 StorageAdapter；返回 typed result；用户可见降级提示；日志去敏 | Phase 2 | 不阻塞纯核心 | Open |
| R-015 | Service Worker 将任意同源 GET 失败回退到 `index.html`：`src-v2/service-worker.js:22-25` | P1 | JS/CSS/JSON 请求得到 HTML；离线更新异常；错误缓存 | 仅 navigation fallback；资产 cache-first/stale-while-revalidate；API 不缓存或按 Provider 策略；缓存版本迁移 | Phase 2 | 阻塞新 Pages 离线能力 | Open |
| R-016 | SW activate 立即删除所有旧 `travel-plans-*` 缓存：`service-worker.js:21` | P2 | 新版本损坏时丢失可用缓存；升级不可回滚 | 双版本保留窗口；激活成功后清理；缓存 manifest 和 rollback 测试 | Phase 2 | 不阻塞初始无 SW 闭环 | Open |
| R-017 | 根 README 称 v1.0.0，package/build 为 v2.4.0 | P1 | 发布身份、缓存和文档不一致 | 单一 version module；生成 manifest/SW/UI version；CI 对 README/tag/package 检查 | Phase 1 | 阻塞正式发布 | Open |
| R-018 | 当前 visual 测试保存截图但没有 `toHaveScreenshot()`：`tests/v2-visual.spec.js` | P2 | 视觉回归无法自动判定 | 建立可审查的稳定基线图；控制字体/动画/时区；按设备单独快照 | Phase 2 | 不阻塞 planner | Open |
| R-019 | E2E 阻断所有非本地网络，地图成功路径未验证：`tests/v2-visual.spec.js:5-13` | P2 | 只能证明降级页面和布局；实际 Leaflet/AMap 加载可能失败 | MapAdapter fixture 成功路径；本地假瓦片；部署 smoke；第三方真实服务仅做受控人工/定期测试 | Phase 2 | 阻塞“地图展示已验证”的完成声明 | Open |
| R-020 | 只有 build/validate/e2e 三个 package scripts | P1 | 缺少 lint、typecheck、unit、invariant、provider contract、secret scan | 新 workspace 一次建立完整命令和 CI 顺序 | Phase 1/2 | **阻塞第一阶段完成定义** | Open |
| R-021 | `TravelServiceResult` 无 stale/unavailable/错误分类：`src-v2/services/service-result.js` | P2 | 过期或不可用数据仍可能被当作成功数据 | ProviderResult 增加 status、errorKind、observedAt、expiresAt、stale、capabilities | Phase 1 | 阻塞动态观察值正式展示 | Open |
| R-022 | 当前 Source 只保证名称/URL，缺少 license、审核和新鲜度 | P2 | 数据虽有链接但不能证明授权或当前有效 | SourceRef 标准化；DynamicObservation；人工审核状态；数据 lint | Phase 1/数据迁移 | 阻塞旧数据直接升级为生产数据 | Open |
| R-023 | 公共瓦片服务条款与生产流量未逐项核对 | P1 | 违反 tile usage policy、限流或服务中断 | Provider capability/attribution；缓存限制；生产前确认服务条款或自有瓦片方案 | Phase 2 | 阻塞正式全球发布，不阻塞 fixture | Open |
| R-024 | Pages workflow 只验证 payload，不验证实际子路径：`.github/workflows/validate-pages-payload.yml` | P1 | 根路径可用但 `/Global-travel-plans/` 资源 404；SW scope 错误 | Vite `base`；本地 base-path server；部署后浏览器 smoke；404/刷新测试 | Phase 2 | 阻塞 GitHub Pages 完成定义 | Open |
| R-025 | 单文件压缩载荷和多代迁移脚本继续增长 | P2 | 调试、tree-shaking、缓存、依赖分析和局部回滚困难 | 历史版冻结；新系统采用 Vite chunk；版本发布以 artifact 为单位 | Phase 1 | 不阻塞旧版，阻塞新核心沿用旧构建 | Open |
| R-026 | 旧 workflow 数量多，部分只监听旧 agent 分支 | P3 | 维护者难判断哪些仍生效；无效 CI 占用配额 | 建立 workflow inventory；历史 workflow 明确 archive/disabled；新 CI 独立命名 | Phase 3 | 否 | Open |
| R-027 | 青岛现有酒店/价格/天气可能被误认为全球实时数据 | P1 | 用户基于过期或演示数据做消费决定 | 旧数据标记 legacy/fixture；具体酒店只来自授权 Provider、人工审核或用户输入；过期观察值必须提示 | Phase 1/2 | 阻塞新 UI 对外宣称实时 | Open |
| R-028 | Planner 尚不存在，当前行程是手工固定 SCHEDULES | P1 | 无法证明不重叠、TravelLeg、锁定项、跨时区等不变量 | 建立确定性 planner、seed、invariant validator 和属性测试 | Phase 1 | **阻塞最小纵向闭环** | Open |

## 风险处置顺序

1. **隔离 R-001**：旧版保留，但新核心不得引用旧凭据。
2. **解决 R-002、R-005、R-009、R-010、R-020、R-028**：建立可复现的纯核心和 CI。
3. **解决 R-006、R-007、R-008、R-021**：形成真正 Provider 边界。
4. **解决 R-013 至 R-016、R-018、R-019、R-024**：完成浏览器、离线和 Pages 发布验证。
5. 生产发布前解决 R-022、R-023、R-027。

## 停止条件映射

当前没有触发需要停止所有工作的条件：

- 历史导入完整，未覆盖目标已有代码。
- 基线命令已通过，且构建修改问题已查明并登记。
- 旧青岛数据和稳定回退仍存在。
- 公共凭据可以通过“不复制到新系统、禁用秘密 Provider”安全隔离。

但在以下条件满足前，不得宣称第一阶段完成：

- R-001 的旧凭据已由仓库所有者在服务商控制台撤销或轮换；
- 新 planner 全部核心不变量通过；
- 新 Pages base-path 和 Provider 失败降级通过；
- 新系统没有前端秘密凭据；
- CI 门禁全部建立并通过。
