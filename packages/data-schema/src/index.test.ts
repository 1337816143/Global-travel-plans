import { describe, expect, it } from 'vitest';
import { exportJsonSchemas, parsePlanningCatalog, parseTripRequest } from './index';

const source = {
  id: 'source:official',
  title: 'Official source',
  url: 'https://example.com',
  sourceType: 'official' as const,
  retrievedAt: '2026-07-28T00:00:00.000Z',
  confidence: 'high' as const,
};

const place = {
  id: 'place:test',
  names: { en: 'Test' },
  type: 'locality' as const,
  countryCode: 'SG',
  coordinates: { lat: 1.3, lng: 103.8 },
  timezoneIds: ['Asia/Singapore'],
  currencies: ['SGD'],
  languages: ['en'],
  sourceRefs: [source.id],
  schemaVersion: 1,
};

describe('global data schemas', () => {
  it('validates a cross-cutting catalog with referential integrity', () => {
    const catalog = parsePlanningCatalog({
      version: 'fixture-1',
      places: [place],
      planningUnits: [
        {
          id: 'unit:test',
          placeId: place.id,
          names: { en: 'Center' },
          recommendedDays: { min: 1, ideal: 2, max: 3 },
          poiIds: ['poi:test'],
          transportNotes: { en: 'Walkable' },
          customs: [],
          safetyNotes: [],
          sourceRefs: [source.id],
        },
      ],
      pois: [
        {
          id: 'poi:test',
          placeId: place.id,
          planningUnitId: 'unit:test',
          names: { en: 'Museum' },
          coordinates: place.coordinates,
          categories: ['museum'],
          recommendedDurationMinutes: { min: 60, ideal: 90, max: 120 },
          reservationRequirement: 'not-required',
          indoorLevel: 'indoor',
          accessibility: 'accessible',
          physicalIntensity: 1,
          suitableWeather: ['any'],
          sourceRefs: [source.id],
          updatedAt: '2026-07-28T00:00:00.000Z',
          uncertainty: 'reviewed',
        },
      ],
      sources: [source],
    });
    expect(catalog.pois).toHaveLength(1);
  });

  it('rejects must-visit and excluded conflicts', () => {
    expect(() =>
      parseTripRequest({
        id: 'request:test',
        schemaVersion: 1,
        destinations: [{ placeId: place.id }],
        startDate: '2026-08-01',
        endDate: '2026-08-02',
        pace: 'balanced',
        budget: 'standard',
        interests: ['museum'],
        physicalLevel: 'medium',
        accessibilityRequired: false,
        dailyStartTime: '09:00',
        dailyEndTime: '18:00',
        mealDurationMinutes: 60,
        restDurationMinutes: 30,
        transportPreferences: ['walk', 'transit'],
        accommodationPreference: 'minimize-transfers',
        mustVisitPoiIds: ['poi:test'],
        excludedPoiIds: ['poi:test'],
        lockedActivities: [],
        language: 'en',
        currency: 'SGD',
      }),
    ).toThrow();
  });

  it('exports JSON Schema from the same runtime definitions', () => {
    const schemas = exportJsonSchemas();
    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining(['place', 'poi', 'tripRequest', 'tripPlan', 'sourceRef']),
    );
  });
});
