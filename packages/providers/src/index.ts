import type {
  BoundingBox,
  CurrencyCode,
  DynamicObservation,
  LocalDate,
  PlaceType,
  SourceRef,
  TimezoneId,
  TravelMode,
  TravelTimeMatrix,
  Wgs84Coordinate,
} from '@global-travel-plans/domain';

export type ProviderStatus = 'success' | 'stale' | 'unavailable' | 'error';
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

export interface ProviderFailure {
  kind: ProviderErrorKind;
  message: string;
  retryable: boolean;
  statusCode?: number;
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
  error?: ProviderFailure;
  degradation?: string;
}

export interface ProviderRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  locale?: string;
  currency?: CurrencyCode;
}

export interface Provider {
  readonly id: string;
  capabilities(): ProviderCapability[];
  health?(options?: ProviderRequestOptions): Promise<ProviderResult<{ healthy: boolean }>>;
}

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
  sourceRefs: string[];
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
  durationMinutes: number;
  distanceMeters?: number;
  geometry?: Wgs84Coordinate[];
  method: 'provider-route' | 'schedule' | 'estimate';
  confidence: 'high' | 'medium' | 'low';
  sourceRefs: string[];
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
  originTimezone: TimezoneId;
  destinationTimezone: TimezoneId;
  modes: TravelMode[];
  reservationRequired?: boolean;
  sourceRefs: string[];
}

export interface TransitProvider extends Provider {
  search(
    query: TransitQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<TransitOption[]>>;
}

export interface WeatherQuery {
  coordinate: Wgs84Coordinate;
  timezoneId: TimezoneId;
  startDate: LocalDate;
  endDate: LocalDate;
}

export interface WeatherObservation {
  localDate: LocalDate;
  timezoneId: TimezoneId;
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

export interface PoiCandidate {
  providerPlaceId: string;
  names: Record<string, string>;
  coordinates: Wgs84Coordinate;
  categories: string[];
  sourceRefs: string[];
}

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

export interface OpeningHoursObservation {
  timezoneId: TimezoneId;
  observedAt: string;
  expiresAt?: string;
  rules: Array<{ localDate: LocalDate; windows: Array<{ start: string; end: string }> }>;
  uncertainty: 'verified' | 'reviewed' | 'estimated' | 'missing';
  sourceRefs: string[];
}

export interface OpeningHoursProvider extends Provider {
  getOpeningHours(
    poiId: string,
    dateRange: { startDate: LocalDate; endDate: LocalDate },
    timezoneId: TimezoneId,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<OpeningHoursObservation>>;
}

export interface AccommodationSearchQuery {
  area: BoundingBox | string;
  checkIn: LocalDate;
  checkOut: LocalDate;
  guests: number;
  currency: CurrencyCode;
  budget?: { min?: number; max?: number };
}

export interface AccommodationObservation {
  providerPropertyId: string;
  name: string;
  areaLabel: string;
  coordinates?: Wgs84Coordinate;
  price?: DynamicObservation<number>;
  rating?: DynamicObservation<number>;
  availability?: DynamicObservation<'available' | 'unavailable' | 'unknown'>;
  sourceRefs: string[];
}

export interface AccommodationProvider extends Provider {
  search(
    query: AccommodationSearchQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<AccommodationObservation[]>>;
}

export interface ExchangeRateObservation {
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number;
  observedAt: string;
  sourceRefs: string[];
}

export interface CurrencyProvider extends Provider {
  getRates(
    base: CurrencyCode,
    quotes: CurrencyCode[],
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<ExchangeRateObservation[]>>;
}

export interface VisaQuery {
  passportCountryCode: string;
  destinationCountryCode: string;
  travelDate: LocalDate;
}

export interface VisaObservation {
  summary: Record<string, string>;
  observedAt: string;
  expiresAt?: string;
  officialSourceRefs: string[];
}

export interface VisaInformationProvider extends Provider {
  getRequirements(
    query: VisaQuery,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResult<VisaObservation[]>>;
}

export interface ExportProvider extends Provider {
  exportJson(value: unknown, options?: ProviderRequestOptions): Promise<ProviderResult<string>>;
}

export interface ProviderRegistry {
  geocoding?: GeocodingProvider;
  routing?: RoutingProvider;
  transit?: TransitProvider;
  weather?: WeatherProvider;
  places?: PlaceProvider;
  openingHours?: OpeningHoursProvider;
  accommodation?: AccommodationProvider;
  currency?: CurrencyProvider;
  visa?: VisaInformationProvider;
  export?: ExportProvider;
}

export function providerSuccess<T>(
  providerId: string,
  capabilityId: string,
  data: T,
  metadata: {
    sourceRefs?: string[];
    observedAt?: string;
    expiresAt?: string;
    cached?: boolean;
    stale?: boolean;
  } = {},
): ProviderResult<T> {
  const stale = metadata.stale ?? false;
  return {
    status: stale ? 'stale' : 'success',
    data,
    providerId,
    capabilityId,
    sourceRefs: metadata.sourceRefs ?? [],
    ...(metadata.observedAt ? { observedAt: metadata.observedAt } : {}),
    ...(metadata.expiresAt ? { expiresAt: metadata.expiresAt } : {}),
    stale,
    cached: metadata.cached ?? false,
  };
}

export function providerUnavailable<T>(
  providerId: string,
  capabilityId: string,
  reason: string,
): ProviderResult<T> {
  return {
    status: 'unavailable',
    data: null,
    providerId,
    capabilityId,
    sourceRefs: [],
    stale: false,
    cached: false,
    error: { kind: 'unsupported', message: reason, retryable: false },
    degradation: reason,
  };
}

export function providerError<T>(
  providerId: string,
  capabilityId: string,
  failure: ProviderFailure,
): ProviderResult<T> {
  return {
    status: 'error',
    data: null,
    providerId,
    capabilityId,
    sourceRefs: [],
    stale: false,
    cached: false,
    error: failure,
  };
}

export function classifyProviderError(error: unknown): ProviderFailure {
  if (isAbortError(error)) {
    return { kind: 'aborted', message: 'Request was aborted.', retryable: false };
  }
  if (error instanceof ProviderTimeoutError) {
    return { kind: 'timeout', message: error.message, retryable: true };
  }
  if (error instanceof Error) {
    return { kind: 'provider-error', message: error.message, retryable: false };
  }
  return { kind: 'provider-error', message: 'Unknown provider error.', retryable: false };
}

export class ProviderTimeoutError extends Error {
  override readonly name = 'ProviderTimeoutError';
}

export async function withProviderTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: ProviderRequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onAbort, { once: true });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new ProviderTimeoutError(`Provider request timed out after ${timeoutMs} ms.`));
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (timedOut) throw new ProviderTimeoutError(`Provider request timed out after ${timeoutMs} ms.`);
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export class UnavailableWeatherProvider implements WeatherProvider {
  readonly id = 'unavailable-weather';

  constructor(private readonly reason = 'Weather provider is unavailable in static-only mode.') {}

  capabilities(): ProviderCapability[] {
    return [
      {
        id: 'weather.forecast',
        available: false,
        reason: this.reason,
        requiresSecret: false,
        supportsBrowser: true,
        supportsOfflineFixture: true,
      },
    ];
  }

  async forecast(): Promise<ProviderResult<WeatherObservation[]>> {
    return providerUnavailable(this.id, 'weather.forecast', this.reason);
  }
}

export class FixtureWeatherProvider implements WeatherProvider {
  readonly id = 'fixture-weather';

  constructor(
    private readonly observations: WeatherObservation[],
    private readonly metadata: {
      observedAt: string;
      expiresAt?: string;
      sourceRefs: string[];
    },
  ) {}

  capabilities(): ProviderCapability[] {
    return [
      {
        id: 'weather.forecast',
        available: true,
        requiresSecret: false,
        supportsBrowser: true,
        supportsOfflineFixture: true,
        attribution: 'Fixture data only',
      },
    ];
  }

  async forecast(
    query: WeatherQuery,
    options: ProviderRequestOptions = {},
  ): Promise<ProviderResult<WeatherObservation[]>> {
    try {
      return await withProviderTimeout(async (signal) => {
        signal.throwIfAborted();
        const selected = this.observations.filter(
          (item) =>
            item.timezoneId === query.timezoneId &&
            item.localDate >= query.startDate &&
            item.localDate <= query.endDate,
        );
        return providerSuccess(this.id, 'weather.forecast', selected, {
          sourceRefs: this.metadata.sourceRefs,
          observedAt: this.metadata.observedAt,
          ...(this.metadata.expiresAt ? { expiresAt: this.metadata.expiresAt } : {}),
        });
      }, options);
    } catch (error) {
      return providerError(this.id, 'weather.forecast', classifyProviderError(error));
    }
  }
}

export class BrowserJsonExportProvider implements ExportProvider {
  readonly id = 'browser-json-export';

  capabilities(): ProviderCapability[] {
    return [
      {
        id: 'export.json',
        available: true,
        requiresSecret: false,
        supportsBrowser: true,
        supportsOfflineFixture: true,
      },
    ];
  }

  async exportJson(value: unknown): Promise<ProviderResult<string>> {
    return providerSuccess(this.id, 'export.json', JSON.stringify(value, null, 2));
  }
}

export function collectCapabilities(registry: ProviderRegistry): ProviderCapability[] {
  return Object.values(registry)
    .filter((provider): provider is Provider => Boolean(provider))
    .flatMap((provider) => provider.capabilities())
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function resolveSourceRefs(
  ids: string[],
  sources: SourceRef[],
): SourceRef[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return ids.flatMap((id) => {
    const source = sourceById.get(id);
    return source ? [source] : [];
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
