import {
  sleepMetricDefinitions,
  sleepSources,
  canonicalSleepSource,
  type SleepMetricDefinition,
} from '../../api/src/sleep-records/metrics.js';
import { sleepMetricSettingsApi } from './api.js';
import { LitElement, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { sleepRecordsApi, type SleepRecord, type SleepSession } from './api.js';
import {
  combineDateTime,
  coverageLabels,
  defaultMainSleepTimes,
  draftFromRecord,
  durationFromTimes,
  firstSessionToDate,
  formatDuration,
  moveSession,
  newSession,
  newSleepDraft,
  durationValue,
  previewSessions,
  removeSession,
  splitDateTime,
  syncNapDates,
  typeLabels,
  validateDraft,
  type DurationDraft,
  type DurationKey,
  type FieldErrors,
  type MeasurementsDraft,
  type SessionDraft,
  type SleepDraft,
} from './sleep-editor.js';
import type { RecordActions } from './record-actions.js';
import './record-actions.js';
import './sleep-monthly-page.js';
import {
  parseSleepRoute,
  sleepEditorUrl,
  type SleepRoute,
} from './sleep-routes.js';
import { previousCalendarDay } from './pap-date.js';
import {
  emptyDateFilter,
  hasActiveFilter,
  parseDateFilter,
  updateDateFilterHash,
  type DateFilter,
} from './measurement-filter-helpers.js';

export class SleepPage extends LitElement {
  static properties = {
    records: { state: true },
    loading: { state: true },
    saving: { state: true },
    deletingId: { state: true },
    error: { state: true },
    draft: { state: true },
    errors: { state: true },
    route: { state: true },
    notice: { state: true },
    filter: { state: true },
    draftFilter: { state: true },
  };
  declare private records: SleepRecord[];
  declare private loading: boolean;
  declare private saving: boolean;
  declare private deletingId: string | null;
  declare private error: string | null;
  declare private draft: SleepDraft;
  declare private errors: FieldErrors;
  declare private route: SleepRoute;
  declare private filter: DateFilter;
  declare private draftFilter: DateFilter;
  private definitions: SleepMetricDefinition[] = sleepMetricDefinitions;
  private loadVersion = 0;
  private applicable(key: string, source = this.draft.source) {
    const d = this.definitions.find((d) => d.key === key);
    return (
      !!d?.enabled &&
      (!d.sources.length || d.sources.includes(canonicalSleepSource(source)))
    );
  }
  private sourceOptions(value: string, inherit = false) {
    return html`${inherit ? html`<option value="">Use nightly measurement source</option>` : nothing}${sleepSources.map((s) => html`<option value=${s.key} ?selected=${s.key === value}>${s.label}</option>`)}${value && !sleepSources.some((s) => s.key === value) ? html`<option value=${value} selected>${value} (existing source)</option>` : nothing}`;
  }
  declare private notice: string;
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  constructor() {
    super();
    this.records = [];
    this.loading = true;
    this.saving = false;
    this.deletingId = null;
    this.error = null;
    this.draft = newSleepDraft();
    this.errors = {};
    this.route = parseSleepRoute(window.location.hash);
    this.notice = '';
    this.filter = parseDateFilter();
    this.draftFilter = { ...this.filter };
  }
  protected createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.handleRouteChange);
    void sleepMetricSettingsApi
      .list()
      .then((d) => {
        this.definitions = d;
        this.requestUpdate();
      })
      .catch(() => {
        this.error =
          'Unable to load sleep measurement settings. Reload before editing.';
      });
    void this.loadRoute();
  }
  disconnectedCallback() {
    window.removeEventListener('hashchange', this.handleRouteChange);
    this.loadVersion++;
    super.disconnectedCallback();
  }
  private handleRouteChange = () => {
    this.route = parseSleepRoute(window.location.hash);
    this.filter = parseDateFilter();
    this.draftFilter = { ...this.filter };
    void this.loadRoute();
  };
  private async loadRoute() {
    const version = ++this.loadVersion;
    this.loading = true;
    this.error = null;
    this.errors = {};
    this.notice = '';
    this.saving = false;
    this.draft = newSleepDraft();
    try {
      if (this.route.kind === 'invalid')
        throw new Error('Invalid sleep record ID.');
      if (this.route.kind === 'list') {
        const records = await sleepRecordsApi.list(this.filter);
        if (version === this.loadVersion) this.records = records;
      } else if (this.route.kind === 'edit') {
        const record = await sleepRecordsApi.get(this.route.id!);
        if (version === this.loadVersion) this.draft = draftFromRecord(record);
      }
    } catch (error) {
      if (version === this.loadVersion)
        this.error =
          error instanceof Error
            ? error.message
            : 'Unable to load sleep record.';
    } finally {
      if (version === this.loadVersion) this.loading = false;
    }
  }
  private applyFilter(event: SubmitEvent) {
    event.preventDefault();
    const hash = updateDateFilterHash('#/measurements/sleep', this.draftFilter);
    if (window.location.hash === hash) {
      this.filter = { ...this.draftFilter };
      void this.loadRoute();
    } else {
      window.location.hash = hash;
    }
  }
  private clearFilter() {
    this.draftFilter = emptyDateFilter();
    const hash = updateDateFilterHash(
      '#/measurements/sleep',
      emptyDateFilter(),
    );
    if (window.location.hash === hash) {
      this.filter = emptyDateFilter();
      void this.loadRoute();
    } else {
      window.location.hash = hash;
    }
  }
  private returnToList() {
    window.location.hash = this.route.returnTo;
  }
  private setField(
    key: 'sleepDate' | 'sleepScore' | 'source' | 'notes',
    value: string,
  ) {
    if (key === 'sleepDate' && !this.draft.id) {
      const fromDate = previousCalendarDay(value);
      const toDate = value;
      let sessions =
        fromDate && toDate
          ? this.draft.sessions.map((session) => {
              if (session.sessionType === 'main-sleep') {
                const startTime = session.startedAt.includes('T')
                  ? session.startedAt.slice(session.startedAt.indexOf('T'))
                  : 'T23:00';
                const endTime = session.endedAt.includes('T')
                  ? session.endedAt.slice(session.endedAt.indexOf('T'))
                  : 'T07:00';
                return {
                  ...session,
                  startedAt: session.startedAt
                    ? `${fromDate}${startTime}`
                    : session.startedAt,
                  endedAt: session.endedAt
                    ? `${toDate}${endTime}`
                    : session.endedAt,
                };
              }
              return session;
            })
          : this.draft.sessions;
      if (toDate) {
        sessions = syncNapDates(sessions, toDate);
      }
      this.draft = { ...this.draft, sleepDate: value, sessions };
      this.clearError(key);
      return;
    }
    this.draft = { ...this.draft, [key]: value };
    this.clearError(key);
  }
  private clearError(key: string) {
    const errors = { ...this.errors };
    delete errors[key];
    this.errors = errors;
    this.notice = '';
  }
  private setSummary(
    key: DurationKey | 'awakeCount',
    value: DurationDraft | string,
  ) {
    this.draft = {
      ...this.draft,
      summary: { ...this.draft.summary, [key]: value },
    };
    this.clearError(key);
  }
  private setSession(
    index: number,
    change: Partial<SessionDraft>,
    field?: string,
  ) {
    if (change.sessionType === 'main-sleep') {
      const current = this.draft.sessions[index];
      if (current && !current.startedAt && !current.endedAt) {
        const toDate = firstSessionToDate(this.draft);
        change = { ...change, ...defaultMainSleepTimes(toDate) };
      }
    }
    const current = this.draft.sessions[index];
    const newStartedAt =
      change.startedAt !== undefined
        ? change.startedAt
        : (current?.startedAt ?? '');
    const newEndedAt =
      change.endedAt !== undefined ? change.endedAt : (current?.endedAt ?? '');

    const isManual =
      change.manualTotalSleep !== undefined
        ? change.manualTotalSleep
        : (current?.manualTotalSleep ?? false);

    if (
      (change.startedAt !== undefined || change.endedAt !== undefined) &&
      change.totalSleepMinutes === undefined
    ) {
      if (!isManual && newStartedAt && newEndedAt) {
        const auto = durationFromTimes(newStartedAt, newEndedAt);
        if (auto) {
          change = { ...change, totalSleepMinutes: auto };
          this.clearError(`sessions.${index}.totalSleepMinutes`);
        }
      }
    }

    let sessions = this.draft.sessions.map((session, i) =>
      i === index ? { ...session, ...change } : session,
    );
    if (index === 0 && change.endedAt !== undefined && !this.draft.id) {
      const toDate = change.endedAt.includes('T')
        ? change.endedAt.slice(0, change.endedAt.indexOf('T'))
        : '';
      sessions = syncNapDates(sessions, toDate);
    }
    this.draft = { ...this.draft, sessions };
    if (field) this.clearError(`sessions.${index}.${field}`);
    if (change.startedAt !== undefined)
      this.clearError(`sessions.${index}.startedAt`);
    if (change.endedAt !== undefined)
      this.clearError(`sessions.${index}.endedAt`);
  }
  private async addSession() {
    const sessionType =
      this.draft.detailMode === 'summary' || this.draft.sessions.length
        ? 'nap'
        : 'main-sleep';
    const session = newSession(sessionType);
    if (sessionType === 'nap') {
      session.source = 'manual';
      session.detailsOpen = this.draft.totalScope === 'overnight';
    }
    if (!this.draft.id && sessionType === 'main-sleep') {
      const toDate = firstSessionToDate(this.draft);
      Object.assign(session, defaultMainSleepTimes(toDate));
    } else {
      session.startedAt =
        this.draft.totalScope === 'overnight' ? this.draft.sleepDate : '';
      session.endedAt = '';
    }
    this.draft = { ...this.draft, sessions: [...this.draft.sessions, session] };
    this.errors = {};
    this.notice = 'Session added.';
    await this.updateComplete;
    this.querySelector<HTMLSelectElement>(`#${session.key}-type`)?.focus();
  }
  private async reorderSession(index: number, direction: -1 | 1) {
    const key = this.draft.sessions[index]!.key;
    this.draft = {
      ...this.draft,
      sessions: moveSession(this.draft.sessions, index, direction),
    };
    this.errors = {};
    this.notice = `Session moved to position ${index + direction + 1}.`;
    await this.updateComplete;
    this.querySelector<HTMLElement>(`#${key}-heading`)?.focus();
  }
  private async deleteSession(index: number) {
    const session = this.draft.sessions[index]!;
    const populated = [
      session.label,
      session.source,
      session.startedAt,
      session.endedAt,
      session.awakeCount,
      ...Object.values(session.awakeMinutes),
      ...Object.values(session.totalSleepMinutes),
      ...Object.values(session.deepMinutes),
      ...Object.values(session.lightMinutes),
      ...Object.values(session.remMinutes),
    ].some((value) => value !== '');
    if (
      (this.draft.detailMode === 'sessions' &&
        this.draft.sessions.length === 1) ||
      (populated &&
        !window.confirm(
          `Remove session ${index + 1} (${typeLabels[session.sessionType]}) and its entered values?`,
        ))
    )
      return;
    this.draft = {
      ...this.draft,
      sessions:
        this.draft.detailMode === 'summary'
          ? this.draft.sessions.filter((s) => s.key !== session.key)
          : removeSession(this.draft.sessions, this.draft.sessions[index]!.key),
    };
    this.errors = {};
    this.notice = `Session ${index + 1} removed. Changes are not saved yet.`;
    await this.updateComplete;
    const next =
      this.draft.sessions[Math.min(index, this.draft.sessions.length - 1)];
    this.querySelector<HTMLElement>(`#${next?.key}-heading`)?.focus();
  }
  private async submit(event: SubmitEvent) {
    event.preventDefault();
    if (this.saving) return;
    const result = validateDraft(this.draft);
    this.errors = result.errors;
    for (const input of this.querySelectorAll<HTMLInputElement>(
      'form input[data-field]',
    )) {
      if (input.validity.badInput)
        this.errors[input.dataset.field!] =
          'Enter a valid number or date, or clear the field.';
    }
    if (Object.keys(this.errors).length || !result.input) {
      this.draft = {
        ...this.draft,
        sessions: this.draft.sessions.map((session, index) => ({
          ...session,
          detailsOpen:
            session.detailsOpen ||
            Object.keys(this.errors).some((key) =>
              key.startsWith(`sessions.${index}.`),
            ),
        })),
      };
      await this.updateComplete;
      this.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const version = this.loadVersion;
    this.saving = true;
    this.error = null;
    this.notice = '';
    try {
      const saved = this.draft.id
        ? await sleepRecordsApi.update(this.draft.id, result.input)
        : await sleepRecordsApi.create(result.input);
      if (version !== this.loadVersion) return;
      this.draft = draftFromRecord(saved);
      this.errors = {};
      this.returnToList();
    } catch (error) {
      if (version === this.loadVersion)
        this.error =
          error instanceof Error
            ? error.message
            : 'Unable to save sleep record.';
    } finally {
      if (version === this.loadVersion) this.saving = false;
    }
  }
  private async deleteRecord(record: SleepRecord) {
    if (
      this.deletingId ||
      !window.confirm(
        `Delete the sleep record for ${this.formatDate(record.sleepDate)} and all its sessions?`,
      )
    )
      return;
    const version = this.loadVersion;
    const index = this.records.findIndex(({ id }) => id === record.id);
    this.deletingId = record.id;
    this.error = null;
    try {
      await sleepRecordsApi.delete(record.id);
      if (version === this.loadVersion)
        this.records = this.records.filter(({ id }) => id !== record.id);
    } catch (error) {
      if (version === this.loadVersion)
        this.error =
          error instanceof Error
            ? error.message
            : 'Unable to delete sleep record.';
    } finally {
      this.deletingId = null;
      await this.updateComplete;
      if (version === this.loadVersion) {
        const next =
          this.records.find(({ id }) => id === record.id) ??
          this.records[Math.min(index, this.records.length - 1)];
        if (next)
          this.querySelector<RecordActions>(
            `record-actions[data-record-id="${next.id}"]`,
          )?.focusTrigger();
        else this.querySelector<HTMLElement>('.sleep-new-link')?.focus();
      }
    }
  }
  private formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
  }
  private fieldError(key: string) {
    return this.errors[key]
      ? html`<small class="sleep-field-error" id=${`sleep-error-${key}`}
          >${this.errors[key]}</small
        >`
      : nothing;
  }
  private durationInput(
    label: string,
    key: DurationKey,
    row: MeasurementsDraft,
    set: (value: DurationDraft) => void,
    prefix = '',
  ) {
    const field = `${prefix}${key}`;
    return html`<fieldset class="duration-field">
      <legend>${label}${key === 'totalSleepMinutes' ? ' *' : ''}</legend>
      <div class="duration-inputs">
        ${(['hours', 'minutes'] as const).map(
          (part) =>
            html` <label
                ><span class="sr-only">${label} ${part}</span
                ><input
                  type="number"
                  min="0"
                  max=${part === 'minutes' ? 59 : this.draft.detailMode === 'summary' ? 24 : 35791394}
                  step="1"
                  inputmode="numeric"
                  placeholder=${part === 'hours' ? 'h' : 'min'}
                  .value=${row[key][part]}
                  data-field=${field}
                  aria-invalid=${this.errors[field] ? 'true' : 'false'}
                  aria-describedby=${this.errors[field] ? `sleep-error-${field}` : nothing}
                  @input=${(event: InputEvent) => set({ ...row[key], [part]: (event.target as HTMLInputElement).value })} /></label
              ><span>${part === 'hours' ? 'h' : 'min'}</span>`,
        )}
      </div>
      ${this.fieldError(field)}
    </fieldset>`;
  }
  private awakeInput(
    row: MeasurementsDraft,
    set: (value: string) => void,
    prefix = '',
  ) {
    const field = `${prefix}awakeCount`;
    return html`<label
      >Times awake<input
        aria-label="Times awake"
        type="number"
        min="0"
        max="2147483647"
        step="1"
        inputmode="numeric"
        placeholder="Unknown"
        .value=${row.awakeCount}
        data-field=${field}
        aria-invalid=${this.errors[field] ? 'true' : 'false'}
        aria-describedby=${this.errors[field] ? `sleep-error-${field}` : nothing}
        @input=${(event: InputEvent) => set((event.target as HTMLInputElement).value)}
      />${this.fieldError(field)}</label
    >`;
  }
  private awakeDurationInput(
    row: MeasurementsDraft,
    set: (value: DurationDraft) => void,
    prefix = '',
  ) {
    return this.durationInput(
      'Total time awake',
      'awakeMinutes',
      row,
      set,
      prefix,
    );
  }
  private optionalMeasurements(
    row: MeasurementsDraft,
    set: (
      key: DurationKey | 'awakeCount',
      value: DurationDraft | string,
    ) => void,
    prefix = '',
    source = this.draft.source,
  ) {
    return html`<div class="sleep-stage-fields sleep-fields-grid">
      ${this.definitions
        .filter((d) => this.applicable(d.key, source))
        .map((d) => {
          switch (d.key) {
            case 'deepMinutes':
            case 'lightMinutes':
            case 'remMinutes': {
              const key = d.key;
              return this.durationInput(
                d.name,
                key,
                row,
                (value) => set(key, value),
                prefix,
              );
            }
            case 'awakeCount':
              return this.awakeInput(
                row,
                (value) => set('awakeCount', value),
                prefix,
              );
            case 'awakeMinutes':
              return this.awakeDurationInput(
                row,
                (value) => set('awakeMinutes', value),
                prefix,
              );
            default:
              return nothing;
          }
        })}
    </div>`;
  }
  private updateSessionDate(
    index: number,
    key: 'startedAt' | 'endedAt',
    newDate: string,
  ) {
    const session = this.draft.sessions[index];
    if (!session) return;
    const { time: currentTime } = splitDateTime(session[key]);
    const updated = combineDateTime(newDate, currentTime);
    const change: Partial<SessionDraft> = { [key]: updated };

    if (key === 'startedAt' && (index > 0 || session.sessionType === 'nap')) {
      const { time: toTime } = splitDateTime(session.endedAt);
      change.endedAt = combineDateTime(newDate, toTime);
    }

    this.setSession(index, change, key);
  }

  private updateSessionTime(
    index: number,
    key: 'startedAt' | 'endedAt',
    newTime: string,
  ) {
    const session = this.draft.sessions[index];
    if (!session) return;
    const { date: currentDate } = splitDateTime(session[key]);
    const updated = combineDateTime(currentDate, newTime);
    this.setSession(index, { [key]: updated }, key);
  }

  private sessionTimes(session: SessionDraft, index: number) {
    const prefix = `sessions.${index}.`;
    return html`<div class="sleep-fields-grid">
      ${(['startedAt', 'endedAt'] as const).map((key) => {
        const { date, time } = splitDateTime(session[key]);
        const label = key === 'startedAt' ? 'From' : 'To';
        const field = `${prefix}${key}`;
        return html`
          <fieldset class="sleep-time-fieldset">
            <legend>${label}</legend>
            <div class="sleep-time-inputs">
              <label
                ><span class="sr-only">${label} date</span>
                <input
                  type="date"
                  aria-label="${label} date"
                  .value=${date}
                  data-field=${field}
                  aria-invalid=${this.errors[field] ? 'true' : 'false'}
                  aria-describedby=${this.errors[field] ? `sleep-error-${field}` : 'sleep-time-help'}
                  @input=${(event: InputEvent) => this.updateSessionDate(index, key, (event.target as HTMLInputElement).value)}
              /></label>
              <label
                ><span class="sr-only">${label} time</span>
                <input
                  type="time"
                  step="60"
                  aria-label="${label} time"
                  .value=${time}
                  data-field=${field}
                  aria-invalid=${this.errors[field] ? 'true' : 'false'}
                  aria-describedby=${this.errors[field] ? `sleep-error-${field}` : 'sleep-time-help'}
                  @input=${(event: InputEvent) => this.updateSessionTime(index, key, (event.target as HTMLInputElement).value)}
              /></label>
            </div>
            ${this.fieldError(field)}
          </fieldset>
        `;
      })}
    </div>`;
  }
  private sessionMetadata(session: SessionDraft, index: number) {
    return html`<div class="sleep-fields-grid">
      <label
        >Session notes (optional)<input
          maxlength="200"
          .value=${session.label}
          @input=${(e: Event) => this.setSession(index, { label: (e.target as HTMLInputElement).value })} /></label
      ><label
        >Session source<select
          aria-label="Session source"
          .value=${session.source}
          @change=${(e: Event) => this.setSession(index, { source: (e.target as HTMLSelectElement).value })}
        >
          ${this.sourceOptions(session.source, true)}
        </select></label
      >
      <p class="sleep-help">
        Session notes describe this session only. Session source identifies who
        recorded it; leave it inherited when it matches the nightly measurement
        source.
      </p>
    </div>`;
  }
  private renderSession(session: SessionDraft, index: number) {
    const prefix = `sessions.${index}.`;
    const main = session.sessionType === 'main-sleep';
    const total = durationValue(session.totalSleepMinutes);
    const duration = this.durationInput(
      'Total sleep',
      'totalSleepMinutes',
      session,
      (value) => {
        const isCleared = value.hours === '' && value.minutes === '';
        this.setSession(
          index,
          { totalSleepMinutes: value, manualTotalSleep: !isCleared },
          'totalSleepMinutes',
        );
      },
      prefix,
    );
    const optional = this.optionalMeasurements(
      session,
      (key, value) => this.setSession(index, { [key]: value }, key),
      prefix,
      session.source || this.draft.source,
    );
    return html`<section
      class="sleep-session-card"
      aria-labelledby=${`${session.key}-heading`}
    >
      <h3 id=${`${session.key}-heading`} tabindex="-1">
        ${typeLabels[session.sessionType]}${session.label ? ` · ${session.label}` : ''}
        · Session
        ${index + 1}${total != null && Number.isFinite(total) ? ` · ${formatDuration(total)}` : ''}
      </h3>
      <label class="sleep-session-type"
        >Session type<select
          aria-label="Session type"
          id=${`${session.key}-type`}
          .value=${session.sessionType}
          @change=${(event: Event) => this.setSession(index, { sessionType: (event.target as HTMLSelectElement).value as SessionDraft['sessionType'] })}
        >
          ${this.draft.detailMode === 'sessions' ? html`<option value="main-sleep">Main sleep</option>` : nothing}
          <option value="nap">Nap</option>
          ${this.draft.detailMode === 'sessions' ? html`<option value="other">Other</option>` : nothing}
        </select></label
      >
      ${
        main
          ? html`<div class="sleep-session-content">
              ${this.sessionTimes(session, index)}${duration}${optional}${this.sessionMetadata(session, index)}
            </div>`
          : html` ${duration}
              <details
                class="sleep-optional-details"
                .open=${session.detailsOpen}
                @toggle=${(event: Event) => {
                  const open = (event.target as HTMLDetailsElement).open;
                  if (open !== session.detailsOpen)
                    this.setSession(index, { detailsOpen: open });
                }}
              >
                <summary>Add details</summary>
                <div class="sleep-session-content">
                  ${this.sessionTimes(session, index)}${optional}${this.sessionMetadata(session, index)}
                </div>
              </details>`
      }
      <div class="sleep-session-actions">
        <button
          type="button"
          class="text-button"
          ?disabled=${index === 0}
          aria-label=${`Move session ${index + 1} up`}
          @click=${() => this.reorderSession(index, -1)}
        >
          Move up
        </button>
        <button
          type="button"
          class="text-button"
          ?disabled=${index === this.draft.sessions.length - 1}
          aria-label=${`Move session ${index + 1} down`}
          @click=${() => this.reorderSession(index, 1)}
        >
          Move down
        </button>
        <button
          type="button"
          class="text-button danger"
          ?disabled=${this.draft.detailMode === 'sessions' && this.draft.sessions.length === 1}
          aria-label=${`Remove session ${index + 1}`}
          @click=${() => this.deleteSession(index)}
        >
          Remove
        </button>
      </div>
    </section>`;
  }
  private renderPreview() {
    const preview = previewSessions(
      this.draft.sessions,
      this.draft.totalScope === 'overnight',
    );
    return html`<section
      class="sleep-preview"
      aria-label="Daily sleep overview"
      aria-live="polite"
    >
      <strong>${coverageLabels[preview.stageCoverage]}</strong>
      ${this.draft.sessions.length > 1 ? html`<span> · ${this.draft.sessions.length} sessions</span>` : nothing}
      ${preview.stageCoverage === 'partial' ? html`<p>Some sessions do not include sleep-stage details.</p>` : nothing}
    </section>`;
  }
  private renderSessionHistory(session: SleepSession, index: number) {
    const formatTime = (value: string) =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));
    return html`<li>
      <h3>
        ${session.label || typeLabels[session.sessionType]}
        <small
          >${session.label ? `· ${typeLabels[session.sessionType]} ` : ''}·
          Session ${index + 1}</small
        >
      </h3>
      ${session.startedAt || session.endedAt ? html`<p>${session.startedAt ? `Start: ${formatTime(session.startedAt)}` : 'Start not recorded'} · ${session.endedAt ? `End: ${formatTime(session.endedAt)}` : 'End not recorded'}</p>` : html`<p>No clock times recorded</p>`}
      <p>
        Total sleep:
        ${formatDuration(session.totalSleepMinutes)}${session.awakeCount !== null ? ` · Times awake: ${session.awakeCount}` : ''}${session.awakeMinutes !== null ? ` · Total time awake: ${formatDuration(session.awakeMinutes)}` : ''}
      </p>
      <p>
        ${session.lightMinutes === null && session.deepMinutes === null && session.remMinutes === null ? 'No stage details' : [session.lightMinutes === null ? '' : `Light: ${formatDuration(session.lightMinutes)}`, session.deepMinutes === null ? '' : `Deep: ${formatDuration(session.deepMinutes)}`, session.remMinutes === null ? '' : `REM: ${formatDuration(session.remMinutes)}`].filter(Boolean).join(' · ')}
      </p>
      ${session.source ? html`<p>Source: ${session.source}</p>` : nothing}
    </li>`;
  }
  private renderFilters() {
    const active = hasActiveFilter(this.filter);
    return html`
      <details class="measurement-filters" ?open=${active}>
        <summary>
          Filter by
          date${active ? html`<span class="measurement-filters-badge">Active</span>` : ''}
        </summary>
        <form @submit=${this.applyFilter}>
          <div class="compact-form-row">
            <label
              >From<input
                type="date"
                .value=${this.draftFilter.from}
                @input=${(e: Event) => (this.draftFilter = { ...this.draftFilter, from: (e.target as HTMLInputElement).value })}
            /></label>
            <label
              >To<input
                type="date"
                .value=${this.draftFilter.to}
                @input=${(e: Event) => (this.draftFilter = { ...this.draftFilter, to: (e.target as HTMLInputElement).value })}
            /></label>
          </div>
          <div class="filter-actions">
            <button class="primary-button" type="submit">Apply filter</button>
            <button
              class="cancel-button"
              type="button"
              @click=${this.clearFilter}
            >
              Clear
            </button>
          </div>
        </form>
      </details>
    `;
  }
  private renderList() {
    if (this.loading)
      return html`<div class="state" aria-live="polite">
        Loading sleep records…
      </div>`;
    if (!this.records.length) {
      const active = hasActiveFilter(this.filter);
      return html`<div class="state empty">
        <strong
          >${active ? 'No sleep records match these dates' : 'Start your sleep history'}</strong
        >
        <p>
          ${active ? 'Clear or change the date filters to see other sleep records.' : 'Choose Add sleep to record your first sleep day.'}
        </p>
      </div>`;
    }
    return html`<div class="measurement-list">
      <div class="list-head sleep-grid" aria-hidden="true">
        <span>Sleep date</span><span>Overnight sleep</span><span>Stages</span
        ><span>Score & source</span><span>Actions</span>
      </div>
      ${repeat(
        this.records,
        (record) => record.id,
        (record) =>
          html`<article class="measurement-row sleep-grid">
            <div class="date-cell">
              <span class="mobile-label">Sleep date</span
              ><strong>${this.formatDate(record.sleepDate)}</strong>
              ${record.detailMode === 'sessions' ? html`<small>${record.sessions.length} ${record.sessions.length === 1 ? 'session' : 'sessions'} · ${[...new Set(record.sessions.map((session) => typeLabels[session.sessionType]))].join(', ')}</small>` : nothing}
            </div>
            <div class="sleep-total">
              <span class="mobile-label">Total sleep</span
              ><strong>${formatDuration(record.totalSleepMinutes)}</strong
              >${record.totalScope !== 'overnight' ? html`<small>Historical daily total (may include naps)</small>` : nothing}
              ${record.awakeCount !== null ? html`<small>Times awake: ${record.awakeCount}</small>` : nothing}
              ${record.awakeMinutes !== null ? html`<small>Total time awake: ${formatDuration(record.awakeMinutes)}</small>` : nothing}
            </div>
            <div class="stage-cell">
              <strong>${coverageLabels[record.stageCoverage]}</strong>
              ${record.deepMinutes !== null ? html`<span>Deep ${formatDuration(record.deepMinutes)}</span>` : nothing}
              ${record.remMinutes !== null ? html`<span>REM ${formatDuration(record.remMinutes)}</span>` : nothing}
            </div>
            <div class="source-cell">
              <span class="mobile-label">Score & source</span>
              <strong>${record.sleepScore ?? '—'}</strong>
              <small>${record.source}</small>
            </div>
            <div class="actions">
              <record-actions
                data-record-id=${record.id}
                .label=${`Actions for sleep on ${this.formatDate(record.sleepDate)}`}
                .editHref=${sleepEditorUrl(record.id, this.route.returnTo)}
                .busy=${this.deletingId === record.id}
                @delete-request=${() => this.deleteRecord(record)}
              ></record-actions>
            </div>
            ${this.renderMoreInfo(record)}
            ${
              record.sessions.length
                ? html`<details class="sleep-session-history">
                    <summary>
                      View ${record.sessions.length}
                      ${record.sessions.length === 1 ? 'session' : 'sessions'}
                    </summary>
                    <p class="sleep-help">Times shown in ${this.timeZone}.</p>
                    <ol>
                      ${record.sessions.map((session, index) => this.renderSessionHistory(session, index))}
                    </ol>
                  </details>`
                : nothing
            }
          </article>`,
      )}
    </div>`;
  }
  private hasMoreInfo(record: SleepRecord): boolean {
    return Boolean(
      record.lightMinutes !== null ||
      (record.measurements && Object.keys(record.measurements).length > 0) ||
      (record.notes && record.notes.trim().length > 0) ||
      (record.detailMode === 'sessions' && record.stageCoverage === 'partial'),
    );
  }
  private renderMoreInfo(record: SleepRecord) {
    if (!this.hasMoreInfo(record)) return nothing;
    const hasMetrics =
      record.lightMinutes !== null ||
      Boolean(
        record.measurements && Object.keys(record.measurements).length > 0,
      );
    return html`<details class="sleep-more-info description-preview">
      <summary>Details</summary>
      <div class="sleep-more-info-body">
        ${
          hasMetrics
            ? html`<div class="sleep-more-info-grid">
                ${
                  record.lightMinutes !== null
                    ? html`<span class="sleep-more-info-item"
                        >Light sleep:
                        <strong
                          >${formatDuration(record.lightMinutes)}</strong
                        ></span
                      >`
                    : nothing
                }
                ${Object.entries(record.measurements ?? {}).map(
                  ([key, value]) => {
                    const d = sleepMetricDefinitions.find((m) => m.key === key);
                    return html`<span class="sleep-more-info-item"
                      >${d?.name ?? key}:
                      <strong
                        >${value}${d?.unit ? ` ${d.unit}` : ''}</strong
                      ></span
                    >`;
                  },
                )}
              </div>`
            : nothing
        }
        ${
          record.detailMode === 'sessions' && record.stageCoverage === 'partial'
            ? html`<small class="sleep-more-info-warning"
                >Some sessions have incomplete stages; missing daily totals are
                not available.</small
              >`
            : nothing
        }
        ${
          record.notes && record.notes.trim().length > 0
            ? html`<div class="sleep-more-info-notes">
                <strong>Notes</strong>
                <p>${record.notes}</p>
              </div>`
            : nothing
        }
      </div>
    </details>`;
  }
  private renderEditor() {
    const draft = this.draft;
    const preview = previewSessions(
      draft.sessions,
      draft.totalScope === 'overnight',
    );
    return html`<main class="sleep-page sleep-editor-page">
      <section class="page-heading">
        <div>
          <span class="eyebrow">Daily records</span>
          <h1>${this.route.kind === 'new' ? 'Add sleep' : 'Edit sleep'}</h1>
          <p>
            ${draft.detailMode === 'summary' ? 'Edit your recorded daily sleep values.' : 'Record your main sleep and any naps for the day.'}
          </p>
        </div>
      </section>
      ${
        this.loading
          ? html`<div class="state" role="status">Loading sleep record…</div>`
          : this.error && !draft.id && this.route.kind !== 'new'
            ? html` <div class="error-banner" role="alert">${this.error}</div>
                <a class="cancel-button" href=${this.route.returnTo}
                  >Back to Sleep</a
                >`
            : html` <section class="entry-card" aria-label="Sleep entry">
                ${this.error ? html`<div class="error-banner" role="alert">${this.error}</div>` : nothing}
                <p class="sleep-save-status" role="status">${this.notice}</p>
                <form
                  class="compact-entry-form"
                  novalidate
                  @submit=${this.submit}
                >
                  ${Object.keys(this.errors).length ? html`<div class="sleep-validation-summary" role="alert">Please correct the marked fields before saving.${this.errors.sessions ? html`<p>${this.errors.sessions}</p>` : nothing}</div>` : nothing}
                  <fieldset class="sleep-form-fields" ?disabled=${this.saving}>
                    <div class="sleep-daily-fields">
                      <label
                        >Sleep date *<input
                          id="sleep-date"
                          type="date"
                          .value=${draft.sleepDate}
                          data-field="sleepDate"
                          aria-invalid=${this.errors.sleepDate ? 'true' : 'false'}
                          aria-describedby=${this.errors.sleepDate ? 'sleep-error-sleepDate' : 'sleep-date-help'}
                          @input=${(event: InputEvent) => this.setField('sleepDate', (event.target as HTMLInputElement).value)}
                        />${this.fieldError('sleepDate')}</label
                      >
                      ${
                        draft.detailMode === 'summary'
                          ? this.durationInput(
                              'Total sleep',
                              'totalSleepMinutes',
                              draft.summary,
                              (value) =>
                                this.setSummary('totalSleepMinutes', value),
                            )
                          : html` <label
                              >Total sleep<input
                                class="sleep-daily-total"
                                readonly
                                .value=${preview.totalSleepMinutes === null ? 'Enter session durations' : formatDuration(preview.totalSleepMinutes)}
                                aria-describedby="sleep-total-help"
                            /></label>`
                      }
                      ${
                        this.applicable('sleepScore')
                          ? html`<label
                              >Sleep score (0–100)<input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                .value=${draft.sleepScore}
                                data-field="sleepScore"
                                aria-invalid=${this.errors.sleepScore ? 'true' : 'false'}
                                aria-describedby=${this.errors.sleepScore ? 'sleep-error-sleepScore' : nothing}
                                @input=${(event: InputEvent) => this.setField('sleepScore', (event.target as HTMLInputElement).value)}
                              />${this.fieldError('sleepScore')}</label
                            >`
                          : nothing
                      }
                    </div>
                    ${
                      !draft.id && draft.detailMode === 'summary'
                        ? html`<button
                            type="button"
                            @click=${() => {
                              this.draft = {
                                ...draft,
                                detailMode: 'sessions',
                                sessions: [
                                  {
                                    ...newSession(),
                                    ...draft.summary,
                                    ...defaultMainSleepTimes(draft.sleepDate),
                                  },
                                ],
                              };
                            }}
                          >
                            Enter main sleep as sessions instead
                          </button>`
                        : nothing
                    }
                    <p id="sleep-date-help" class="sleep-help">
                      Choose the sleep day, usually the date your main sleep
                      ended. Session times will not change this date.
                    </p>
                    ${
                      draft.detailMode === 'summary'
                        ? this.optionalMeasurements(
                            draft.summary,
                            (key, value) => this.setSummary(key, value),
                          )
                        : html` <p id="sleep-total-help" class="sleep-help">
                              Overnight sleep is calculated from main sleep
                              sessions. Naps stay separate.
                            </p>
                            ${this.renderPreview()}
                            <h2 class="sleep-sessions-heading">
                              Sleep sessions
                            </h2>
                            <p id="sleep-time-help" class="sleep-help">
                              From and To are optional and use ${this.timeZone}.
                              Sessions may cross midnight. Enter sleep duration
                              separately.
                            </p>
                            <p class="sleep-help">
                              Stage and awake details are optional. Leave
                              unknown values empty; enter 0 only when reported
                              as zero.
                            </p>
                            ${repeat(
                              draft.sessions,
                              (session) => session.key,
                              (session, index) =>
                                this.renderSession(session, index),
                            )}
                            <button
                              class="sleep-add-session"
                              type="button"
                              @click=${this.addSession}
                            >
                              Add another session
                            </button>`
                    }
                    <div class="sleep-fields-grid">
                      ${this.definitions
                        .filter(
                          (d) =>
                            ![
                              'deepMinutes',
                              'lightMinutes',
                              'remMinutes',
                              'awakeMinutes',
                              'awakeCount',
                              'sleepScore',
                            ].includes(d.key) && this.applicable(d.key),
                        )
                        .map(
                          (d) =>
                            html`<label
                              >${d.name} (${d.unit})<input
                                type="number"
                                step=${d.type === 'integer' ? '1' : 'any'}
                                .value=${draft.measurements?.[d.key] ?? ''}
                                data-field=${'measurements.' + d.key}
                                aria-invalid=${this.errors['measurements.' + d.key] ? 'true' : 'false'}
                                aria-describedby=${this.errors['measurements.' + d.key] ? 'sleep-error-measurements.' + d.key : nothing}
                                @input=${(e: Event) => {
                                  this.clearError('measurements.' + d.key);
                                  this.draft = {
                                    ...draft,
                                    measurements: {
                                      ...draft.measurements,
                                      [d.key]: (e.target as HTMLInputElement)
                                        .value,
                                    },
                                  };
                                }}
                              />${this.fieldError('measurements.' + d.key)}</label
                            >`,
                        )}
                      <label
                        >Nightly measurement source *<select
                          aria-label="Nightly measurement source *"
                          maxlength="200"
                          .value=${draft.source}
                          data-field="source"
                          aria-invalid=${this.errors.source ? 'true' : 'false'}
                          aria-describedby=${this.errors.source ? 'sleep-error-source' : nothing}
                          @input=${(event: InputEvent) => this.setField('source', (event.target as HTMLInputElement).value)}
                        >
                          ${this.sourceOptions(draft.source)}</select
                        >${this.fieldError('source')}</label
                      >
                      <label
                        >Nightly notes (optional)<textarea
                          maxlength="2000"
                          rows="2"
                          .value=${draft.notes}
                          @input=${(event: InputEvent) => this.setField('notes', (event.target as HTMLTextAreaElement).value)}
                        ></textarea>
                      </label>
                    </div>
                    <p class="sleep-help">
                      Nightly notes apply to the whole night. The nightly
                      measurement source identifies the provider of the nightly
                      measurements and sleep score.
                    </p>
                    ${
                      draft.detailMode === 'summary'
                        ? html`<h2>Naps</h2>
                            <p class="sleep-help">
                              Naps are separate from overnight totals and
                              stages.
                            </p>
                            ${repeat(
                              draft.sessions,
                              (s) => s.key,
                              (s, i) => this.renderSession(s, i),
                            )}<button type="button" @click=${this.addSession}>
                              Add nap
                            </button>`
                        : nothing
                    }
                    <div class="sleep-editor-actions">
                      <button class="primary-button" type="submit">
                        ${this.saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        class="cancel-button"
                        type="button"
                        @click=${this.returnToList}
                      >
                        Cancel
                      </button>
                    </div>
                  </fieldset>
                </form>
              </section>`
      }
    </main>`;
  }
  render() {
    if (this.route.kind === 'monthly')
      return html`<sleep-monthly-page></sleep-monthly-page>`;
    if (this.route.kind !== 'list') return this.renderEditor();
    const latest = this.records[0];
    return html`<main class="sleep-page">
      <section class="page-heading">
        <div>
          <span class="eyebrow">Daily records</span>
          <h1>Sleep</h1>
          <p>Record your main sleep and any naps for each sleep day.</p>
        </div>
        <span class="section-index">03</span>
      </section>
      <section class="summary" aria-label="Sleep summary">
        <div>
          <span class="eyebrow">Latest sleep</span
          ><strong
            >${latest ? formatDuration(latest.totalSleepMinutes) : '—'}</strong
          >
        </div>
        <div>
          <span class="eyebrow">Latest score</span
          ><strong>${latest?.sleepScore ?? '—'}</strong
          ><small>${latest?.source ?? ''}</small>
        </div>
        <div>
          <span class="eyebrow">Sleep records</span
          ><strong>${this.records.length}</strong>
        </div>
      </section>
      <p>
        <a href="#/measurements/sleep/monthly-averages"
          >Monthly sleep averages</a
        >
      </p>
      <section class="list-card">
        <div class="card-heading">
          <h2>Your sleep records</h2>
          <a
            class="primary-button sleep-new-link"
            href=${sleepEditorUrl(null, this.route.returnTo)}
            >Add sleep</a
          >
        </div>
        ${this.renderFilters()}
        ${this.error ? html`<div class="error-banner" role="alert">${this.error}</div>` : nothing}${this.renderList()}
      </section>
    </main>`;
  }
}
customElements.define('sleep-page', SleepPage);
