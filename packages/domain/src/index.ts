export type LocaleCode = string;
export type CurrencyCode = string;
export type TimezoneId = string;
export type LocalDate = string;
export type LocalTime = string;
export type LocalizedText = Record<LocaleCode, string>;

export type PlaceType =
  | 'continent'
  | 'country'
  | 'admin1'
  | 'admin2'
  | 'locality'
  | 'district'
  | 'island'
  | 'scenicArea'
  | 'customArea';

export interface Wgs84Coordinate {
  lat: number;
  lng: number;
}

export type BoundingBox = [west: number, south: number, east: number, north: number];

export interface SourceRef {
  id: string;
  title: string;
  url: string;
  publisher?: string;
  sourceType: 'official' | 'map' | 'booking-platform' | 'social' | 'manual-review';
  retrievedAt: string;
  reviewedAt?: string;
  reviewer?: string;
  confidence: 'high' | 'medium' | 'low';
  licenseNotes?: string;
}

export interface DynamicObservation<T> {
  value: T;
  provider: string;
  observedAt: string;
  expiresAt?: string;
  currency?: CurrencyCode;
  sourceUrl?: string;
  sourceRefs: string[];
}

export interface Place {
  id: string;
  names: LocalizedText;
  type: PlaceType;
  parentId?: string;
  countryCode?: string;
  adminLevel?: number;
  coordinates: Wgs84Coordinate;
  bbox?: BoundingBox;
  timezoneIds: TimezoneId[];
  currencies: CurrencyCode[];
  languages: LocaleCode[];
  sourceRefs: string[];
  schemaVersion: number;
}

export interface RecommendedDays {
  min: number;
  ideal: number;
  max: number;
}

export interface PlanningUnit {
  id: string;
  placeId: string;
  names: LocalizedText;
  recommendedDays: RecommendedDays;
  poiIds: string[];
  transportNotes: LocalizedText;
  customs: LocalizedText[];
  safetyNotes: LocalizedText[];
  accommodationScore?: number;
  sourceRefs: string[];
}

export interface TimeWindow {
  start: LocalTime;
  end: LocalTime;
}

export interface OpeningHoursRule {
  daysOfWeek: number[];
  windows: TimeWindow[];
}

export interface OpeningHours {
  timezoneId: TimezoneId;
  weekly: OpeningHoursRule[];
  exceptions?: Record<LocalDate, TimeWindow[]>;
  uncertainty: 'verified' | 'reviewed' | 'estimated' | 'missing';
}

export interface Poi {
  id: string;
  placeId: string;
  planningUnitId: string;
  names: LocalizedText;
  coordinates: Wgs84Coordinate;
  categories: string[];
  recommendedDurationMinutes: { min: number; ideal: number; max: number };
  openingHours?: OpeningHours;
  preferredWindows?: TimeWindow[];
  reservationRequirement: 'required' | 'recommended' | 'not-required' | 'unknown';
  ticketPrice?: DynamicObservation<number>;
  indoorLevel: 'indoor' | 'mostly-indoor' | 'mixed' | 'mostly-outdoor' | 'outdoor';
  accessibility: 'accessible' | 'partial' | 'limited' | 'unknown';
  physicalIntensity: 1 | 2 | 3 | 4 | 5;
  suitableWeather: Array<'clear' | 'cloudy' | 'rain' | 'hot' | 'cold' | 'any'>;
  sourceRefs: string[];
  updatedAt: string;
  uncertainty: 'verified' | 'reviewed' | 'estimated' | 'missing';
}

export type TripPace = 'relaxed' | 'balanced' | 'intensive';
export type BudgetLevel = 'economy' | 'standard' | 'comfort' | 'premium';
export type PhysicalLevel = 'low' | 'medium' | 'high';
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

export interface DestinationRequest {
  placeId: string;
  weight?: number;
  minDays?: number;
  maxDays?: number;
}

export interface LockedActivityRequest {
  id: string;
  localDate: LocalDate;
  startTime: LocalTime;
  endTime: LocalTime;
  timezoneId: TimezoneId;
  placeId: string;
  poiId?: string;
  title: LocalizedText;
}

export interface TripRequest {
  id: string;
  schemaVersion: number;
  destinations: DestinationRequest[];
  startDate: LocalDate;
  endDate: LocalDate;
  pace: TripPace;
  budget: BudgetLevel;
  interests: string[];
  physicalLevel: PhysicalLevel;
  accessibilityRequired: boolean;
  dailyStartTime: LocalTime;
  dailyEndTime: LocalTime;
  mealDurationMinutes: number;
  restDurationMinutes: number;
  transportPreferences: TravelMode[];
  accommodationPreference: 'single-base' | 'minimize-transfers' | 'flexible';
  mustVisitPoiIds: string[];
  excludedPoiIds: string[];
  lockedActivities: LockedActivityRequest[];
  language: LocaleCode;
  currency: CurrencyCode;
}

export type ActivityKind =
  | 'poi'
  | 'meal'
  | 'rest'
  | 'transfer'
  | 'check-in'
  | 'check-out';

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: LocalizedText;
  localDate: LocalDate;
  timezoneId: TimezoneId;
  startTime: LocalTime;
  endTime: LocalTime;
  placeId: string;
  poiId?: string;
  planningUnitId?: string;
  locked: boolean;
  sourceRefs: string[];
  reasonCodes: string[];
  estimate?: boolean;
}

export type TravelLegMethod = 'matrix' | 'schedule' | 'estimate' | 'unavailable';

export interface TravelLeg {
  id: string;
  localDate: LocalDate;
  timezoneId: TimezoneId;
  originActivityId: string;
  destinationActivityId: string;
  originPlaceId: string;
  destinationPlaceId: string;
  mode: TravelMode;
  startTime: LocalTime;
  endTime: LocalTime;
  durationMinutes: number;
  distanceMeters?: number;
  method: TravelLegMethod;
  confidence: 'high' | 'medium' | 'low';
  sourceRefs: string[];
  crossRegion: boolean;
}

export interface AccommodationStay {
  id: string;
  placeId: string;
  planningUnitId: string;
  checkInDate: LocalDate;
  checkOutDate: LocalDate;
  reasonCodes: string[];
  sourceRefs: string[];
  specificProperty?: DynamicObservation<{ name: string; rating?: number; price?: number }>;
}

export interface PlanningConflict {
  id: string;
  code: string;
  severity: 'error' | 'warning';
  message: LocalizedText;
  localDate?: LocalDate;
  relatedIds: string[];
  resolved: boolean;
}

export interface PlanningAssumption {
  id: string;
  code: string;
  message: LocalizedText;
  sourceRefs: string[];
}

export interface TripDay {
  id: string;
  localDate: LocalDate;
  placeId: string;
  timezoneId: TimezoneId;
  activities: Activity[];
  travelLegs: TravelLeg[];
}

export interface FreshnessSummary {
  fresh: number;
  stale: number;
  unavailable: number;
  latestObservedAt?: string;
}

export interface TripPlan {
  id: string;
  requestId: string;
  status: 'valid' | 'conflicted';
  plannerVersion: string;
  inputSchemaVersion: number;
  dataVersion: string;
  seed: number;
  days: TripDay[];
  accommodationStays: AccommodationStay[];
  unresolvedConflicts: PlanningConflict[];
  assumptions: PlanningAssumption[];
  sourceRefs: string[];
  freshness: FreshnessSummary;
  degradationMessages: LocalizedText[];
  generatedAt: string;
  previousPlanId?: string;
}

export interface TravelTimeEntry {
  fromPoiId: string;
  toPoiId: string;
  mode: TravelMode;
  durationMinutes: number;
  distanceMeters?: number;
  method: TravelLegMethod;
  confidence: 'high' | 'medium' | 'low';
  sourceRefs: string[];
}

export interface TravelTimeMatrix {
  version: string;
  entries: TravelTimeEntry[];
}

export interface PlanningCatalog {
  version: string;
  places: Place[];
  planningUnits: PlanningUnit[];
  pois: Poi[];
  sources: SourceRef[];
}

export interface TripEdit {
  type: 'move-activity' | 'set-lock';
  activityId: string;
  targetDayId?: string;
  targetIndex?: number;
  locked?: boolean;
}

export interface InvariantViolation {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
  relatedIds: string[];
}

export function timeToMinutes(value: LocalTime): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid local time: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid local time: ${value}`);
  return hour * 60 + minute;
}

export function minutesToTime(value: number): LocalTime {
  if (!Number.isFinite(value) || value < 0 || value >= 24 * 60) {
    throw new Error(`Minutes outside local day: ${value}`);
  }
  const hour = Math.floor(value / 60);
  const minute = Math.round(value % 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isObservationStale<T>(observation: DynamicObservation<T>, nowIso: string): boolean {
  return Boolean(observation.expiresAt && Date.parse(observation.expiresAt) < Date.parse(nowIso));
}

export function localize(text: LocalizedText, locale: string, fallback = 'en'): string {
  return text[locale] ?? text[fallback] ?? Object.values(text)[0] ?? '';
}

export function createStableId(...parts: Array<string | number>): string {
  return parts
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-'))
    .filter(Boolean)
    .join(':');
}
