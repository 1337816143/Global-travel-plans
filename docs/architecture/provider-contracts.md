# Provider Contracts

## 1. 设计原则

1. Provider 是可选依赖，不是 Planner 的隐式网络层。
2. 每个 Provider 明确 capability、输入、输出、来源、缓存和错误。
3. 所有调用支持 timeout 和 `AbortSignal`。
4. 原始响应必须在 Provider 内转换成领域 DTO。
5. Provider 失败不得返回伪造数据。
6. 鉴权失败不得切换 JSONP 或无限重试。
7. Static Pages 中无法安全配置的 Provider 返回 unavailable。

## 2. 基础类型

```ts
export type ProviderStatus =
  | 'success'
  | 'stale'
  | 'unavailable'
  | 'error';

export type ProviderErrorKind =
  | 'aborted'
  | 'timeout'
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'quota'
  | 'rate-limit'
  | 'invalid-request'
  | 'not-found'
  | 'unsupported'
  | 'provider-error'
  | 'invalid-response';

export interface ProviderCapability {
  id: string;
  available: boolean;
  reason?: string;
  requiresSecret: boolean;
  supportsBrowser: boolean;
  supportsOfflineFixture: boolean;
  attribution?: string;
}

export interface ProviderResult<T> {
  status: ProviderStatus;
  data: T | null;
  providerId: string;
  capabilityId: string;
  sourceRefs: string[];
  observedAt?: string;
  expiresAt?: string;
  stale: boolean;
  cached: boolean;
  error?: {
    kind: ProviderErrorKind;
    message: string;
    retryable: boolean;
    statusCode?: number;
  };
  degradation?: string;
}

export interface ProviderRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  locale?: string;
  currency?: string;
}
```

## 3. Base Provider

```ts
export interface Provider {
  readonly id: string;
  capabilities(): ProviderCapability[];
  health?(
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<{ healthy: boolean }>>;
}
```

`health` 不能在每次页面加载自动高频调用。

## 4. GeocodingProvider

```ts
export interface GeocodingQuery {
  text: string;
  near?: Wgs84Coordinate;
  countryCodes?: string[];
  limit?: number;
}

export interface GeocodingCandidate {
  id: string;
  names: Record<string, string>;
  coordinates: Wgs84Coordinate;
  bbox?: BoundingBox;
  countryCode?: string;
  placeType?: PlaceType;
  confidence?: number;
}

export interface GeocodingProvider extends Provider {
  geocode(
    query: GeocodingQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<GeocodingCandidate[]>>;

  reverseGeocode(
    coordinate: Wgs84Coordinate,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<GeocodingCandidate[]>>;
}
```

## 5. RoutingProvider

```ts
export type TravelMode =
  | 'walk'
  | 'bike'
  | 'drive'
  | 'taxi'
  | 'transit'
  | 'rail'
  | 'flight'
  | 'ferry'
  | 'mixed';

export interface RouteRequest {
  origin: Wgs84Coordinate;
  destination: Wgs84Coordinate;
  mode: TravelMode;
  departureAt?: string;
  locale?: string;
}

export interface RouteObservation {
  origin: Wgs84Coordinate;
  destination: Wgs84Coordinate;
  mode: TravelMode;
  distanceMeters?: number;
  durationMinutes: number;
  geometry?: Wgs84Coordinate[];
  method: 'provider-route' | 'schedule' | 'estimate';
  confidence: 'high' | 'medium' | 'low';
}

export interface RoutingProvider extends Provider {
  route(
    request: RouteRequest,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<RouteObservation>>;

  matrix?(
    coordinates: Wgs84Coordinate[],
    mode: TravelMode,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<TravelTimeMatrix>>;
}
```

RoutingProvider 必须将任何 GCJ-02 结果转换回 WGS84，再返回领域层。

## 6. TransitProvider

```ts
export interface TransitQuery {
  originPlaceId: string;
  destinationPlaceId: string;
  departureAfter?: string;
  arriveBefore?: string;
}

export interface TransitOption {
  id: string;
  departureAt: string;
  arrivalAt: string;
  originTimezone: string;
  destinationTimezone: string;
  legs: TransitLegObservation[];
  reservationRequired?: boolean;
}

export interface TransitProvider extends Provider {
  search(
    query: TransitQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<TransitOption[]>>;
}
```

第一阶段可以只提供 fixture/null implementation。

## 7. WeatherProvider

```ts
export interface WeatherQuery {
  coordinate: Wgs84Coordinate;
  timezoneId: string;
  startDate: string;
  endDate: string;
}

export interface WeatherObservation {
  localDate: string;
  timezoneId: string;
  temperatureMinC?: number;
  temperatureMaxC?: number;
  apparentTemperatureMaxC?: number;
  precipitationProbabilityMax?: number;
  weatherCode?: string;
}

export interface WeatherProvider extends Provider {
  forecast(
    query: WeatherQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<WeatherObservation[]>>;
}
```

超出可靠预报范围时返回 unavailable 或空 observation，并说明原因，不能生成远期伪预测。

## 8. PlaceProvider

```ts
export interface PlaceSearchQuery {
  text?: string;
  bounds?: BoundingBox;
  categories?: string[];
  locale?: string;
  limit?: number;
}

export interface PlaceProvider extends Provider {
  search(
    query: PlaceSearchQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<PoiCandidate[]>>;

  details(
    providerPlaceId: string,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<PoiCandidate>>;
}
```

Provider place ID 不得作为系统 POI ID。正式 POI 需要 namespace 和 SourceRef 审核。

## 9. OpeningHoursProvider

```ts
export interface OpeningHoursQuery {
  poi: PoiIdentity;
  dateRange: DateRange;
  timezoneId: string;
}

export interface OpeningHoursProvider extends Provider {
  getOpeningHours(
    query: OpeningHoursQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<OpeningHoursObservation>>;
}
```

开放时间观察值不能无期限缓存。节假日例外缺失时必须标记 uncertainty。

## 10. AccommodationProvider

```ts
export interface AccommodationSearchQuery {
  area: BoundingBox | string;
  checkIn: string;
  checkOut: string;
  guests: number;
  currency: string;
  budget?: MoneyRange;
}

export interface AccommodationProvider extends Provider {
  search(
    query: AccommodationSearchQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<AccommodationObservation[]>>;
}
```

第一阶段默认使用 `UnavailableAccommodationProvider`。UI 文案固定为：

> 当前仅推荐住宿区域，具体酒店价格、评分和库存需在预订平台复核。

## 11. CurrencyProvider

```ts
export interface ExchangeRateObservation {
  base: string;
  quote: string;
  rate: number;
  observedAt: string;
}

export interface CurrencyProvider extends Provider {
  getRates(
    base: string,
    quotes: string[],
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<ExchangeRateObservation[]>>;
}
```

预算核心保留原始货币和换算观察值，不因汇率更新改写用户原始输入。

## 12. VisaInformationProvider

签证信息属于高风险、强时效信息。第一阶段只定义接口：

```ts
export interface VisaInformationProvider extends Provider {
  getRequirements(
    query: VisaQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<VisaObservation[]>>;
}
```

生产启用前必须单独确认官方来源、法律免责声明、更新时间和国家/护照组合。默认 null Provider。

## 13. MapProvider 与 ExportProvider

地图渲染使用 `MapAdapter`，不与搜索/路线 Provider 混为一个接口。

ExportProvider 第一阶段只有浏览器实现：

- share JSON；
- print model；
- browser print/PDF。

不得声称生成服务端签名 PDF。

## 14. Timeout 与取消

统一 helper：

```ts
withTimeout(signal, timeoutMs, operation)
```

规则：

- 默认 timeout 由 capability 定义；
- 用户修改输入时取消旧请求；
- AbortError 归类为 `aborted`，不显示为服务故障；
- timeout 只允许有限重试，默认 0 次；
- rate-limit 根据 Retry-After 决定是否允许用户手动重试。

## 15. Cache 与 stale

Cache key 必须包含：

- provider ID；
- capability ID；
- normalized request；
- provider schema version；
- locale/currency/timezone（如影响结果）。

缓存命中后：

- `now <= expiresAt`：success；
- `expiresAt < now <= staleUntil`：stale，可显示并后台刷新；
- 超过 staleUntil：不作为可用事实返回。

## 16. Fixture 与 Null Provider

每个接口至少提供：

- success fixture；
- empty fixture；
- stale fixture；
- timeout fixture；
- authentication fixture；
- unavailable/null provider。

Provider 全部使用 null implementation 时，静态行程生成和浏览必须通过。

## 17. 日志和秘密

Provider 日志必须删除：

- query 中的 key/token/signature；
- Authorization header；
- 用户精确定位（默认只保留粗粒度或 hash）；
- 完整第三方原始响应；
- 个人预订信息。

`.env.example` 只写变量名和用途，不含真实值。浏览器环境变量即使以 Vite 前缀暴露，也不能用来存放秘密。
