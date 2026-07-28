import { describe, expect, it } from 'vitest';
import {
  MemoryMapAdapter,
  buildBounds,
  gcj02ToWgs84,
  wgs84ToGcj02,
  type MapRenderModel,
} from './index';

describe('map adapter boundary', () => {
  it('keeps non-mainland-China WGS84 coordinates unchanged', () => {
    const overseasCoordinates = [
      { lat: 1.3521, lng: 103.8198 },
      { lat: 27.7172, lng: 85.324 },
      { lat: 37.5665, lng: 126.978 },
      { lat: 35.6762, lng: 139.6503 },
    ];

    for (const coordinate of overseasCoordinates) {
      expect(wgs84ToGcj02(coordinate)).toEqual(coordinate);
      expect(gcj02ToWgs84(coordinate)).toEqual(coordinate);
    }
  });

  it('round-trips China coordinates with small adapter-boundary error', () => {
    const qingdao = { lat: 36.0671, lng: 120.3826 };
    const gcj = wgs84ToGcj02(qingdao);
    const restored = gcj02ToWgs84(gcj);
    expect(gcj).not.toEqual(qingdao);
    expect(Math.abs(restored.lat - qingdao.lat)).toBeLessThan(0.00001);
    expect(Math.abs(restored.lng - qingdao.lng)).toBeLessThan(0.00001);
  });

  it('builds WGS84 bounds without mutating coordinates', () => {
    const coordinates = [
      { lat: 36.0671, lng: 120.3826 },
      { lat: 1.3521, lng: 103.8198 },
    ];
    const before = structuredClone(coordinates);
    expect(buildBounds(coordinates)).toEqual([103.8198, 1.3521, 120.3826, 36.0671]);
    expect(coordinates).toEqual(before);
  });

  it('provides a deterministic in-memory adapter for UI and contract tests', async () => {
    const adapter = new MemoryMapAdapter();
    await adapter.mount({} as HTMLElement, {
      center: { lat: 36.0671, lng: 120.3826 },
      zoom: 10,
      locale: 'zh-CN',
    });
    const model: MapRenderModel = {
      markers: [
        {
          id: 'poi:test',
          position: { lat: 36.0671, lng: 120.3826 },
          label: { 'zh-CN': '测试', en: 'Test' },
          kind: 'poi',
        },
      ],
      paths: [],
      bounds: [120.3, 36, 120.5, 36.2],
    };
    adapter.render(model);
    adapter.select('poi:test');
    adapter.fitBounds(model.bounds!);

    model.markers[0]!.position.lat = 0;
    expect(adapter.lastModel?.markers[0]?.position.lat).toBe(36.0671);
    expect(adapter.selectedId).toBe('poi:test');
    expect(adapter.lastBounds).toEqual(model.bounds);

    adapter.destroy();
    expect(adapter.destroyed).toBe(true);
    expect(() => adapter.resize()).toThrow('not mounted');
  });
});
