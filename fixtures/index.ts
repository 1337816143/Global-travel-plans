import { parsePlanningCatalog, parseTripRequest } from '@global-travel-plans/data-schema';
import type { TravelTimeMatrix } from '@global-travel-plans/domain';
import qingdao from './destinations/qingdao.json';
import singapore from './destinations/singapore.json';
import weatherSuccess from './provider-responses/weather-success.json';
import weatherUnavailable from './provider-responses/weather-unavailable.json';
import sources from './sources/demo-sources.json';
import request from './trip-requests/qingdao-singapore.json';
import matrix from './travel-time-matrices/qingdao-singapore.json';

export const demoCatalogRaw = parsePlanningCatalog({
  version: 'global-demo-1',
  places: [qingdao.place, singapore.place],
  planningUnits: [...qingdao.planningUnits, ...singapore.planningUnits],
  pois: [...qingdao.pois, ...singapore.pois],
  sources,
});

export const demoTripRequestRaw = parseTripRequest(request);
export const demoTravelTimeMatrix = matrix as TravelTimeMatrix;
export const providerFixtures = { weatherSuccess, weatherUnavailable };
