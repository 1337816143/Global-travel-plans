import { describe, expect, it } from 'vitest';
import { loadLegacyQingdaoSnapshot } from './import-qingdao-legacy';

describe('loadLegacyQingdaoSnapshot', () => {
  it('preserves the existing Qingdao business data as a migration source', () => {
    const snapshot = loadLegacyQingdaoSnapshot(process.cwd());

    expect(snapshot.source.repository).toBe('1337816143/travel-plans');
    expect(snapshot.source.version).not.toBe('unknown');
    expect(snapshot.points.length).toBeGreaterThan(20);
    expect(snapshot.schedules.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.hotels.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.bookings.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.sources.length).toBeGreaterThan(10);
    expect(snapshot.recommendedPoiIds.length).toBeGreaterThan(0);
    expect(Object.keys(snapshot.wishlist).length).toBeGreaterThan(3);

    const scheduleText = JSON.stringify(snapshot.schedules);
    expect(scheduleText).toContain('planB');
    expect(scheduleText).toContain('午休');

    const pointText = JSON.stringify(snapshot.points);
    expect(pointText).toContain('sourceUrl');
    expect(pointText).toContain('transport');
    expect(pointText).toContain('tips');
  });
});
