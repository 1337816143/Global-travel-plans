import { LeafletMapAdapter, type MapRenderModel } from '@global-travel-plans/map-adapters';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MapPanelProps {
  model: MapRenderModel;
}

export function MapPanel({ model }: MapPanelProps) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<LeafletMapAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const adapter = new LeafletMapAdapter();
    adapterRef.current = adapter;
    let cancelled = false;

    void adapter
      .mount(container, {
        center: { lat: 20, lng: 112 },
        zoom: 3,
        tileUrl: import.meta.env.VITE_GTP_TILE_URL,
        attribution: import.meta.env.VITE_GTP_TILE_ATTRIBUTION,
        locale: i18n.language,
      })
      .then(() => {
        if (cancelled) return;
        adapter.render(model);
        setError(null);
      })
      .catch((mountError: unknown) => {
        if (cancelled) return;
        setError(mountError instanceof Error ? mountError.message : t('mapFallback'));
      });

    return () => {
      cancelled = true;
      adapter.destroy();
      adapterRef.current = null;
    };
  }, [i18n.language, t]);

  useEffect(() => {
    try {
      adapterRef.current?.render(model);
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : t('mapFallback'));
    }
  }, [model, t]);

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-canvas" aria-label={t('map')} />
      {error ? (
        <div className="map-fallback" role="status">
          <strong>{t('mapFallback')}</strong>
          <small>{error}</small>
        </div>
      ) : null}
      <p className="map-caption">
        {t('estimated')}: dashed straight-line illustrations are not measured transport routes.
      </p>
    </div>
  );
}
