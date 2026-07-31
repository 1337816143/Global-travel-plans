import type {
  LocalizedText,
  SourceRef,
  TimeWindow,
  TravelMode,
  Wgs84Coordinate,
} from '@global-travel-plans/domain';

export type GuidePriority = 'must' | 'recommended' | 'optional' | 'backup';
export type UserPoiPreference = 'must-visit' | 'want-to-visit' | 'optional' | 'excluded';
export type GuideFreshness = 'stable' | 'seasonal' | 'dynamic' | 'real-time';
export type ItineraryModuleKind =
  | 'arrival'
  | 'departure'
  | 'half-day'
  | 'full-day'
  | 'evening'
  | 'rest'
  | 'flex';

export interface GuideSource extends SourceRef {
  appliesTo: string[];
  freshness: GuideFreshness;
  reviewNotes?: LocalizedText;
}

export interface GuideFact {
  id: string;
  title: LocalizedText;
  detail: LocalizedText;
  sourceRefs: string[];
  freshness: GuideFreshness;
  validFrom?: string;
  validUntil?: string;
}

export interface GuideNarrativeSection {
  id: string;
  title: LocalizedText;
  summary?: LocalizedText;
  paragraphs: LocalizedText[];
  sourceRefs: string[];
}

export interface GuideTransportAdvice {
  arrival: LocalizedText[];
  localMobility: LocalizedText[];
  recommendedModes: TravelMode[];
  avoid: LocalizedText[];
  sourceRefs: string[];
}

export interface AccommodationAreaGuide {
  id: string;
  placeId: string;
  names: LocalizedText;
  coordinates: Wgs84Coordinate;
  priority: GuidePriority;
  fitSummary: LocalizedText;
  strengths: LocalizedText[];
  weaknesses: LocalizedText[];
  suitableFor: string[];
  transportNotes: LocalizedText[];
  bookingChecklist: LocalizedText[];
  sourceRefs: string[];
}

export interface AccommodationCandidateGuide {
  id: string;
  areaId: string;
  names: LocalizedText;
  coordinates?: Wgs84Coordinate;
  verifiedAddress?: LocalizedText;
  fitSummary: LocalizedText;
  bookingNotes: LocalizedText[];
  dynamicFields: Array<'price' | 'availability' | 'rating' | 'breakfast' | 'cancellation'>;
  sourceRefs: string[];
}

export interface ReservationTask {
  id: string;
  placeId: string;
  poiId?: string;
  title: LocalizedText;
  requirement: 'required' | 'recommended' | 'conditional';
  leadTime: LocalizedText;
  officialChannel?: string;
  checklist: LocalizedText[];
  fallback: LocalizedText;
  sourceRefs: string[];
}

export interface FoodGuideItem {
  id: string;
  placeId: string;
  names: LocalizedText;
  kind: 'dish' | 'restaurant' | 'market' | 'snack' | 'souvenir';
  priority: GuidePriority;
  whyRecommended: LocalizedText;
  suitableMeal?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  coordinates?: Wgs84Coordinate;
  verificationNotes: LocalizedText[];
  sourceRefs: string[];
}

export interface PoiGuide {
  id: string;
  poiId: string;
  placeId: string;
  names: LocalizedText;
  priority: GuidePriority;
  tags: string[];
  shortSummary: LocalizedText;
  fullDescription: LocalizedText[];
  whyVisit: LocalizedText[];
  suggestedDurationMinutes: { min: number; ideal: number; max: number };
  bestTimeWindows: TimeWindow[];
  arrivalNotes: LocalizedText[];
  transportNotes: LocalizedText[];
  reservationNotes: LocalizedText[];
  ticketNotes: LocalizedText[];
  physicalNotes: LocalizedText[];
  accessibilityNotes: LocalizedText[];
  weatherNotes: LocalizedText[];
  safetyNotes: LocalizedText[];
  pitfalls: LocalizedText[];
  planB: LocalizedText[];
  relatedPoiIds: string[];
  sourceRefs: string[];
  updatedAt: string;
}

export type ModuleBlockKind =
  | 'poi'
  | 'meal'
  | 'rest'
  | 'transfer'
  | 'check-in'
  | 'check-out'
  | 'preparation'
  | 'free-time';

export interface ItineraryModuleBlock {
  id: string;
  kind: ModuleBlockKind;
  title: LocalizedText;
  detail: LocalizedText;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  poiId?: string;
  preferredModes?: TravelMode[];
  optional: boolean;
  sourceRefs: string[];
}

export interface ItineraryModuleConstraint {
  seasons?: number[];
  daysOfWeek?: number[];
  weather?: Array<'clear' | 'cloudy' | 'rain' | 'hot' | 'cold' | 'any'>;
  minPhysicalLevel?: 'low' | 'medium' | 'high';
  maxPhysicalLevel?: 'low' | 'medium' | 'high';
  requiresReservationTaskIds?: string[];
  incompatibleModuleIds?: string[];
  requiresPoiIds?: string[];
}

export interface ItineraryModule {
  id: string;
  placeId: string;
  planningUnitIds: string[];
  names: LocalizedText;
  kind: ItineraryModuleKind;
  summary: LocalizedText;
  recommendedForDayRange: { min: number; max: number };
  estimatedDurationMinutes: number;
  priority: GuidePriority;
  blocks: ItineraryModuleBlock[];
  constraints: ItineraryModuleConstraint;
  planBModuleIds: string[];
  splitIntoModuleIds: string[];
  mergeWithModuleIds: string[];
  sourceRefs: string[];
}

export interface CityGuide {
  id: string;
  placeId: string;
  slug: string;
  names: LocalizedText;
  tagline: LocalizedText;
  overview: LocalizedText[];
  recommendedDays: { min: number; ideal: number; max: number };
  bestSeasons: number[];
  audienceTags: string[];
  narrativeSections: GuideNarrativeSection[];
  facts: GuideFact[];
  transportAdvice: GuideTransportAdvice;
  poiGuideIds: string[];
  itineraryModuleIds: string[];
  accommodationAreaIds: string[];
  accommodationCandidateIds: string[];
  reservationTaskIds: string[];
  foodGuideItemIds: string[];
  sourceRefs: string[];
  contentVersion: string;
  updatedAt: string;
}

export interface CityGuideBundle {
  guide: CityGuide;
  poiGuides: PoiGuide[];
  itineraryModules: ItineraryModule[];
  accommodationAreas: AccommodationAreaGuide[];
  accommodationCandidates: AccommodationCandidateGuide[];
  reservationTasks: ReservationTask[];
  foodItems: FoodGuideItem[];
  sources: GuideSource[];
}

export interface CityGuideValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface CityGuideCoverageSummary {
  poiGuides: number;
  mustVisitPoiGuides: number;
  itineraryModules: number;
  accommodationAreas: number;
  reservationTasks: number;
  foodItems: number;
  sources: number;
  unresolvedReferences: number;
}

export function validateCityGuideBundle(bundle: CityGuideBundle): CityGuideValidationIssue[] {
  const issues: CityGuideValidationIssue[] = [];
  const poiGuideIds = new Set(bundle.poiGuides.map((item) => item.id));
  const poiIds = new Set(bundle.poiGuides.map((item) => item.poiId));
  const moduleIds = new Set(bundle.itineraryModules.map((item) => item.id));
  const areaIds = new Set(bundle.accommodationAreas.map((item) => item.id));
  const candidateIds = new Set(bundle.accommodationCandidates.map((item) => item.id));
  const taskIds = new Set(bundle.reservationTasks.map((item) => item.id));
  const foodIds = new Set(bundle.foodItems.map((item) => item.id));
  const sourceIds = new Set(bundle.sources.map((item) => item.id));

  const requireReferences = (
    values: string[],
    known: Set<string>,
    path: string,
    code: string,
  ) => {
    for (const value of values) {
      if (!known.has(value)) {
        issues.push({ code, path, message: `Unknown reference: ${value}` });
      }
    }
  };

  requireReferences(bundle.guide.poiGuideIds, poiGuideIds, 'guide.poiGuideIds', 'unknown-poi-guide');
  requireReferences(
    bundle.guide.itineraryModuleIds,
    moduleIds,
    'guide.itineraryModuleIds',
    'unknown-itinerary-module',
  );
  requireReferences(
    bundle.guide.accommodationAreaIds,
    areaIds,
    'guide.accommodationAreaIds',
    'unknown-accommodation-area',
  );
  requireReferences(
    bundle.guide.accommodationCandidateIds,
    candidateIds,
    'guide.accommodationCandidateIds',
    'unknown-accommodation-candidate',
  );
  requireReferences(
    bundle.guide.reservationTaskIds,
    taskIds,
    'guide.reservationTaskIds',
    'unknown-reservation-task',
  );
  requireReferences(
    bundle.guide.foodGuideItemIds,
    foodIds,
    'guide.foodGuideItemIds',
    'unknown-food-item',
  );

  const sourceBearingObjects: Array<{ path: string; sourceRefs: string[] }> = [
    { path: 'guide', sourceRefs: bundle.guide.sourceRefs },
    ...bundle.poiGuides.map((item) => ({ path: `poiGuides.${item.id}`, sourceRefs: item.sourceRefs })),
    ...bundle.itineraryModules.map((item) => ({
      path: `itineraryModules.${item.id}`,
      sourceRefs: item.sourceRefs,
    })),
    ...bundle.accommodationAreas.map((item) => ({
      path: `accommodationAreas.${item.id}`,
      sourceRefs: item.sourceRefs,
    })),
    ...bundle.accommodationCandidates.map((item) => ({
      path: `accommodationCandidates.${item.id}`,
      sourceRefs: item.sourceRefs,
    })),
    ...bundle.reservationTasks.map((item) => ({
      path: `reservationTasks.${item.id}`,
      sourceRefs: item.sourceRefs,
    })),
    ...bundle.foodItems.map((item) => ({ path: `foodItems.${item.id}`, sourceRefs: item.sourceRefs })),
  ];

  for (const item of sourceBearingObjects) {
    if (item.sourceRefs.length === 0) {
      issues.push({
        code: 'missing-source',
        path: `${item.path}.sourceRefs`,
        message: 'Published guide content must cite at least one source.',
      });
    }
    requireReferences(item.sourceRefs, sourceIds, `${item.path}.sourceRefs`, 'unknown-source');
  }

  for (const module of bundle.itineraryModules) {
    requireReferences(
      module.planBModuleIds,
      moduleIds,
      `itineraryModules.${module.id}.planBModuleIds`,
      'unknown-plan-b-module',
    );
    requireReferences(
      module.splitIntoModuleIds,
      moduleIds,
      `itineraryModules.${module.id}.splitIntoModuleIds`,
      'unknown-split-module',
    );
    requireReferences(
      module.mergeWithModuleIds,
      moduleIds,
      `itineraryModules.${module.id}.mergeWithModuleIds`,
      'unknown-merge-module',
    );
    requireReferences(
      module.constraints.requiresReservationTaskIds ?? [],
      taskIds,
      `itineraryModules.${module.id}.constraints.requiresReservationTaskIds`,
      'unknown-required-reservation-task',
    );
    requireReferences(
      module.constraints.requiresPoiIds ?? [],
      poiIds,
      `itineraryModules.${module.id}.constraints.requiresPoiIds`,
      'unknown-required-poi',
    );
    for (const block of module.blocks) {
      if (block.kind === 'poi' && !block.poiId) {
        issues.push({
          code: 'poi-block-without-poi',
          path: `itineraryModules.${module.id}.blocks.${block.id}.poiId`,
          message: 'POI blocks must reference a POI.',
        });
      }
      if (block.poiId && !poiIds.has(block.poiId)) {
        issues.push({
          code: 'unknown-block-poi',
          path: `itineraryModules.${module.id}.blocks.${block.id}.poiId`,
          message: `Unknown POI reference: ${block.poiId}`,
        });
      }
      requireReferences(
        block.sourceRefs,
        sourceIds,
        `itineraryModules.${module.id}.blocks.${block.id}.sourceRefs`,
        'unknown-source',
      );
    }
  }

  return issues;
}

export function summarizeCityGuideCoverage(bundle: CityGuideBundle): CityGuideCoverageSummary {
  return {
    poiGuides: bundle.poiGuides.length,
    mustVisitPoiGuides: bundle.poiGuides.filter((item) => item.priority === 'must').length,
    itineraryModules: bundle.itineraryModules.length,
    accommodationAreas: bundle.accommodationAreas.length,
    reservationTasks: bundle.reservationTasks.length,
    foodItems: bundle.foodItems.length,
    sources: bundle.sources.length,
    unresolvedReferences: validateCityGuideBundle(bundle).length,
  };
}
