import type { PlanningCatalog, TravelTimeMatrix, TripRequest } from '@global-travel-plans/domain';
import qingdao from './destinations/qingdao.json';
import singapore from './destinations/singapore.json';
import weatherSuccess from './provider-responses/weather-success.json';
import weatherUnavailable from './provider-responses/weather-unavailable.json';
import sources from './sources/demo-sources.json';
import request from './trip-requests/qingdao-singapore.json';
import matrix from './travel-time-matrices/qingdao-singapore.json';

export const demoCatalogRaw: PlanningCatalog = {
  version: 'global-demo-1',
  places: [qingdao.place, singapore.place] as PlanningCatalog['places'],
  planningUnits: [
    ...qingdao.planningUnits,
    ...singapore.planningUnits,
  ] as PlanningCatalog['planningUnits'],
  pois: [...qingdao.pois, ...singapore.pois] as PlanningCatalog['pois'],
  sources: sources as PlanningCatalog['sources'],
};

export const demoTripRequestRaw = request as TripRequest;
export const demoTravelTimeMatrix = matrix as TravelTimeMatrix;
export const providerFixtures = { weatherSuccess, weatherUnavailable };
