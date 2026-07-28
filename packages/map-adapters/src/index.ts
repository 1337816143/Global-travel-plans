import type { BoundingBox, LocalizedText, Wgs84Coordinate } from '@global-travel-plans/domain';

export interface MapMarker {
  id: string;
  position: Wgs84Coordinate;
  label: LocalizedText;
  kind: 'poi' | 'activity' | 'accommodation' | 'transfer';
  selected?: boolean;
}

export interface MapPath {
  id: string;
  points: Wgs84Coordinate[];
  kind: 'day-route' | 'travel-leg' | 'transfer';
  estimated: boolean;
  label?: LocalizedText;
}

export interface MapRenderModel {
  markers: MapMarker[];
  paths: MapPath[];
  selectedId?: string;
  bounds?: BoundingBox;
}

export interface MapMountOptions {
  center: Wgs84Coordinate;
  zoom: number;
  tileUrl?: string;
  attribution?: string;
  locale?: string;
}

export interface MapAdapter {
  readonly id: string;
  mount(container: HTMLElement, options: MapMountOptions): Promise<void>;
  render(model: MapRenderModel): void;
  fitBounds(bounds: BoundingBox): void;
  select(featureId: string | null): void;
  resize(): void;
  destroy(): void;
}

export class MemoryMapAdapter implements MapAdapter {
  readonly id = 'memory';
  mounted = false;
  destroyed = false;
  lastModel: MapRenderModel | null = null;
  lastBounds: BoundingBox | null = null;
  selectedId: string | null = null;
  options: MapMountOptions | null = null;

  async mount(_container: HTMLElement, options: MapMountOptions): Promise<void> {
    this.mounted = true;
    this.destroyed = false;
    this.options = structuredClone(options);
  }

  render(model: MapRenderModel): void {
    assertMounted(this.mounted, this.id);
    this.lastModel = structuredClone(model);
  }

  fitBounds(bounds: BoundingBox): void {
    assertMounted(this.mounted, this.id);
    this.lastBounds = [...bounds];
  }

  select(featureId: string | null): void {
    assertMounted(this.mounted, this.id);
    this.selectedId = featureId;
  }

  resize(): void {
    assertMounted(this.mounted, this.id);
  }

  destroy(): void {
    this.destroyed = true;
    this.mounted = false;
    this.lastModel = null;
    this.lastBounds = null;
    this.selectedId = null;
  }
}

type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LeafletLayerGroup = import('leaflet').LayerGroup;

export class LeafletMapAdapter implements MapAdapter {
  readonly id = 'leaflet';
  private leaflet: LeafletModule | null = null;
  private map: LeafletMap | null = null;
  private layers: LeafletLayerGroup | null = null;
  private selectedId: string | null = null;
  private currentModel: MapRenderModel | null = null;

  async mount(container: HTMLElement, options: MapMountOptions): Promise<void> {
    if (this.map) this.destroy();
    const leaflet = await import('leaflet');
    this.leaflet = leaflet;
    this.map = leaflet.map(container, { zoomControl: true }).setView(
      [options.center.lat, options.center.lng],
      options.zoom,
    );
    const tileUrl = options.tileUrl ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    leaflet
      .tileLayer(tileUrl, {
        attribution: options.attribution ?? '© OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.map);
    this.layers = leaflet.layerGroup().addTo(this.map);
  }

  render(model: MapRenderModel): void {
    const leaflet = this.requireLeaflet();
    const layers = this.requireLayers();
    layers.clearLayers();
    this.currentModel = structuredClone(model);

    for (const path of model.paths) {
      if (path.points.length < 2) continue;
      leaflet
        .polyline(
          path.points.map((point) => [point.lat, point.lng] as [number, number]),
          {
            weight: path.kind === 'transfer' ? 4 : 5,
            opacity: path.estimated ? 0.6 : 0.9,
            dashArray: path.estimated ? '8 7' : undefined,
          },
        )
        .addTo(layers);
    }

    for (const marker of model.markers) {
      const selected = marker.id === (model.selectedId ?? this.selectedId);
      leaflet
        .circleMarker([marker.position.lat, marker.position.lng], {
          radius: selected ? 10 : 7,
          weight: selected ? 4 : 2,
          fillOpacity: 0.85,
        })
        .bindTooltip(marker.label.en ?? marker.label['zh-CN'] ?? marker.id)
        .addTo(layers);
    }

    if (model.bounds) this.fitBounds(model.bounds);
  }

  fitBounds(bounds: BoundingBox): void {
    const leaflet = this.requireLeaflet();
    const map = this.requireMap();
    const [west, south, east, north] = bounds;
    map.fitBounds(leaflet.latLngBounds([south, west], [north, east]), { padding: [24, 24] });
  }

  select(featureId: string | null): void {
    this.selectedId = featureId;
    if (this.currentModel) this.render({ ...this.currentModel, selectedId: featureId ?? undefined });
  }

  resize(): void {
    this.requireMap().invalidateSize();
  }

  destroy(): void {
    this.layers?.clearLayers();
    this.map?.remove();
    this.layers = null;
    this.map = null;
    this.leaflet = null;
    this.currentModel = null;
    this.selectedId = null;
  }

  private requireLeaflet(): LeafletModule {
    if (!this.leaflet) throw new Error('Leaflet adapter is not mounted.');
    return this.leaflet;
  }

  private requireMap(): LeafletMap {
    if (!this.map) throw new Error('Leaflet adapter is not mounted.');
    return this.map;
  }

  private requireLayers(): LeafletLayerGroup {
    if (!this.layers) throw new Error('Leaflet adapter is not mounted.');
    return this.layers;
  }
}

export function buildBounds(coordinates: Wgs84Coordinate[]): BoundingBox | undefined {
  if (coordinates.length === 0) return undefined;
  const lngs = coordinates.map((item) => item.lng);
  const lats = coordinates.map((item) => item.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export function wgs84ToGcj02(coordinate: Wgs84Coordinate): Wgs84Coordinate {
  const { lng, lat } = coordinate;
  if (outsideChina(lng, lat)) return { ...coordinate };
  const a = 6_378_245;
  const ee = 0.006693421622965943;
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

export function gcj02ToWgs84(coordinate: Wgs84Coordinate): Wgs84Coordinate {
  if (outsideChina(coordinate.lng, coordinate.lat)) return { ...coordinate };
  let estimate = { ...coordinate };
  for (let index = 0; index < 6; index += 1) {
    const converted = wgs84ToGcj02(estimate);
    estimate = {
      lat: estimate.lat - (converted.lat - coordinate.lat),
      lng: estimate.lng - (converted.lng - coordinate.lng),
    };
  }
  return estimate;
}

function outsideChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let result = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  result += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  result += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3;
  return result;
}

function transformLng(x: number, y: number): number {
  let result = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  result += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  result += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3;
  return result;
}

function assertMounted(mounted: boolean, id: string): void {
  if (!mounted) throw new Error(`${id} map adapter is not mounted.`);
}
