import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { sleepRecordsApi, type SleepRecord, type SleepSession } from "./api.js";
import {
  coverageLabels, defaultMainSleepTimes, draftFromRecord, firstSessionToDate, formatDuration, moveSession, newSession, newSleepDraft,
  durationValue, previewSessions, removeSession, syncNapDates, typeLabels, validateDraft,
  type DurationDraft, type DurationKey, type FieldErrors, type MeasurementsDraft, type SessionDraft, type SleepDraft,
} from "./sleep-editor.js";
import type { RecordActions } from "./record-actions.js";
import "./record-actions.js";
import { parseSleepRoute, sleepEditorUrl, type SleepRoute } from "./sleep-routes.js";
import { previousCalendarDay } from "./pap-date.js";
import { emptyDateFilter, hasActiveFilter, parseDateFilter, updateDateFilterHash, type DateFilter } from "./measurement-filter-helpers.js";

export class SleepPage extends LitElement {
  static properties = {
    records: { state: true }, loading: { state: true }, saving: { state: true }, deletingId: { state: true },
    error: { state: true }, draft: { state: true }, errors: { state: true }, route: { state: true }, notice: { state: true },
    filter: { state: true }, draftFilter: { state: true },
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
  private loadVersion = 0;
  declare private notice: string;
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  constructor() {
    super(); this.records = []; this.loading = true; this.saving = false; this.deletingId = null;
    this.error = null; this.draft = newSleepDraft(); this.errors = {}; this.route = parseSleepRoute(window.location.hash); this.notice = "";
    this.filter = parseDateFilter(); this.draftFilter = { ...this.filter };
  }
  protected createRenderRoot() { return this; }
  connectedCallback() { super.connectedCallback(); window.addEventListener("hashchange", this.handleRouteChange); void this.loadRoute(); }
  disconnectedCallback() { window.removeEventListener("hashchange", this.handleRouteChange); this.loadVersion++; super.disconnectedCallback(); }
  private handleRouteChange = () => {
    this.route = parseSleepRoute(window.location.hash);
    this.filter = parseDateFilter();
    this.draftFilter = { ...this.filter };
    void this.loadRoute();
  };
  private async loadRoute() {
    const version = ++this.loadVersion;
    this.loading = true; this.error = null; this.errors = {}; this.notice = ""; this.saving = false; this.draft = newSleepDraft();
    try {
      if (this.route.kind === "invalid") throw new Error("Invalid sleep record ID.");
      if (this.route.kind === "list") {
        const records = await sleepRecordsApi.list(this.filter);
        if (version === this.loadVersion) this.records = records;
      } else if (this.route.kind === "edit") {
        const record = await sleepRecordsApi.get(this.route.id!);
        if (version === this.loadVersion) this.draft = draftFromRecord(record);
      }
    } catch (error) { if (version === this.loadVersion) this.error = error instanceof Error ? error.message : "Unable to load sleep record."; }
    finally { if (version === this.loadVersion) this.loading = false; }
  }
  private applyFilter(event: SubmitEvent) {
    event.preventDefault();
    const hash = updateDateFilterHash("#/measurements/sleep", this.draftFilter);
    if (window.location.hash === hash) {
      this.filter = { ...this.draftFilter };
      void this.loadRoute();
    } else {
      window.location.hash = hash;
    }
  }
  private clearFilter() {
    this.draftFilter = emptyDateFilter();
    const hash = updateDateFilterHash("#/measurements/sleep", emptyDateFilter());
    if (window.location.hash === hash) {
      this.filter = emptyDateFilter();
      void this.loadRoute();
    } else {
      window.location.hash = hash;
    }
  }
  private returnToList() { window.location.hash = this.route.returnTo; }
  private setField(key: "sleepDate" | "sleepScore" | "source" | "notes", value: string) {
    if (key === "sleepDate" && !this.draft.id) {
      const fromDate = previousCalendarDay(value);
      const toDate = value;
      let sessions = fromDate && toDate
        ? this.draft.sessions.map((session, index) => {
            if (index === 0 || session.sessionType === "main-sleep") {
              const startTime = session.startedAt.includes("T") ? session.startedAt.slice(session.startedAt.indexOf("T")) : "T23:00";
              const endTime = session.endedAt.includes("T") ? session.endedAt.slice(session.endedAt.indexOf("T")) : "T07:00";
              return {
                ...session,
                startedAt: session.startedAt ? `${fromDate}${startTime}` : session.startedAt,
                endedAt: session.endedAt ? `${toDate}${endTime}` : session.endedAt,
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
    this.draft = { ...this.draft, [key]: value }; this.clearError(key);
  }
  private clearError(key: string) { const errors = { ...this.errors }; delete errors[key]; this.errors = errors; this.notice = ""; }
  private setSummary(key: DurationKey | "awakeCount", value: DurationDraft | string) {
    this.draft = { ...this.draft, summary: { ...this.draft.summary, [key]: value } }; this.clearError(key);
  }
  private setSession(index: number, change: Partial<SessionDraft>, field?: string) {
    if (change.sessionType === "main-sleep") {
      const current = this.draft.sessions[index];
      if (current && !current.startedAt && !current.endedAt) {
        const toDate = firstSessionToDate(this.draft);
        change = { ...change, ...defaultMainSleepTimes(toDate) };
      }
    }
    let sessions = this.draft.sessions.map((session, i) => i === index ? { ...session, ...change } : session);
    if (index === 0 && change.endedAt !== undefined && !this.draft.id) {
      const toDate = change.endedAt.includes("T") ? change.endedAt.slice(0, change.endedAt.indexOf("T")) : "";
      sessions = syncNapDates(sessions, toDate);
    }
    this.draft = { ...this.draft, sessions };
    if (field) this.clearError(`sessions.${index}.${field}`);
  }
  private async addSession() {
    const sessionType = this.draft.sessions.length ? "nap" : "main-sleep";
    const session = newSession(sessionType);
    if (!this.draft.id && sessionType === "main-sleep") {
      const toDate = firstSessionToDate(this.draft);
      Object.assign(session, defaultMainSleepTimes(toDate));
    }
    this.draft = { ...this.draft, sessions: [...this.draft.sessions, session] }; this.errors = {}; this.notice = "Session added.";
    await this.updateComplete;
    this.querySelector<HTMLSelectElement>(`#${session.key}-type`)?.focus();
  }
  private async reorderSession(index: number, direction: -1 | 1) {
    const key = this.draft.sessions[index]!.key;
    this.draft = { ...this.draft, sessions: moveSession(this.draft.sessions, index, direction) }; this.errors = {};
    this.notice = `Session moved to position ${index + direction + 1}.`;
    await this.updateComplete;
    this.querySelector<HTMLElement>(`#${key}-heading`)?.focus();
  }
  private async deleteSession(index: number) {
    const session = this.draft.sessions[index]!;
    const populated = [session.label, session.source, session.startedAt, session.endedAt, session.awakeCount,
      ...Object.values(session.totalSleepMinutes), ...Object.values(session.deepMinutes), ...Object.values(session.lightMinutes),
      ...Object.values(session.remMinutes), ...Object.values(session.awakeMinutes)].some((value) => value !== "");
    if (this.draft.sessions.length === 1 || (populated && !window.confirm(`Remove session ${index + 1} (${typeLabels[session.sessionType]}) and its entered values?`))) return;
    this.draft = { ...this.draft, sessions: removeSession(this.draft.sessions, this.draft.sessions[index]!.key) };
    this.errors = {}; this.notice = `Session ${index + 1} removed. Changes are not saved yet.`;
    await this.updateComplete;
    const next = this.draft.sessions[Math.min(index, this.draft.sessions.length - 1)];
    this.querySelector<HTMLElement>(`#${next?.key}-heading`)?.focus();
  }
  private async submit(event: SubmitEvent) {
    event.preventDefault();
    if (this.saving) return;
    const result = validateDraft(this.draft);
    this.errors = result.errors;
    for (const input of this.querySelectorAll<HTMLInputElement>("form input[data-field]")) {
      if (input.validity.badInput) this.errors[input.dataset.field!] = "Enter a valid number or date, or clear the field.";
    }
    if (Object.keys(this.errors).length || !result.input) {
      this.draft = { ...this.draft, sessions: this.draft.sessions.map((session, index) => ({ ...session,
        detailsOpen: session.detailsOpen || Object.keys(this.errors).some((key) => key.startsWith(`sessions.${index}.`)),
      })) };
      await this.updateComplete;
      this.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const version = this.loadVersion;
    this.saving = true; this.error = null; this.notice = "";
    try {
      const saved = this.draft.id ? await sleepRecordsApi.update(this.draft.id, result.input) : await sleepRecordsApi.create(result.input);
      if (version !== this.loadVersion) return;
      this.draft = draftFromRecord(saved); this.errors = {};
      this.returnToList();
    } catch (error) { if (version === this.loadVersion) this.error = error instanceof Error ? error.message : "Unable to save sleep record."; }
    finally { if (version === this.loadVersion) this.saving = false; }
  }
  private async deleteRecord(record: SleepRecord) {
    if (this.deletingId || !window.confirm(`Delete the sleep record for ${this.formatDate(record.sleepDate)} and all its sessions?`)) return;
    const version = this.loadVersion;
    const index = this.records.findIndex(({ id }) => id === record.id);
    this.deletingId = record.id; this.error = null;
    try {
      await sleepRecordsApi.delete(record.id);
      if (version === this.loadVersion) this.records = this.records.filter(({ id }) => id !== record.id);
    } catch (error) {
      if (version === this.loadVersion) this.error = error instanceof Error ? error.message : "Unable to delete sleep record.";
    } finally {
      this.deletingId = null;
      await this.updateComplete;
      if (version === this.loadVersion) {
        const next = this.records.find(({ id }) => id === record.id) ?? this.records[Math.min(index, this.records.length - 1)];
        if (next) this.querySelector<RecordActions>(`record-actions[data-record-id="${next.id}"]`)?.focusTrigger();
        else this.querySelector<HTMLElement>(".sleep-new-link")?.focus();
      }
    }
  }
  private formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
  private fieldError(key: string) { return this.errors[key] ? html`<small class="sleep-field-error" id=${`sleep-error-${key}`}>${this.errors[key]}</small>` : nothing; }
  private durationInput(label: string, key: DurationKey, row: MeasurementsDraft, set: (value: DurationDraft) => void, prefix = "") {
    const field = `${prefix}${key}`;
    return html`<fieldset class="duration-field"><legend>${label}${key === "totalSleepMinutes" ? " *" : ""}</legend>
      <div class="duration-inputs">${(["hours", "minutes"] as const).map((part) => html`
        <label><span class="sr-only">${label} ${part}</span><input type="number" min="0" max=${part === "minutes" ? 59 : this.draft.detailMode === "summary" ? 24 : 35791394}
          step="1" inputmode="numeric" placeholder=${part === "hours" ? "h" : "min"} .value=${row[key][part]}
          data-field=${field} aria-invalid=${this.errors[field] ? "true" : "false"} aria-describedby=${this.errors[field] ? `sleep-error-${field}` : nothing}
          @input=${(event: InputEvent) => set({ ...row[key], [part]: (event.target as HTMLInputElement).value })} /></label><span>${part === "hours" ? "h" : "min"}</span>`)}
      </div>${this.fieldError(field)}</fieldset>`;
  }
  private awakeInput(row: MeasurementsDraft, set: (value: string) => void, prefix = "") {
    const field = `${prefix}awakeCount`;
    return html`<label>Times awake<input aria-label="Times awake" type="number" min="0" max="2147483647" step="1" inputmode="numeric" placeholder="Unknown" .value=${row.awakeCount}
      data-field=${field} aria-invalid=${this.errors[field] ? "true" : "false"} aria-describedby=${this.errors[field] ? `sleep-error-${field}` : nothing}
      @input=${(event: InputEvent) => set((event.target as HTMLInputElement).value)} />${this.fieldError(field)}</label>`;
  }
  private optionalMeasurements(row: MeasurementsDraft, set: (key: DurationKey | "awakeCount", value: DurationDraft | string) => void, prefix = "") {
    return html`<div class="sleep-stage-fields sleep-fields-grid">
      ${this.durationInput("Deep", "deepMinutes", row, (value) => set("deepMinutes", value), prefix)}
      ${this.durationInput("Light", "lightMinutes", row, (value) => set("lightMinutes", value), prefix)}
      ${this.durationInput("REM", "remMinutes", row, (value) => set("remMinutes", value), prefix)}</div>
      <fieldset class="sleep-awake-fields"><legend>Awake</legend><div class="sleep-fields-grid">
        ${this.awakeInput(row, (value) => set("awakeCount", value), prefix)}
        ${this.durationInput("Total time awake", "awakeMinutes", row, (value) => set("awakeMinutes", value), prefix)}
      </div></fieldset>`;
  }
  private sessionTimes(session: SessionDraft, index: number) {
    const prefix = `sessions.${index}.`;
    return html`<div class="sleep-fields-grid">${(["startedAt", "endedAt"] as const).map((key) => html`
      <label>${key === "startedAt" ? "From" : "To"}<input aria-label=${key === "startedAt" ? "From" : "To"} type="datetime-local" step="60" .value=${session[key]}
        data-field=${`${prefix}${key}`} aria-invalid=${this.errors[`${prefix}${key}`] ? "true" : "false"}
        aria-describedby=${this.errors[`${prefix}${key}`] ? `sleep-error-${prefix}${key}` : "sleep-time-help"}
        @input=${(event: InputEvent) => this.setSession(index, { [key]: (event.target as HTMLInputElement).value }, key)} />${this.fieldError(`${prefix}${key}`)}</label>`)}</div>`;
  }
  private sessionMetadata(session: SessionDraft, index: number) {
    return html`<div class="sleep-fields-grid">
      ${(["label", "source"] as const).map((key) => html`<label>${key === "label" ? "Label (optional)" : "Source (optional)"}
        <input maxlength="200" .value=${session[key]} data-field=${`sessions.${index}.${key}`}
          aria-invalid=${this.errors[`sessions.${index}.${key}`] ? "true" : "false"}
          aria-describedby=${this.errors[`sessions.${index}.${key}`] ? `sleep-error-sessions.${index}.${key}` : nothing}
          @input=${(event: InputEvent) => this.setSession(index, { [key]: (event.target as HTMLInputElement).value }, key)} />${this.fieldError(`sessions.${index}.${key}`)}</label>`)}
    </div>`;
  }
  private renderSession(session: SessionDraft, index: number) {
    const prefix = `sessions.${index}.`;
    const main = session.sessionType === "main-sleep";
    const total = durationValue(session.totalSleepMinutes);
    const duration = this.durationInput("Total sleep", "totalSleepMinutes", session, (value) => this.setSession(index, { totalSleepMinutes: value }, "totalSleepMinutes"), prefix);
    const optional = this.optionalMeasurements(session, (key, value) => this.setSession(index, { [key]: value }, key), prefix);
    return html`<section class="sleep-session-card" aria-labelledby=${`${session.key}-heading`}>
      <h3 id=${`${session.key}-heading`} tabindex="-1">${typeLabels[session.sessionType]}${session.label ? ` · ${session.label}` : ""} · Session ${index + 1}${total != null && Number.isFinite(total) ? ` · ${formatDuration(total)}` : ""}</h3>
      <label class="sleep-session-type">Session type<select id=${`${session.key}-type`} .value=${session.sessionType} @change=${(event: Event) => this.setSession(index, { sessionType: (event.target as HTMLSelectElement).value as SessionDraft["sessionType"] })}>
        <option value="main-sleep">Main sleep</option><option value="nap">Nap</option><option value="other">Other</option></select></label>
      ${main ? html`<div class="sleep-session-content">${this.sessionTimes(session, index)}${duration}${optional}${this.sessionMetadata(session, index)}</div>` : html`
        ${duration}
        <details class="sleep-optional-details" .open=${session.detailsOpen} @toggle=${(event: Event) => { const open = (event.target as HTMLDetailsElement).open; if (open !== session.detailsOpen) this.setSession(index, { detailsOpen: open }); }}>
          <summary>Add details</summary><div class="sleep-session-content">${this.sessionTimes(session, index)}${optional}${this.sessionMetadata(session, index)}</div>
        </details>`}
      <div class="sleep-session-actions">
        <button type="button" class="text-button" ?disabled=${index === 0} aria-label=${`Move session ${index + 1} up`} @click=${() => this.reorderSession(index, -1)}>Move up</button>
        <button type="button" class="text-button" ?disabled=${index === this.draft.sessions.length - 1} aria-label=${`Move session ${index + 1} down`} @click=${() => this.reorderSession(index, 1)}>Move down</button>
        <button type="button" class="text-button danger" ?disabled=${this.draft.sessions.length === 1} aria-label=${`Remove session ${index + 1}`} @click=${() => this.deleteSession(index)}>Remove</button>
      </div>
    </section>`;
  }
  private renderPreview() {
    const preview = previewSessions(this.draft.sessions);
    return html`<section class="sleep-preview" aria-label="Daily sleep overview" aria-live="polite">
      <strong>${coverageLabels[preview.stageCoverage]}</strong>
      ${this.draft.sessions.length > 1 ? html`<span> · ${this.draft.sessions.length} sessions</span>` : nothing}
      ${preview.stageCoverage === "partial" ? html`<p>Some sessions do not include sleep-stage details.</p>` : nothing}
    </section>`;
  }
  private renderSessionHistory(session: SleepSession, index: number) {
    const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    return html`<li><h3>${session.label || typeLabels[session.sessionType]} <small>${session.label ? `· ${typeLabels[session.sessionType]} ` : ""}· Session ${index + 1}</small></h3>
      ${(session.startedAt || session.endedAt) ? html`<p>${session.startedAt ? `Start: ${formatTime(session.startedAt)}` : "Start not recorded"} · ${session.endedAt ? `End: ${formatTime(session.endedAt)}` : "End not recorded"}</p>` : html`<p>No clock times recorded</p>`}
      <p>Total sleep: ${formatDuration(session.totalSleepMinutes)}${session.awakeCount !== null ? ` · Times awake: ${session.awakeCount}` : ""}${session.awakeMinutes !== null ? ` · Total time awake: ${formatDuration(session.awakeMinutes)}` : ""}</p>
      <p>${session.lightMinutes === null && session.deepMinutes === null && session.remMinutes === null ? "No stage details" : [session.lightMinutes === null ? "" : `Light: ${formatDuration(session.lightMinutes)}`, session.deepMinutes === null ? "" : `Deep: ${formatDuration(session.deepMinutes)}`, session.remMinutes === null ? "" : `REM: ${formatDuration(session.remMinutes)}`].filter(Boolean).join(" · ")}</p>
      ${session.source ? html`<p>Source: ${session.source}</p>` : nothing}</li>`;
  }
  private renderFilters() {
    const active = hasActiveFilter(this.filter);
    return html`
      <details class="measurement-filters" ?open=${active}>
        <summary>Filter by date${active ? html`<span class="measurement-filters-badge">Active</span>` : ""}</summary>
        <form @submit=${this.applyFilter}>
          <div class="compact-form-row">
            <label>From<input type="date" .value=${this.draftFilter.from} @input=${(e: Event) => this.draftFilter = { ...this.draftFilter, from: (e.target as HTMLInputElement).value }}></label>
            <label>To<input type="date" .value=${this.draftFilter.to} @input=${(e: Event) => this.draftFilter = { ...this.draftFilter, to: (e.target as HTMLInputElement).value }}></label>
          </div>
          <div class="filter-actions">
            <button class="primary-button" type="submit">Apply filter</button>
            <button class="cancel-button" type="button" @click=${this.clearFilter}>Clear</button>
          </div>
        </form>
      </details>
    `;
  }
  private renderList() {
    if (this.loading) return html`<div class="state" aria-live="polite">Loading sleep records…</div>`;
    if (!this.records.length) {
      const active = hasActiveFilter(this.filter);
      return html`<div class="state empty">
        <strong>${active ? "No sleep records match these dates" : "Start your sleep history"}</strong>
        <p>${active ? "Clear or change the date filters to see other sleep records." : "Choose Add sleep to record your first sleep day."}</p>
      </div>`;
    }
    return html`<div class="measurement-list"><div class="list-head sleep-grid" aria-hidden="true"><span>Sleep date</span><span>Total sleep</span><span>Stages</span><span>Score & source</span><span>Actions</span></div>
      ${repeat(this.records, (record) => record.id, (record) => html`<article class="measurement-row sleep-grid">
        <div class="date-cell"><span class="mobile-label">Sleep date</span><strong>${this.formatDate(record.sleepDate)}</strong>
          ${record.detailMode === "sessions" ? html`<small>${record.sessions.length} ${record.sessions.length === 1 ? "session" : "sessions"} · ${[...new Set(record.sessions.map((session) => typeLabels[session.sessionType]))].join(", ")}</small>` : nothing}</div>
        <div class="sleep-total"><span class="mobile-label">Total sleep</span><strong>${formatDuration(record.totalSleepMinutes)}</strong>
          ${record.awakeCount !== null ? html`<small>Times awake: ${record.awakeCount}</small>` : nothing}
          ${record.awakeMinutes !== null ? html`<small>Total time awake: ${formatDuration(record.awakeMinutes)}</small>` : nothing}</div>
        <div class="stage-cell"><strong>${coverageLabels[record.stageCoverage]}</strong>
          ${(["lightMinutes", "deepMinutes", "remMinutes"] as const).map((key, index) => record[key] === null ? nothing : html`<span>${["Light", "Deep", "REM"][index]} ${formatDuration(record[key]!)}</span>`)}
          ${record.detailMode === "sessions" && record.stageCoverage === "partial" ? html`<small>Some sessions have incomplete stages; missing daily totals are not available.</small>` : nothing}</div>
        <div class="source-cell"><span class="mobile-label">Score & source</span><strong>${record.sleepScore ?? "—"}</strong><small>${record.source}</small></div>
        <div class="actions"><record-actions data-record-id=${record.id}
          .label=${`Actions for sleep on ${this.formatDate(record.sleepDate)}`}
          .editHref=${sleepEditorUrl(record.id, this.route.returnTo)} .busy=${this.deletingId === record.id}
          @delete-request=${() => this.deleteRecord(record)}></record-actions></div>
        ${record.detailMode === "sessions" ? html`<details class="sleep-session-history"><summary>View ${record.sessions.length} ${record.sessions.length === 1 ? "session" : "sessions"}</summary><p class="sleep-help">Times shown in ${this.timeZone}.</p><ol>${record.sessions.map((session, index) => this.renderSessionHistory(session, index))}</ol></details>` : nothing}
      </article>`)}</div>`;
  }
  private renderEditor() {
    const draft = this.draft;
    const preview = previewSessions(draft.sessions);
    return html`<main class="sleep-page sleep-editor-page">
      <section class="page-heading"><div><span class="eyebrow">Daily records</span><h1>${this.route.kind === "new" ? "Add sleep" : "Edit sleep"}</h1>
        <p>${draft.detailMode === "summary" ? "Edit your recorded daily sleep values." : "Record your main sleep and any naps for the day."}</p></div></section>
      ${this.loading ? html`<div class="state" role="status">Loading sleep record…</div>` : this.error && !draft.id && this.route.kind !== "new" ? html`
        <div class="error-banner" role="alert">${this.error}</div><a class="cancel-button" href=${this.route.returnTo}>Back to Sleep</a>` : html`
        <section class="entry-card" aria-label="Sleep entry">
          ${this.error ? html`<div class="error-banner" role="alert">${this.error}</div>` : nothing}
          <p class="sleep-save-status" role="status">${this.notice}</p>
          <form class="compact-entry-form" novalidate @submit=${this.submit}>
            ${Object.keys(this.errors).length ? html`<div class="sleep-validation-summary" role="alert">Please correct the marked fields before saving.${this.errors.sessions ? html`<p>${this.errors.sessions}</p>` : nothing}</div>` : nothing}
            <fieldset class="sleep-form-fields" ?disabled=${this.saving}>
              <div class="sleep-daily-fields">
                <label>Sleep date *<input id="sleep-date" type="date" .value=${draft.sleepDate} data-field="sleepDate" aria-invalid=${this.errors.sleepDate ? "true" : "false"} aria-describedby=${this.errors.sleepDate ? "sleep-error-sleepDate" : "sleep-date-help"} @input=${(event: InputEvent) => this.setField("sleepDate", (event.target as HTMLInputElement).value)} />${this.fieldError("sleepDate")}</label>
                ${draft.detailMode === "summary" ? this.durationInput("Total sleep", "totalSleepMinutes", draft.summary, (value) => this.setSummary("totalSleepMinutes", value)) : html`
                  <label>Total sleep<input class="sleep-daily-total" readonly .value=${preview.totalSleepMinutes === null ? "Enter session durations" : formatDuration(preview.totalSleepMinutes)} aria-describedby="sleep-total-help" /></label>`}
                <label>Sleep score (0–100)<input type="number" min="0" max="100" step="1" .value=${draft.sleepScore} data-field="sleepScore" aria-invalid=${this.errors.sleepScore ? "true" : "false"} aria-describedby=${this.errors.sleepScore ? "sleep-error-sleepScore" : nothing} @input=${(event: InputEvent) => this.setField("sleepScore", (event.target as HTMLInputElement).value)} />${this.fieldError("sleepScore")}</label>
              </div>
              <p id="sleep-date-help" class="sleep-help">Choose the sleep day, usually the date your main sleep ended. Session times will not change this date.</p>
              ${draft.detailMode === "summary" ? this.optionalMeasurements(draft.summary, (key, value) => this.setSummary(key, value)) : html`
                <p id="sleep-total-help" class="sleep-help">Total sleep is calculated from all session durations.</p>
                ${this.renderPreview()}
                <h2 class="sleep-sessions-heading">Sleep sessions</h2>
                <p id="sleep-time-help" class="sleep-help">From and To are optional and use ${this.timeZone}. Sessions may cross midnight. Enter sleep duration separately.</p>
                <p class="sleep-help">Stage and awake details are optional. Leave unknown values empty; enter 0 only when reported as zero.</p>
                ${repeat(draft.sessions, (session) => session.key, (session, index) => this.renderSession(session, index))}
                <button class="sleep-add-session" type="button" @click=${this.addSession}>Add another session</button>`}
              <div class="sleep-fields-grid">
                <label>Source *<input maxlength="200" .value=${draft.source} data-field="source" aria-invalid=${this.errors.source ? "true" : "false"} aria-describedby=${this.errors.source ? "sleep-error-source" : nothing} @input=${(event: InputEvent) => this.setField("source", (event.target as HTMLInputElement).value)} />${this.fieldError("source")}</label>
                <label>Notes<textarea maxlength="2000" rows="2" .value=${draft.notes} @input=${(event: InputEvent) => this.setField("notes", (event.target as HTMLTextAreaElement).value)}></textarea></label>
              </div>
              <div class="sleep-editor-actions"><button class="primary-button" type="submit">${this.saving ? "Saving…" : "Save"}</button>
                <button class="cancel-button" type="button" @click=${this.returnToList}>Cancel</button></div>
            </fieldset>
          </form>
        </section>`}
    </main>`;
  }
  render() {
    if (this.route.kind !== "list") return this.renderEditor();
    const latest = this.records[0];
    return html`<main class="sleep-page"><section class="page-heading"><div><span class="eyebrow">Daily records</span><h1>Sleep</h1><p>Record your main sleep and any naps for each sleep day.</p></div><span class="section-index">03</span></section>
      <section class="summary" aria-label="Sleep summary"><div><span class="eyebrow">Latest sleep</span><strong>${latest ? formatDuration(latest.totalSleepMinutes) : "—"}</strong></div><div><span class="eyebrow">Latest score</span><strong>${latest?.sleepScore ?? "—"}</strong></div><div><span class="eyebrow">Sleep records</span><strong>${this.records.length}</strong></div></section>
      <section class="list-card"><div class="card-heading"><h2>Your sleep records</h2><a class="primary-button sleep-new-link" href=${sleepEditorUrl(null, this.route.returnTo)}>Add sleep</a></div>
        ${this.renderFilters()}
        ${this.error ? html`<div class="error-banner" role="alert">${this.error}</div>` : nothing}${this.renderList()}
      </section></main>`;
  }
}
customElements.define("sleep-page", SleepPage);
