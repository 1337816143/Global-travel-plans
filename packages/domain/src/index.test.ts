import { describe, expect, it } from 'vitest';
import {
  createStableId,
  isObservationStale,
  localize,
  minutesToTime,
  timeToMinutes,
} from './index';

describe('domain value helpers', () => {
  it('round-trips local time without relying on host timezone', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
  });

  it('marks expired observations as stale', () => {
    expect(
      isObservationStale(
        {
          value: 100,
          provider: 'fixture',
          observedAt: '2026-07-01T00:00:00Z',
          expiresAt: '2026-07-02T00:00:00Z',
          sourceRefs: ['source'],
        },
        '2026-07-03T00:00:00Z',
      ),
    ).toBe(true);
  });

  it('uses deterministic localization fallback and ids', () => {
    expect(localize({ 'zh-CN': '青岛', en: 'Qingdao' }, 'fr')).toBe('Qingdao');
    expect(createStableId('Day 1', 'POI A', 2)).toBe('day-1:poi-a:2');
  });
});
