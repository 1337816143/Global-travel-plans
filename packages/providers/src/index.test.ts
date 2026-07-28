import { describe, expect, it } from 'vitest';
import {
  BrowserJsonExportProvider,
  FixtureWeatherProvider,
  ProviderTimeoutError,
  UnavailableWeatherProvider,
  classifyProviderError,
  collectCapabilities,
  withProviderTimeout,
  type WeatherObservation,
  type WeatherProvider,
} from './index';

const observations: WeatherObservation[] = [
  {
    localDate: '2026-08-10',
    timezoneId: 'Asia/Shanghai',
    temperatureMinC: 24,
    temperatureMaxC: 31,
    apparentTemperatureMaxC: 34,
    precipitationProbabilityMax: 35,
    weatherCode: 'fixture-partly-cloudy',
  },
  {
    localDate: '2026-08-13',
    timezoneId: 'Asia/Singapore',
    temperatureMinC: 26,
    temperatureMaxC: 32,
    apparentTemperatureMaxC: 36,
    precipitationProbabilityMax: 55,
    weatherCode: 'fixture-showers',
  },
];

describe('provider contracts', () => {
  it('returns unavailable without fabricating data', async () => {
    const provider: WeatherProvider = new UnavailableWeatherProvider();
    const result = await provider.forecast({
      coordinate: { lat: 36.0671, lng: 120.3826 },
      timezoneId: 'Asia/Shanghai',
      startDate: '2026-08-10',
      endDate: '2026-08-10',
    });

    expect(result).toMatchObject({
      status: 'unavailable',
      data: null,
      stale: false,
      cached: false,
      error: { kind: 'unsupported', retryable: false },
    });
  });

  it('normalizes fixture observations and filters by timezone and date', async () => {
    const provider = new FixtureWeatherProvider(observations, {
      observedAt: '2026-07-28T00:00:00.000Z',
      expiresAt: '2026-07-29T00:00:00.000Z',
      sourceRefs: ['source:planner-estimate-fixture'],
    });
    const result = await provider.forecast({
      coordinate: { lat: 1.3521, lng: 103.8198 },
      timezoneId: 'Asia/Singapore',
      startDate: '2026-08-12',
      endDate: '2026-08-14',
    });

    expect(result).toMatchObject({
      status: 'success',
      providerId: 'fixture-weather',
      capabilityId: 'weather.forecast',
      observedAt: '2026-07-28T00:00:00.000Z',
      expiresAt: '2026-07-29T00:00:00.000Z',
      sourceRefs: ['source:planner-estimate-fixture'],
      stale: false,
      cached: false,
    });
    expect(result.data).toEqual([observations[1]]);
  });

  it('classifies bounded timeouts as retryable timeout errors', async () => {
    await expect(
      withProviderTimeout(
        (signal) =>
          new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          }),
        { timeoutMs: 5 },
      ),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);

    const failure = classifyProviderError(new ProviderTimeoutError('timeout'));
    expect(failure).toEqual({ kind: 'timeout', message: 'timeout', retryable: true });
  });

  it('propagates caller cancellation without retrying', async () => {
    const controller = new AbortController();
    const operation = withProviderTimeout(
      (signal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), {
            once: true,
          });
        }),
      { signal: controller.signal, timeoutMs: 100 },
    );
    controller.abort();

    const error = await operation.catch((value: unknown) => value);
    expect(classifyProviderError(error)).toEqual({
      kind: 'aborted',
      message: 'Request was aborted.',
      retryable: false,
    });
  });

  it('exposes capability status and browser JSON export', async () => {
    const unavailable = new UnavailableWeatherProvider();
    const exporter = new BrowserJsonExportProvider();
    const capabilities = collectCapabilities({ weather: unavailable, export: exporter });
    expect(capabilities.map((item) => [item.id, item.available])).toEqual([
      ['export.json', true],
      ['weather.forecast', false],
    ]);
    const result = await exporter.exportJson({ schemaVersion: 1 });
    expect(result.data).toContain('"schemaVersion": 1');
  });
});
