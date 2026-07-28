import { parsePlanningCatalog, parseTripPlan, parseTripRequest } from '@global-travel-plans/data-schema';
import { localize, type Activity, type TripDay, type TripEdit } from '@global-travel-plans/domain';
import { planTrip, replanTrip, validateTripPlan } from '@global-travel-plans/planner';
import {
  BrowserJsonExportProvider,
  UnavailableWeatherProvider,
  collectCapabilities,
} from '@global-travel-plans/providers';
import { useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  demoCatalogRaw,
  demoTravelTimeMatrix,
  demoTripRequestRaw,
} from '../../../../fixtures';
import { MapPanel } from './MapPanel';
import {
  buildMapRenderModel,
  buildTripRequest,
  createPlannerInput,
  createShareEnvelope,
  parseShareEnvelope,
  reorder,
  serializeShareEnvelope,
  type PlannerFormState,
} from './model';

const catalog = parsePlanningCatalog(demoCatalogRaw);
const baseRequest = parseTripRequest(demoTripRequestRaw);
const exporter = new BrowserJsonExportProvider();
const weatherProvider = new UnavailableWeatherProvider();
const interestOptions = ['culture', 'coast', 'museum', 'photography', 'nature'] as const;

export function App() {
  const { t, i18n } = useTranslation();
  const initialForm: PlannerFormState = {
    destinationIds: baseRequest.destinations.map((item) => item.placeId),
    totalDays: dateCount(baseRequest.startDate, baseRequest.endDate),
    startDate: baseRequest.startDate,
    pace: baseRequest.pace,
    budget: baseRequest.budget,
    physicalLevel: baseRequest.physicalLevel,
    interests: [...baseRequest.interests],
    language: baseRequest.language,
    currency: baseRequest.currency,
  };
  const [form, setForm] = useState<PlannerFormState>(initialForm);
  const [request, setRequest] = useState(baseRequest);
  const [plan, setPlan] = useState(() =>
    planTrip(createPlannerInput(baseRequest, catalog, demoTravelTimeMatrix)),
  );
  const [edits, setEdits] = useState<TripEdit[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [notice, setNotice] = useState(t('generated'));
  const [draggedDestination, setDraggedDestination] = useState<string>();
  const [draggedActivity, setDraggedActivity] = useState<string>();
  const mapModel = useMemo(
    () => buildMapRenderModel(plan, catalog, selectedId),
    [plan, selectedId],
  );
  const capabilities = useMemo(
    () => collectCapabilities({ weather: weatherProvider, export: exporter }),
    [],
  );

  const generateFromForm = (nextForm: PlannerFormState) => {
    if (nextForm.destinationIds.length === 0) {
      setNotice(t('selectDestination'));
      return;
    }
    try {
      const nextRequest = buildTripRequest(baseRequest, nextForm, catalog);
      const nextPlan = planTrip(
        createPlannerInput(nextRequest, catalog, demoTravelTimeMatrix),
      );
      setRequest(nextRequest);
      setPlan(nextPlan);
      setEdits([]);
      setSelectedId(undefined);
      setNotice(t('generated'));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('invalidImport'));
    }
  };

  const updateForm = <K extends keyof PlannerFormState>(key: K, value: PlannerFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleDestination = (placeId: string) => {
    const nextIds = form.destinationIds.includes(placeId)
      ? form.destinationIds.filter((id) => id !== placeId)
      : [...form.destinationIds, placeId];
    updateForm('destinationIds', nextIds);
  };

  const dropDestination = (targetId: string) => {
    if (!draggedDestination || draggedDestination === targetId) return;
    const sourceIndex = form.destinationIds.indexOf(draggedDestination);
    const targetIndex = form.destinationIds.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const nextForm = {
      ...form,
      destinationIds: reorder(form.destinationIds, sourceIndex, targetIndex),
    };
    setForm(nextForm);
    setDraggedDestination(undefined);
    generateFromForm(nextForm);
  };

  const applyEdit = (edit: TripEdit) => {
    const nextEdits = [...edits, edit];
    const nextPlan = replanTrip(
      createPlannerInput(request, catalog, demoTravelTimeMatrix),
      plan,
      nextEdits,
    );
    setEdits(nextEdits);
    setPlan(nextPlan);
    setNotice(t('generated'));
  };

  const moveActivity = (activityId: string, targetDay: TripDay) => {
    const activity = findActivity(activityId);
    if (!activity?.poiId || activity.locked || activity.placeId !== targetDay.placeId) {
      setNotice(t('invalidMove'));
      return;
    }
    applyEdit({ type: 'move-activity', activityId, targetDayId: targetDay.id });
    setDraggedActivity(undefined);
  };

  const moveRelative = (activity: Activity, direction: -1 | 1) => {
    const currentIndex = plan.days.findIndex((day) => day.localDate === activity.localDate);
    const compatible = plan.days.filter((day) => day.placeId === activity.placeId);
    const currentCompatibleIndex = compatible.findIndex((day) => day.id === plan.days[currentIndex]?.id);
    const target = compatible[currentCompatibleIndex + direction];
    if (!target) {
      setNotice(t('invalidMove'));
      return;
    }
    moveActivity(activity.id, target);
  };

  const findActivity = (activityId: string) =>
    plan.days.flatMap((day) => day.activities).find((activity) => activity.id === activityId);

  const changeLanguage = async () => {
    const nextLanguage = i18n.language === 'zh-CN' ? 'en' : 'zh-CN';
    await i18n.changeLanguage(nextLanguage);
    updateForm('language', nextLanguage);
  };

  const shareText = () =>
    serializeShareEnvelope(createShareEnvelope(request, plan, edits));

  const downloadShareJson = async () => {
    const result = await exporter.exportJson(createShareEnvelope(request, plan, edits));
    if (!result.data) return;
    const url = URL.createObjectURL(new Blob([result.data], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `global-travel-plan-${request.startDate}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyShareJson = async () => {
    try {
      await navigator.clipboard.writeText(shareText());
      setNotice(t('copied'));
    } catch {
      setNotice(t('invalidImport'));
    }
  };

  const importShareJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const envelope = parseShareEnvelope(JSON.parse(await file.text()) as unknown);
      const violations = validateTripPlan(envelope.plan, envelope.request, catalog);
      if (violations.some((item) => item.severity === 'error')) {
        throw new Error('Imported plan violates current invariants.');
      }
      const importedPlan = parseTripPlan(envelope.plan);
      const importedRequest = parseTripRequest(envelope.request);
      setRequest(importedRequest);
      setPlan(importedPlan);
      setEdits(envelope.edits);
      setForm({
        destinationIds: importedRequest.destinations.map((item) => item.placeId),
        totalDays: dateCount(importedRequest.startDate, importedRequest.endDate),
        startDate: importedRequest.startDate,
        pace: importedRequest.pace,
        budget: importedRequest.budget,
        physicalLevel: importedRequest.physicalLevel,
        interests: [...importedRequest.interests],
        language: importedRequest.language,
        currency: importedRequest.currency,
      });
      await i18n.changeLanguage(importedRequest.language);
      setNotice(t('imported'));
    } catch (error) {
      setNotice(error instanceof Error ? `${t('invalidImport')} ${error.message}` : t('invalidImport'));
    }
  };

  const placeName = (placeId: string) => {
    const place = catalog.places.find((item) => item.id === placeId);
    return place ? localize(place.names, i18n.language) : placeId;
  };

  return (
    <div className="app-shell">
      <header className="hero no-print">
        <div>
          <span className="eyebrow">{t('demoBadge')}</span>
          <h1>{t('appTitle')}</h1>
          <p>{t('appSubtitle')}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="secondary" onClick={() => void changeLanguage()}>
            {i18n.language === 'zh-CN' ? 'English' : '中文'}
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>
            {t('print')}
          </button>
        </div>
      </header>

      <div className="notice" role="status" aria-live="polite">
        {notice}
      </div>

      <main className="workspace">
        <aside className="planner-panel no-print">
          <h2>{t('constraints')}</h2>
          <p className="muted">{t('fixtureNotice')}</p>

          <fieldset>
            <legend>{t('destinations')}</legend>
            <p className="hint">{t('dragDestination')}</p>
            <div className="destination-list">
              {catalog.places.map((place) => {
                const selected = form.destinationIds.includes(place.id);
                return (
                  <label
                    key={place.id}
                    className={`destination-chip ${selected ? 'selected' : ''}`}
                    draggable={selected}
                    onDragStart={() => setDraggedDestination(place.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropDestination(place.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleDestination(place.id)}
                    />
                    <span>{localize(place.names, i18n.language)}</span>
                    <small>{place.timezoneIds[0]} · {place.currencies[0]}</small>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="form-grid">
            <label>
              <span>{t('startDate')}</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => updateForm('startDate', event.target.value)}
              />
            </label>
            <label>
              <span>{t('totalDays')}</span>
              <input
                type="number"
                min={1}
                max={30}
                value={form.totalDays}
                onChange={(event) => updateForm('totalDays', Number(event.target.value))}
              />
            </label>
            <label>
              <span>{t('pace')}</span>
              <select
                value={form.pace}
                onChange={(event) =>
                  updateForm('pace', event.target.value as PlannerFormState['pace'])
                }
              >
                <option value="relaxed">{t('relaxed')}</option>
                <option value="balanced">{t('balanced')}</option>
                <option value="intensive">{t('intensive')}</option>
              </select>
            </label>
            <label>
              <span>{t('budget')}</span>
              <select
                value={form.budget}
                onChange={(event) =>
                  updateForm('budget', event.target.value as PlannerFormState['budget'])
                }
              >
                <option value="economy">{t('economy')}</option>
                <option value="standard">{t('standard')}</option>
                <option value="comfort">{t('comfort')}</option>
                <option value="premium">{t('premium')}</option>
              </select>
            </label>
            <label>
              <span>{t('physical')}</span>
              <select
                value={form.physicalLevel}
                onChange={(event) =>
                  updateForm(
                    'physicalLevel',
                    event.target.value as PlannerFormState['physicalLevel'],
                  )
                }
              >
                <option value="low">{t('low')}</option>
                <option value="medium">{t('medium')}</option>
                <option value="high">{t('high')}</option>
              </select>
            </label>
          </div>

          <fieldset>
            <legend>{t('interests')}</legend>
            <div className="interest-grid">
              {interestOptions.map((interest) => (
                <label key={interest}>
                  <input
                    type="checkbox"
                    checked={form.interests.includes(interest)}
                    onChange={() =>
                      updateForm(
                        'interests',
                        form.interests.includes(interest)
                          ? form.interests.filter((item) => item !== interest)
                          : [...form.interests, interest],
                      )
                    }
                  />
                  {t(interest)}
                </label>
              ))}
            </div>
          </fieldset>

          <button type="button" className="primary wide" onClick={() => generateFromForm(form)}>
            {t('generate')}
          </button>

          <div className="share-actions">
            <button type="button" onClick={() => void downloadShareJson()}>
              {t('downloadJson')}
            </button>
            <button type="button" onClick={() => void copyShareJson()}>
              {t('copyJson')}
            </button>
            <label className="button-like">
              {t('importJson')}
              <input type="file" accept="application/json" onChange={(event) => void importShareJson(event)} />
            </label>
          </div>

          <section className="provider-card">
            <h3>{t('providerStatus')}</h3>
            {capabilities.map((capability) => (
              <div key={capability.id} className="provider-row">
                <code>{capability.id}</code>
                <span className={capability.available ? 'status-ok' : 'status-muted'}>
                  {capability.available ? t('fresh') : t('providerUnavailable')}
                </span>
              </div>
            ))}
          </section>
        </aside>

        <section className="result-panel">
          <section className="map-section no-print">
            <div className="section-heading">
              <div>
                <h2>{t('map')}</h2>
                <p>{t('fixtureNotice')}</p>
              </div>
            </div>
            <MapPanel model={mapModel} />
          </section>

          <section className="itinerary-section">
            <div className="section-heading">
              <div>
                <h2>{t('itinerary')}</h2>
                <p>{t('currentVersion', { version: __APP_VERSION__, sha: __BUILD_SHA__.slice(0, 8) })}</p>
              </div>
              <span className={`plan-status ${plan.status}`}>{plan.status}</span>
            </div>

            <div className="day-list">
              {plan.days.map((day) => (
                <article
                  key={day.id}
                  className="day-card"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => draggedActivity && moveActivity(draggedActivity, day)}
                >
                  <header>
                    <div>
                      <h3>{t('dayLabel', { date: day.localDate, place: placeName(day.placeId) })}</h3>
                      <p>{day.timezoneId}</p>
                    </div>
                    <small>{t('dropHint')}</small>
                  </header>
                  <ol className="activity-list">
                    {day.activities.map((activity) => {
                      const outgoingLeg = day.travelLegs.find(
                        (leg) => leg.originActivityId === activity.id,
                      );
                      return (
                        <li key={activity.id}>
                          <div
                            className={`activity-card ${activity.locked ? 'locked' : ''}`}
                            draggable={activity.kind === 'poi' && !activity.locked}
                            onDragStart={() => setDraggedActivity(activity.id)}
                            onClick={() => setSelectedId(activity.id)}
                          >
                            <div className="activity-time">
                              <strong>{activity.startTime}</strong>
                              <span>{activity.endTime}</span>
                            </div>
                            <div className="activity-content">
                              <div className="activity-title-row">
                                <h4>{localize(activity.title, i18n.language)}</h4>
                                {activity.estimate ? <span className="tag">{t('estimated')}</span> : null}
                                {activity.locked ? <span className="tag locked-tag">{t('locked')}</span> : null}
                              </div>
                              <p>{activity.reasonCodes.join(' · ')}</p>
                              {activity.kind === 'poi' ? (
                                <div className="activity-actions no-print">
                                  <button type="button" onClick={(event) => { event.stopPropagation(); moveRelative(activity, -1); }}>
                                    {t('movePrevious')}
                                  </button>
                                  <button type="button" onClick={(event) => { event.stopPropagation(); moveRelative(activity, 1); }}>
                                    {t('moveNext')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      applyEdit({ type: 'set-lock', activityId: activity.id, locked: !activity.locked });
                                    }}
                                  >
                                    {activity.locked ? t('unlock') : t('lock')}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {outgoingLeg ? (
                            <div className="travel-leg">
                              <span>{t('travel')}</span>
                              <strong>{t('minutes', { count: outgoingLeg.durationMinutes })}</strong>
                              <small>{outgoingLeg.mode} · {outgoingLeg.method} · {outgoingLeg.confidence}</small>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </article>
              ))}
            </div>
          </section>

          <div className="support-grid">
            <section className="support-card">
              <h2>{t('accommodation')}</h2>
              <p className="warning-box">{t('hotelNotice')}</p>
              {plan.accommodationStays.map((stay) => (
                <div key={stay.id} className="stay-row">
                  <strong>{placeName(stay.placeId)}</strong>
                  <span>{stay.planningUnitId}</span>
                  <small>{t('checkIn')}: {stay.checkInDate} · {t('checkOut')}: {stay.checkOutDate}</small>
                </div>
              ))}
            </section>

            <section className="support-card">
              <h2>{t('conflicts')}</h2>
              {plan.unresolvedConflicts.length === 0 ? (
                <p className="success-box">{t('noConflicts')}</p>
              ) : (
                <ul className="plain-list">
                  {plan.unresolvedConflicts.map((conflict) => (
                    <li key={conflict.id} className={`conflict ${conflict.severity}`}>
                      <strong>{t(conflict.severity)} · {conflict.code}</strong>
                      <span>{localize(conflict.message, i18n.language)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="support-card">
              <h2>{t('assumptions')}</h2>
              <ul className="plain-list">
                {plan.assumptions.map((assumption) => (
                  <li key={assumption.id}>
                    <strong>{assumption.code}</strong>
                    <span>{localize(assumption.message, i18n.language)}</span>
                  </li>
                ))}
                {plan.degradationMessages.map((message, index) => (
                  <li key={`degradation-${index}`}>
                    <strong>{t('unavailable')}</strong>
                    <span>{localize(message, i18n.language)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="support-card">
              <h2>{t('freshness')}</h2>
              <div className="metric-row">
                <span>{t('fresh')}<strong>{plan.freshness.fresh}</strong></span>
                <span>{t('stale')}<strong>{plan.freshness.stale}</strong></span>
                <span>{t('unavailable')}<strong>{plan.freshness.unavailable}</strong></span>
              </div>
            </section>
          </div>

          <section className="sources-section">
            <h2>{t('sources')}</h2>
            <div className="source-grid">
              {catalog.sources.map((source) => (
                <article key={source.id} className="source-card">
                  <h3>{source.title}</h3>
                  <p>{source.licenseNotes}</p>
                  <small>{t('sourceConfidence', { value: source.confidence })}</small>
                  <a href={source.url} target="_blank" rel="noreferrer">{source.publisher ?? t('manualReview')}</a>
                </article>
              ))}
            </div>
            <p className="legacy-note">{t('legacy')}</p>
          </section>
        </section>
      </main>
    </div>
  );
}

function dateCount(startDate: string, endDate: string): number {
  return Math.floor(
    (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) /
      86_400_000,
  ) + 1;
}
