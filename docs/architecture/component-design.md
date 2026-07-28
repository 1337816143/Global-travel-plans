# Component Design

## 1. `packages/domain`

### 1.1 Place

```ts
interface Place {
  id: string;
  names: Record<string, string>;
  type: PlaceType;
  parentId?: string;
  countryCode?: string;
  adminLevel?: number;
  coordinates: Wgs84Coordinate;
  bbox?: BoundingBox;
  timezoneIds: string[];
  currencies: string[];
  languages: string[];
  sourceRefs: string[];
  schemaVersion: number;
}
```

组件：

- `place.ts`：类型和 PlaceType；
- `coordinate.ts`：WGS84、bbox 和距离估算语义；
- `localized-text.ts`：多语言文本；
- `timezone.ts`：IANA timezone value object；
- `currency.ts`：ISO 4217 code；
- `source-ref.ts`：来源和审核元数据。

### 1.2 POI 与规划单元

组件：

- `poi.ts`：开放时间、时长、预约、体力、室内外、无障碍、天气适配；
- `planning-unit.ts`：城市、区域、岛屿、景区或 POI 集群；
- `opening-hours.ts`：结构化周规则和例外；
- `dynamic-observation.ts`：observedAt/expiresAt/stale；
- `uncertainty.ts`：missing/estimated/reviewed/verified。

### 1.3 TripRequest

组件：

- `trip-request.ts`；
- `traveler-constraints.ts`；
- `locked-activity.ts`；
- `transport-preference.ts`；
- `accommodation-preference.ts`。

TripRequest 只描述用户意图，不包含 UI 控件状态或 Provider 原始响应。

### 1.4 TripPlan

组件：

- `trip-plan.ts`；
- `trip-day.ts`；
- `activity.ts`；
- `travel-leg.ts`；
- `accommodation-stay.ts`；
- `planning-conflict.ts`；
- `planning-assumption.ts`；
- `freshness-summary.ts`。

每个计划包含：

- plannerVersion；
- inputSchemaVersion；
- dataVersion；
- seed；
- sourceRefs；
- unresolvedConflicts；
- degradation messages。

## 2. `packages/data-schema`

组件：

- `schemas/place.schema.ts`；
- `schemas/poi.schema.ts`；
- `schemas/trip-request.schema.ts`；
- `schemas/trip-plan.schema.ts`；
- `schemas/source-ref.schema.ts`；
- `json-schema/export.ts`；
- `validation/validate-dataset.ts`；
- `migration/share-migrations.ts`；
- `legacy/qingdao-v2.4-importer.ts`。

设计规则：

1. Zod schema 是 runtime validation 的唯一来源。
2. TypeScript 类型优先从 schema 推导，避免重复定义漂移。
3. JSON Schema 从同一 schema 生成。
4. importer 只接受明确 legacy version。
5. 校验错误包含 JSON path、error code 和可读信息。

## 3. `packages/planner`

### 3.1 Pipeline Orchestrator

`planTrip(context): TripPlan`

输入：

```ts
interface PlannerContext {
  request: TripRequest;
  catalog: PlanningCatalog;
  travelTimeMatrix: TravelTimeMatrix;
  plannerVersion: string;
  dataVersion: string;
  seed: number;
  clock: PlannerClock;
}
```

组件：

- `pipeline/normalize.ts`；
- `pipeline/resolve-constraints.ts`；
- `pipeline/allocate-destination-days.ts`；
- `pipeline/cluster-pois.ts`；
- `pipeline/schedule-days.ts`；
- `pipeline/insert-travel-legs.ts`；
- `pipeline/insert-breaks.ts`；
- `pipeline/accommodation.ts`；
- `pipeline/conflicts.ts`；
- `pipeline/explain.ts`；
- `pipeline/validate-plan.ts`。

### 3.2 Deterministic Tie Breaker

- 所有候选排序使用稳定 sort。
- 分数相同才使用 seed 派生值。
- 禁止使用未注入的 `Math.random()`。
- 禁止读取本机 locale/current timezone 影响结果。

### 3.3 Invariant Validator

`validateTripPlan(plan, context)` 返回结构化 violation，不直接修改计划。

每条 violation：

```ts
interface InvariantViolation {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
  relatedIds: string[];
}
```

### 3.4 Replanner

`replanTrip(previousPlan, edits, context)`：

- 将拖拽和锁定转换成新 TripRequest constraints；
- 冻结锁定 Activity 和相关 TravelLeg 边界；
- 只重算受影响日期/目的地区间；
- 最终仍执行全部不变量验证；
- 无法保留编辑时产生明确冲突，不静默删除锁定项。

## 4. `packages/providers`

### 4.1 Registry

```ts
interface ProviderRegistry {
  geocoding?: GeocodingProvider;
  routing?: RoutingProvider;
  weather?: WeatherProvider;
  openingHours?: OpeningHoursProvider;
  currency?: CurrencyProvider;
  // ...
}
```

Registry 由应用启动时创建，Planner 不读取 Registry。

### 4.2 Base Components

- `provider-capability.ts`；
- `provider-result.ts`；
- `provider-error.ts`；
- `cache-policy.ts`；
- `timeout.ts`；
- `fixtures/`；
- `null-providers/`。

### 4.3 Enrichment Coordinator

UI 可在基础计划生成后调用：

```text
TripPlan
  -> collect enrichment requests
  -> Provider Registry
  -> normalize observations
  -> attach as optional view model
```

Provider enrichment 不直接修改经验证的 Activity 时间。若新数据证明开放时间冲突，系统产生 `replanSuggestion`，由用户触发重新规划。

## 5. `packages/map-adapters`

### 5.1 Contract

```ts
interface MapAdapter {
  readonly id: string;
  mount(container: HTMLElement, options: MapMountOptions): Promise<void>;
  render(model: MapRenderModel): void;
  fitBounds(bounds: BoundingBox): void;
  select(featureId: string | null): void;
  resize(): void;
  destroy(): void;
}
```

### 5.2 Render Model

MapAdapter 只接收统一 WGS84 render model：

```ts
interface MapRenderModel {
  markers: MapMarker[];
  paths: MapPath[];
  selectedId?: string;
  bounds?: BoundingBox;
}
```

Leaflet 实现直接使用 WGS84。未来 AMap 实现在 adapter 内转换为 GCJ-02。

### 5.3 Components

- `contract/map-adapter.ts`；
- `model/map-render-model.ts`；
- `leaflet/leaflet-map-adapter.ts`；
- `fixtures/memory-map-adapter.ts`；
- `coordinates/wgs84-gcj02.ts`。

## 6. `apps/web`

### 6.1 Pages

- `/`：Global planner；
- `/plan/:shareId?`：计划编辑和展示；
- `/sources`：来源和数据状态；
- `/legacy/qingdao-v2.4/`：旧版入口；
- `/about`：能力、限制和免责声明。

第一阶段分享使用 JSON 文件/剪贴板，不依赖服务端 shareId。

### 6.2 Features

- `features/trip-request`；
- `features/itinerary`；
- `features/map`；
- `features/replanning`；
- `features/accommodation-area`；
- `features/sources`；
- `features/share`；
- `features/print`；
- `features/provider-status`；
- `features/language`。

### 6.3 Stores

Store 保存：

- 当前 TripRequest；
- 当前 TripPlan；
- 用户编辑/锁定；
- UI selection；
- Provider 状态和 observations。

Store 不保存：

- Provider SDK 对象；
- 地图实例；
- DOM 节点；
- 未规范化 HTTP 响应；
- 秘密凭据。

## 7. 横切组件

### 7.1 Version Metadata

单一版本来源生成：

- package version；
- app build metadata；
- share schema；
- data manifest；
- SW cache id；
- UI version；
- release manifest。

### 7.2 Logging

- 开发：结构化 console logger；
- 生产：默认不上传用户行程；
- Provider 错误去除 key、完整 URL 查询和个人位置；
- 用户可导出诊断摘要。

### 7.3 Accessibility

- 键盘完成表单、活动锁定、重新排序替代操作；
- 拖拽必须有按钮式上移/下移；
- 地图不是唯一信息通道；
- 冲突和状态使用文本，不只使用颜色。
