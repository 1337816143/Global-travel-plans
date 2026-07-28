import { parsePlanningCatalog, parseTripRequest } from '@global-travel-plans/data-schema';
import { parseTravelTimeMatrix } from '@global-travel-plans/data-schema/travel-time';
import { demoCatalogRaw, demoTravelTimeMatrix, demoTripRequestRaw } from '../../fixtures';

const catalog = parsePlanningCatalog(demoCatalogRaw);
const request = parseTripRequest(demoTripRequestRaw);
const matrix = parseTravelTimeMatrix(demoTravelTimeMatrix);

const poiIds = new Set(catalog.pois.map((poi) => poi.id));
const sourceIds = new Set(catalog.sources.map((source) => source.id));
const placeIds = new Set(catalog.places.map((place) => place.id));
const errors: string[] = [];

for (const destination of request.destinations) {
  if (!placeIds.has(destination.placeId)) errors.push(`Unknown destination: ${destination.placeId}`);
}
for (const poiId of [...request.mustVisitPoiIds, ...request.excludedPoiIds]) {
  if (!poiIds.has(poiId)) errors.push(`Unknown request POI: ${poiId}`);
}
for (const entry of matrix.entries) {
  if (!poiIds.has(entry.fromPoiId)) errors.push(`Unknown matrix origin: ${entry.fromPoiId}`);
  if (!poiIds.has(entry.toPoiId)) errors.push(`Unknown matrix destination: ${entry.toPoiId}`);
  for (const sourceRef of entry.sourceRefs) {
    if (!sourceIds.has(sourceRef)) errors.push(`Unknown matrix source: ${sourceRef}`);
  }
  if (entry.method === 'estimate' && entry.confidence === 'high') {
    errors.push(`Estimated matrix entry cannot be high confidence: ${entry.fromPoiId} -> ${entry.toPoiId}`);
  }
}

if (errors.length > 0) {
  console.error(JSON.stringify({ valid: false, errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        valid: true,
        dataVersion: catalog.version,
        counts: {
          places: catalog.places.length,
          planningUnits: catalog.planningUnits.length,
          pois: catalog.pois.length,
          sources: catalog.sources.length,
          matrixEntries: matrix.entries.length,
          destinations: request.destinations.length,
        },
        coverage: {
          countries: [...new Set(catalog.places.map((place) => place.countryCode))].sort(),
          timezones: [...new Set(catalog.places.flatMap((place) => place.timezoneIds))].sort(),
          currencies: [...new Set(catalog.places.flatMap((place) => place.currencies))].sort(),
          languages: [...new Set(catalog.places.flatMap((place) => place.languages))].sort(),
        },
        fixtureOnly: true,
      },
      null,
      2,
    ),
  );
}
