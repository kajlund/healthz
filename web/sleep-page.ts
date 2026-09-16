import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { sleepRecordsApi, type SleepRecord, type SleepSession } from "./api.js";
import {
  changeMode, coverageLabels, draftFromRecord, formatDuration, moveSession, newSession, newSleepDraft,
  previewSessions, removeSession, typeLabels, validateDraft,
  type DetailMode, type DurationDraft, type DurationKey, type FieldErrors, type MeasurementsDraft, type SessionDraft, type SleepDraft,
} from "./sleep-editor.js";

export class SleepPage extends LitElement {
  static properties = {
    records: { state: true }, loading: { state: true }, saving: { state: true }, deletingId: { state: true },
    error: { state: true }, draft: { state: true }, errors: { state: true }, pendingMode: { state: true }, notice: { state: true },
  };
  declare private records: SleepRecord[];
  declare private loading: boolean;
  declare private saving: boolean;
  declare private deletingId: string | null;
  declare private error: string | null;
  declare private draft: SleepDraft;
  declare private errors: FieldErrors;
  declare private pendingMode: DetailMode | null;
  declare private notice: string;
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  constructor() {
    super(); this.records = []; this.loading = true; this.saving = false; this.deletingId = null;
    this.error = null; this.draft = newSleepDraft(); this.errors = {}; this.pendingMode = null; this.notice = "";
  }
  protected createRenderRoot() { return this; }
  connectedCallback() { super.connectedCallback(); void this.loadRecords(); }
  private async loadRecords() {
    this.loading = true; this.error = null;
    try { this.records = await sleepRecordsApi.list(); }
    catch (error) { this.error = error instanceof Error ? error.message : "Unable to load sleep records."; }
    finally { this.loading = false; }
  }
  private resetForm() { this.draft = newSleepDraft(); this.errors = {}; this.pendingMode = null; this.error = null; this.notice = ""; }
  private edit(record: SleepRecord) {
    this.draft = draftFromRecord(record); this.errors = {}; this.pendingMode = null; this.error = null; this.notice = "";
    void this.updateComplete.then(() => { this.querySelector(".entry-card")?.scrollIntoView({ block: "start" }); this.querySelector<HTMLInputElement>("#sleep-date")?.focus(); });
  }
  private setField(key: "sleepDate" | "sleepScore" | "source" | "notes", value: string) {
    this.draft = { ...this.draft, [key]: value }; this.clearError(key);
  }
  private clearError(key: string) { const errors = { ...this.errors }; delete errors[key]; this.errors = errors; this.notice = ""; }
  private setSummary(key: DurationKey | "awakeCount", value: DurationDraft | string) {
    this.draft = { ...this.draft, summary: { ...this.draft.summary, [key]: value } }; this.clearError(key);
  }
  private setSession(index: number, change: Partial<SessionDraft>, field?: string) {
    this.draft = { ...this.draft, sessions: this.draft.sessions.map((session, i) => i === index ? { ...session, ...change } : session) };
    if (field) this.clearError(`sessions.${index}.${field}`);
  }
  private async requestMode(mode: DetailMode) {
    if (mode === this.draft.detailMode) return;
    this.pendingMode = mode; this.notice = "";
    await this.updateComplete;
    this.querySelector<HTMLButtonElement>("#sleep-mode-cancel")?.focus();
  }
  private async resolveMode(confirm: boolean) {
    if (confirm && this.pendingMode) { this.draft = changeMode(this.draft, this.pendingMode); this.errors = {}; }
    this.pendingMode = null;
    await this.updateComplete;
    this.querySelector<HTMLButtonElement>(`#sleep-mode-${this.draft.detailMode}`)?.focus();
  }
  private async addSession() {
    const session = newSession(this.draft.sessions.length ? "nap" : "main-sleep");
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
    this.draft = { ...this.draft, sessions: removeSession(this.draft.sessions, this.draft.sessions[index]!.key) };
    this.errors = {}; this.notice = `Session ${index + 1} removed. Changes are not saved yet.`;
    await this.updateComplete;
    const next = this.draft.sessions[Math.min(index, this.draft.sessions.length - 1)];
    this.querySelector<HTMLElement>(`#${next?.key}-heading`)?.focus();
  }
  private async submit(event: SubmitEvent) {
    event.preventDefault();
    if (this.saving || this.pendingMode) return;
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
    this.saving = true; this.error = null; this.notice = "";
    try {
      const saved = this.draft.id ? await sleepRecordsApi.update(this.draft.id, result.input) : await sleepRecordsApi.create(result.input);
      // Replace both the history and editable preview with the authoritative response.
      this.records = [...this.records.filter(({ id }) => id !== saved.id), saved].sort((a, b) => b.sleepDate.localeCompare(a.sleepDate));
      this.draft = draftFromRecord(saved); this.errors = {}; this.notice = "Sleep record saved. Daily totals reflect the saved record.";
    } catch (error) { this.error = error instanceof Error ? error.message : "Unable to save sleep record."; }
    finally { this.saving = false; }
  }
  private async deleteRecord(record: SleepRecord) {
    if (!window.confirm(`Delete the sleep record for ${this.formatDate(record.sleepDate)} and all its sessions?`)) return;
    this.deletingId = record.id; this.error = null;
    try { await sleepRecordsApi.delete(record.id); this.records = this.records.filter(({ id }) => id !== record.id); if (this.draft.id === record.id) this.resetForm(); }
    catch (error) { this.error = error instanceof Error ? error.message : "Unable to delete sleep record."; }
    finally { this.deletingId = null; }
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
    return html`<label>Times awake<input type="number" min="0" max="2147483647" step="1" inputmode="numeric" placeholder="Unknown" .value=${row.awakeCount}
      data-field=${field} aria-invalid=${this.errors[field] ? "true" : "false"} aria-describedby=${this.errors[field] ? `sleep-error-${field}` : nothing}
      @input=${(event: InputEvent) => set((event.target as HTMLInputElement).value)} />${this.fieldError(field)}</label>`;
  }
  private optionalMeasurements(row: MeasurementsDraft, set: (key: DurationKey | "awakeCount", value: DurationDraft | string) => void, prefix = "") {
    return html`${this.awakeInput(row, (value) => set("awakeCount", value), prefix)}
      ${this.durationInput("Total time awake", "awakeMinutes", row, (value) => set("awakeMinutes", value), prefix)}
      ${this.durationInput("Light sleep", "lightMinutes", row, (value) => set("lightMinutes", value), prefix)}
      ${this.durationInput("Deep sleep", "deepMinutes", row, (value) => set("deepMinutes", value), prefix)}
      ${this.durationInput("REM sleep", "remMinutes", row, (value) => set("remMinutes", value), prefix)}`;
  }
  private renderSession(session: SessionDraft, index: number) {
    const prefix = `sessions.${index}.`;
    return html`<section class="sleep-session-card" aria-labelledby=${`${session.key}-heading`}>
      <h3 id=${`${session.key}-heading`} tabindex="-1">Session ${index + 1} · ${typeLabels[session.sessionType]}</h3>
      <div class="sleep-session-actions">
        <button type="button" class="text-button" ?disabled=${index === 0} aria-label=${`Move session ${index + 1} up`} @click=${() => this.reorderSession(index, -1)}>Move up</button>
        <button type="button" class="text-button" ?disabled=${index === this.draft.sessions.length - 1} aria-label=${`Move session ${index + 1} down`} @click=${() => this.reorderSession(index, 1)}>Move down</button>
        <button type="button" class="text-button danger" ?disabled=${this.draft.sessions.length === 1} aria-label=${`Remove session ${index + 1}`} @click=${() => this.deleteSession(index)}>Remove</button>
      </div>
      <div class="sleep-fields-grid">
        <label>Session type<select id=${`${session.key}-type`} .value=${session.sessionType} @change=${(event: Event) => this.setSession(index, { sessionType: (event.target as HTMLSelectElement).value as SessionDraft["sessionType"] })}>
          <option value="main-sleep">Main sleep</option><option value="nap">Nap</option><option value="other">Other</option></select></label>
        <label>Label (optional)<input maxlength="200" .value=${session.label} @input=${(event: InputEvent) => this.setSession(index, { label: (event.target as HTMLInputElement).value })} /></label>
        ${this.durationInput("Total sleep", "totalSleepMinutes", session, (value) => this.setSession(index, { totalSleepMinutes: value }, "totalSleepMinutes"), prefix)}
        <label>Source (optional)<input maxlength="200" .value=${session.source} @input=${(event: InputEvent) => this.setSession(index, { source: (event.target as HTMLInputElement).value })} /></label>
      </div>
      <div class="sleep-fields-grid sleep-time-fields">${(["startedAt", "endedAt"] as const).map((key) => html`
        <label>${key === "startedAt" ? "Start date/time (optional)" : "End date/time (optional)"}<input type="datetime-local" step="60" .value=${session[key]}
          data-field=${`${prefix}${key}`} aria-invalid=${this.errors[`${prefix}${key}`] ? "true" : "false"}
          aria-describedby=${this.errors[`${prefix}${key}`] ? `sleep-error-${prefix}${key}` : "sleep-time-help"}
          @input=${(event: InputEvent) => this.setSession(index, { [key]: (event.target as HTMLInputElement).value }, key)} />${this.fieldError(`${prefix}${key}`)}</label>`)}</div>
      <details class="sleep-optional-details" .open=${session.detailsOpen} @toggle=${(event: Event) => { const open = (event.target as HTMLDetailsElement).open; if (open !== session.detailsOpen) this.setSession(index, { detailsOpen: open }); }}>
        <summary>Sleep stages and Awake details</summary><p class="sleep-help">Optional. Leave unknown values empty; enter 0 only when reported as zero.</p>
        <div class="sleep-fields-grid">${this.optionalMeasurements(session, (key, value) => this.setSession(index, { [key]: value }, key), prefix)}</div>
      </details>
    </section>`;
  }
  private renderPreview() {
    const preview = previewSessions(this.draft.sessions);
    return html`<section class="sleep-preview" aria-labelledby="sleep-preview-heading"><h3 id="sleep-preview-heading">Daily total · preview</h3>
      <dl>${(["totalSleepMinutes", "awakeCount", "awakeMinutes", "lightMinutes", "deepMinutes", "remMinutes"] as const).map((key, index) => html`
        <div><dt>${["Total sleep", "Times awake", "Total time awake", "Light", "Deep", "REM"][index]}</dt><dd>${preview[key] == null ? key === "totalSleepMinutes" ? "Enter a duration for every session" : "Not available for the complete day" : key === "awakeCount" ? preview[key] : formatDuration(preview[key]!)}</dd></div>`)}</dl>
      <strong>${coverageLabels[preview.stageCoverage]}</strong>
      ${preview.stageCoverage === "partial" ? html`<p>Some sessions, such as naps, do not include sleep-stage details.</p>` : nothing}
      <p>Healthz calculates each complete daily total from all sessions. Saved results are confirmed by the server.</p>
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
  private renderList() {
    if (this.loading) return html`<div class="state" aria-live="polite">Loading sleep records…</div>`;
    if (!this.records.length) return html`<div class="state empty"><strong>Start your sleep history</strong><p>Add your first sleep day using the form.</p></div>`;
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
        <div class="actions"><button class="text-button" type="button" ?disabled=${this.saving} @click=${() => this.edit(record)}>Edit</button><button class="text-button danger" type="button" ?disabled=${this.saving || this.deletingId === record.id} @click=${() => this.deleteRecord(record)}>${this.deletingId === record.id ? "Deleting…" : "Delete"}</button></div>
        ${record.detailMode === "sessions" ? html`<details class="sleep-session-history"><summary>View ${record.sessions.length} ${record.sessions.length === 1 ? "session" : "sessions"}</summary><p class="sleep-help">Times shown in ${this.timeZone}.</p><ol>${record.sessions.map((session, index) => this.renderSessionHistory(session, index))}</ol></details>` : nothing}
      </article>`)}</div>`;
  }
  render() {
    const latest = this.records[0]; const draft = this.draft;
    return html`<main class="sleep-page"><section class="page-heading"><div><span class="eyebrow">Daily records</span><h1>Sleep</h1><p>Record your main sleep and any naps for each sleep day.</p></div><span class="section-index">03</span></section>
      <section class="summary" aria-label="Sleep summary"><div><span class="eyebrow">Latest sleep</span><strong>${latest ? formatDuration(latest.totalSleepMinutes) : "—"}</strong><span>${latest ? this.formatDate(latest.sleepDate) : "No sleep records yet"}</span></div><div><span class="eyebrow">Latest score</span><strong>${latest?.sleepScore ?? "—"}</strong><span>Out of 100</span></div><div><span class="eyebrow">Entries</span><strong>${this.records.length}</strong><span>Total sleep records</span></div></section>
      <div class="workspace sleep-workspace ${draft.detailMode === "sessions" ? "sleep-workspace-sessions" : ""}">
        <section class="list-card"><div class="card-heading"><div><span class="eyebrow">History</span><h2>Your sleep records</h2></div><button class="refresh-button" type="button" @click=${this.loadRecords} ?disabled=${this.loading || this.saving}>Refresh</button></div>${this.renderList()}</section>
        <aside class="entry-card daily-entry-card"><span class="eyebrow">${draft.id ? "Edit entry" : "New entry"}</span><h2>${draft.id ? "Update sleep" : "Add sleep"}</h2>
          <p>Fields marked * are required. Other fields may be left empty.</p>
          <div class="sleep-mode-choice" role="group" aria-label="Entry mode">${(["summary", "sessions"] as const).map((mode) => html`<button type="button" id=${`sleep-mode-${mode}`} aria-pressed=${draft.detailMode === mode} ?disabled=${this.saving || !!this.pendingMode} @click=${() => this.requestMode(mode)}>${mode === "summary" ? "Daily summary" : "Individual sessions"}</button>`)}</div>
          <p class="sleep-mode-help">${draft.detailMode === "summary" ? "Enter the totals reported for the sleep day." : "Enter the main sleep and any additional sleep sessions or naps. Healthz calculates the daily total."}</p>
          ${this.pendingMode ? html`<section class="sleep-mode-confirm" role="alert" aria-labelledby="sleep-mode-confirm-title"><h3 id="sleep-mode-confirm-title">Change entry mode?</h3>
            <p>${this.pendingMode === "sessions" ? "Session totals will become authoritative on Save. Summary values will not be copied into a session. Enter session data before saving." : "All child sessions will be removed on Save. Current calculated totals will prefill the summary for you to review. Nothing changes until you save."}</p>
            <div class="sleep-session-actions"><button id="sleep-mode-cancel" class="text-button" type="button" @click=${() => this.resolveMode(false)}>Keep current mode</button><button class="text-button" type="button" @click=${() => this.resolveMode(true)}>Confirm mode change</button></div></section>` : nothing}
          ${this.error ? html`<div class="error-banner" role="alert">${this.error}</div>` : nothing}
          <p class="sleep-save-status" role="status">${this.notice}</p>
          <form class="compact-entry-form" novalidate @submit=${this.submit}>
            ${Object.keys(this.errors).length ? html`<div class="sleep-validation-summary" role="alert">Please correct the marked fields before saving.${this.errors.sessions ? html`<p>${this.errors.sessions}</p>` : nothing}</div>` : nothing}
            <fieldset class="sleep-form-fields" ?disabled=${this.saving || !!this.pendingMode}>
              <label>Sleep date *<input id="sleep-date" type="date" .value=${draft.sleepDate} data-field="sleepDate" aria-invalid=${this.errors.sleepDate ? "true" : "false"} aria-describedby=${this.errors.sleepDate ? "sleep-error-sleepDate" : "sleep-date-help"} @input=${(event: InputEvent) => this.setField("sleepDate", (event.target as HTMLInputElement).value)} />${this.fieldError("sleepDate")}</label>
              <p id="sleep-date-help" class="sleep-help">Choose the sleep day, usually the date your main sleep ended. Session times will not change this date.</p>
              ${draft.detailMode === "summary" ? html`
                ${draft.reviewSummary ? html`<p class="form-help" role="status">Review these calculated totals before saving. Missing totals remain empty. Saving removes the individual sessions.</p>` : nothing}
                ${this.durationInput("Total sleep", "totalSleepMinutes", draft.summary, (value) => this.setSummary("totalSleepMinutes", value))}
                ${this.optionalMeasurements(draft.summary, (key, value) => this.setSummary(key, value))}
              ` : html`<p id="sleep-time-help" class="sleep-help">Clock times are optional and use ${this.timeZone}. Start and end may be on different dates. Enter sleep duration separately; elapsed time may include Awake time.</p>
                ${repeat(draft.sessions, (session) => session.key, (session, index) => this.renderSession(session, index))}
                <button class="sleep-add-session" type="button" @click=${this.addSession}>Add session</button><p class="sleep-help">At least one session is required.</p>${this.renderPreview()}`}
              <label>Sleep score (0–100)<input type="number" min="0" max="100" step="1" .value=${draft.sleepScore} data-field="sleepScore" aria-invalid=${this.errors.sleepScore ? "true" : "false"} aria-describedby=${this.errors.sleepScore ? "sleep-error-sleepScore" : nothing} @input=${(event: InputEvent) => this.setField("sleepScore", (event.target as HTMLInputElement).value)} />${this.fieldError("sleepScore")}</label>
              <label>Source *<input maxlength="200" .value=${draft.source} aria-invalid=${this.errors.source ? "true" : "false"} aria-describedby=${this.errors.source ? "sleep-error-source" : nothing} @input=${(event: InputEvent) => this.setField("source", (event.target as HTMLInputElement).value)} />${this.fieldError("source")}</label>
              <label>Notes<textarea maxlength="2000" rows="2" .value=${draft.notes} @input=${(event: InputEvent) => this.setField("notes", (event.target as HTMLTextAreaElement).value)}></textarea></label>
              <button class="primary-button" type="submit">${this.saving ? "Saving…" : draft.id ? "Save changes" : "Add sleep record"}</button>
            </fieldset>
            <button class="cancel-button" type="button" ?disabled=${this.saving} @click=${this.resetForm}>${draft.id ? "Cancel editing / new entry" : "Clear form"}</button>
          </form>
        </aside>
      </div></main>`;
  }
}
customElements.define("sleep-page", SleepPage);
