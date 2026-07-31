import { describe, expect, it } from 'vitest';
import {
  summarizeCityGuideCoverage,
  validateCityGuideBundle,
  type CityGuideBundle,
} from './index';

const zh = (value: string) => ({ 'zh-CN': value, en: value });

function createBundle(): CityGuideBundle {
  return {
    guide: {
      id: 'guide-qingdao',
      placeId: 'qingdao',
      slug: 'qingdao',
      names: zh('青岛'),
      tagline: zh('山海老城与低强度海岸旅行'),
      overview: [zh('完整攻略样板。')],
      recommendedDays: { min: 2, ideal: 6, max: 10 },
      bestSeasons: [5, 6, 7, 8, 9, 10],
      audienceTags: ['couple', 'low-physical'],
      narrativeSections: [],
      facts: [],
      transportAdvice: {
        arrival: [zh('按实际枢纽规划。')],
        localMobility: [zh('地铁与短程网约车结合。')],
        recommendedModes: ['transit', 'taxi', 'walk'],
        avoid: [zh('避免正午长距离步行。')],
        sourceRefs: ['source-qingdao-metro'],
      },
      poiGuideIds: ['guide-poi-signal'],
      itineraryModuleIds: ['module-old-town'],
      accommodationAreaIds: ['area-fushansuo'],
      accommodationCandidateIds: [],
      reservationTaskIds: [],
      foodGuideItemIds: [],
      sourceRefs: ['source-qingdao-metro'],
      contentVersion: '0.2.0',
      updatedAt: '2026-07-31T00:00:00.000Z',
    },
    poiGuides: [
      {
        id: 'guide-poi-signal',
        poiId: 'signal',
        placeId: 'qingdao',
        names: zh('信号山'),
        priority: 'must',
        tags: ['old-town', 'viewpoint'],
        shortSummary: zh('老城观景点。'),
        fullDescription: [zh('保留完整攻略说明。')],
        whyVisit: [zh('俯瞰老城与海岸。')],
        suggestedDurationMinutes: { min: 45, ideal: 70, max: 100 },
        bestTimeWindows: [{ start: '15:30', end: '18:00' }],
        arrivalNotes: [zh('从地铁站步行。')],
        transportNotes: [zh('低体力可短程打车。')],
        reservationNotes: [zh('现场可能限流。')],
        ticketNotes: [zh('以官方公告为准。')],
        physicalNotes: [zh('坡路明显。')],
        accessibilityNotes: [zh('部分路段无障碍有限。')],
        weatherNotes: [zh('高温时缩短停留。')],
        safetyNotes: [zh('不进入封闭区域。')],
        pitfalls: [zh('不要强求登顶。')],
        planB: [zh('改为室内博物馆。')],
        relatedPoiIds: [],
        sourceRefs: ['source-qingdao-metro'],
        updatedAt: '2026-07-31T00:00:00.000Z',
      },
    ],
    itineraryModules: [
      {
        id: 'module-old-town',
        placeId: 'qingdao',
        planningUnitIds: ['qingdao-old-town'],
        names: zh('老城半日'),
        kind: 'half-day',
        summary: zh('信号山与栈桥组合模块。'),
        recommendedForDayRange: { min: 2, max: 10 },
        estimatedDurationMinutes: 240,
        priority: 'must',
        blocks: [
          {
            id: 'block-signal',
            kind: 'poi',
            title: zh('信号山'),
            detail: zh('慢游并预留休息。'),
            startTime: '16:00',
            endTime: '17:10',
            poiId: 'signal',
            optional: false,
            sourceRefs: ['source-qingdao-metro'],
          },
        ],
        constraints: { weather: ['clear', 'cloudy', 'any'], requiresPoiIds: ['signal'] },
        planBModuleIds: [],
        splitIntoModuleIds: [],
        mergeWithModuleIds: [],
        sourceRefs: ['source-qingdao-metro'],
      },
    ],
    accommodationAreas: [
      {
        id: 'area-fushansuo',
        placeId: 'qingdao',
        names: zh('五四广场—浮山所'),
        coordinates: { lat: 36.0648, lng: 120.3778 },
        priority: 'must',
        fitSummary: zh('适合作为单一住宿基地。'),
        strengths: [zh('交通与补给方便。')],
        weaknesses: [zh('旺季价格可能较高。')],
        suitableFor: ['couple', 'low-physical'],
        transportNotes: [zh('优先靠近地铁。')],
        bookingChecklist: [zh('确认空调、遮光和退改。')],
        sourceRefs: ['source-qingdao-metro'],
      },
    ],
    accommodationCandidates: [],
    reservationTasks: [],
    foodItems: [],
    sources: [
      {
        id: 'source-qingdao-metro',
        title: '青岛地铁',
        url: 'https://www.qd-metro.com/',
        publisher: '青岛地铁',
        sourceType: 'official',
        retrievedAt: '2026-07-31T00:00:00.000Z',
        confidence: 'high',
        appliesTo: ['guide-qingdao', 'signal'],
        freshness: 'dynamic',
      },
    ],
  };
}

describe('content-model', () => {
  it('validates a connected rich city guide bundle', () => {
    const bundle = createBundle();
    expect(validateCityGuideBundle(bundle)).toEqual([]);
    expect(summarizeCityGuideCoverage(bundle)).toEqual({
      poiGuides: 1,
      mustVisitPoiGuides: 1,
      itineraryModules: 1,
      accommodationAreas: 1,
      reservationTasks: 0,
      foodItems: 0,
      sources: 1,
      unresolvedReferences: 0,
    });
  });

  it('reports missing cross references instead of silently dropping content', () => {
    const bundle = createBundle();
    bundle.guide.itineraryModuleIds.push('missing-module');
    bundle.itineraryModules[0]?.blocks.push({
      id: 'missing-poi-block',
      kind: 'poi',
      title: zh('缺失点位'),
      detail: zh('用于验证。'),
      poiId: 'missing-poi',
      optional: false,
      sourceRefs: ['source-qingdao-metro'],
    });
    const issues = validateCityGuideBundle(bundle);
    expect(issues.map((item) => item.code)).toContain('unknown-itinerary-module');
    expect(issues.map((item) => item.code)).toContain('unknown-block-poi');
  });
});
