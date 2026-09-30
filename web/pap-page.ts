import { LitElement, html, nothing } from "lit";

import { papRecordsApi, type PapRecord, type PapRecordInput } from "./api.js";
import { followingCalendarDay, previousCalendarDay } from "./pap-date.js";
import { emptyDateFilter, hasActiveFilter, parseDateFilter, updateDateFilterHash, type DateFilter } from "./measurement-filter-helpers.js";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const durationParts = (minutes: number | null): [string, string] =>
  minutes === null ? ["", ""] : [String(Math.floor(minutes / 60)), String(minutes % 60)];
const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

export class PapPage extends LitElement {
  static properties = {
    records: { state: true }, loading: { state: true }, saving: { state: true },
    deletingId: { state: true }, error: { state: true }, editingId: { state: true },
    therapyDate: { state: true }, healthDate: { state: true }, healthDateAutomatic: { state: true }, usageHours: { state: true }, usageMinutes: { state: true },
    eventsPerHour: { state: true }, maskSealScore: { state: true }, maskOnOffCount: { state: true },
    totalScore: { state: true }, source: { state: true }, notes: { state: true },
    filter: { state: true }, draftFilter: { state: true },
  };

  declare private records: PapRecord[];
  declare private loading: boolean;
  declare private saving: boolean;
  declare private deletingId: string | null;
  declare private error: string | null;
  declare private editingId: string | null;
  declare private therapyDate: string;
  declare private healthDate: string;
  declare private healthDateAutomatic: boolean;
  declare private usageHours: string;
  declare private usageMinutes: string;
  declare private eventsPerHour: string;
  declare private maskSealScore: string;
  declare private maskOnOffCount: string;
  declare private totalScore: string;
  declare private source: string;
  declare private notes: string;
  declare private filter: DateFilter;
  declare private draftFilter: DateFilter;

  constructor() {
    super();
    const currentDay = today();
    this.records = []; this.loading = true; this.saving = false; this.deletingId = null;
    this.error = null; this.editingId = null; this.therapyDate = previousCalendarDay(currentDay); this.healthDate = currentDay; this.healthDateAutomatic = true; this.usageHours = "";
    this.usageMinutes = ""; this.eventsPerHour = ""; this.maskSealScore = "";
    this.maskOnOffCount = ""; this.totalScore = ""; this.source = "manual"; this.notes = "";
    this.filter = parseDateFilter(); this.draftFilter = { ...this.filter };
  }

  protected createRenderRoot() { return this; }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("hashchange", this.handleRouteChange);
    void this.loadRecords();
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.handleRouteChange);
    super.disconnectedCallback();
  }

  private handleRouteChange = () => {
    this.filter = parseDateFilter();
    this.draftFilter = { ...this.filter };
    void this.loadRecords();
  };

  private async loadRecords() {
    this.loading = true; this.error = null;
    try { this.records = await papRecordsApi.list(this.filter); }
    catch (error) { this.error = error instanceof Error ? error.message : "Unable to load PAP records."; }
    finally { this.loading = false; }
  }

  private applyFilter(event: SubmitEvent) {
    event.preventDefault();
    const hash = updateDateFilterHash("#/measurements/pap", this.draftFilter);
    if (window.location.hash === hash) {
      this.filter = { ...this.draftFilter };
      void this.loadRecords();
    } else {
      window.location.hash = hash;
    }
  }

  private clearFilter() {
    this.draftFilter = emptyDateFilter();
    const hash = updateDateFilterHash("#/measurements/pap", emptyDateFilter());
    if (window.location.hash === hash) {
      this.filter = emptyDateFilter();
      void this.loadRecords();
    } else {
      window.location.hash = hash;
    }
  }

  private resetForm() {
    const currentDay = today();
    this.editingId = null; this.therapyDate = previousCalendarDay(currentDay); this.healthDate = currentDay; this.healthDateAutomatic = true; this.usageHours = ""; this.usageMinutes = "";
    this.eventsPerHour = ""; this.maskSealScore = ""; this.maskOnOffCount = "";
    this.totalScore = ""; this.source = "manual"; this.notes = "";
  }

  private edit(record: PapRecord) {
    this.editingId = record.id; this.therapyDate = record.therapyDate; this.healthDate = record.healthDate ?? ""; this.healthDateAutomatic = false;
    [this.usageHours, this.usageMinutes] = durationParts(record.usageMinutes);
    this.eventsPerHour = record.eventsPerHour === null ? "" : String(record.eventsPerHour);
    this.maskSealScore = record.maskSealScore === null ? "" : String(record.maskSealScore);
    this.maskOnOffCount = record.maskOnOffCount === null ? "" : String(record.maskOnOffCount);
    this.totalScore = record.totalScore === null ? "" : String(record.totalScore);
    this.source = record.source; this.notes = record.notes ?? ""; this.error = null;
    document.querySelector("pap-page .entry-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  private optionalNumber(value: string) { return value === "" ? null : Number(value); }
  private changeTherapyDate(value: string) { this.therapyDate = value; if (this.healthDateAutomatic) this.healthDate = followingCalendarDay(value); }
  private optionalDuration() {
    return this.usageHours === "" && this.usageMinutes === ""
      ? null
      : Number(this.usageHours || 0) * 60 + Number(this.usageMinutes || 0);
  }

  private async submit(event: SubmitEvent) {
    event.preventDefault(); this.saving = true; this.error = null;
    const input: PapRecordInput = {
      therapyDate: this.therapyDate,
      healthDate: this.healthDate,
      usageMinutes: this.optionalDuration(),
      eventsPerHour: this.optionalNumber(this.eventsPerHour),
      maskSealScore: this.optionalNumber(this.maskSealScore),
      maskOnOffCount: this.optionalNumber(this.maskOnOffCount),
      totalScore: this.optionalNumber(this.totalScore),
      source: this.source.trim(), notes: this.notes.trim() || null,
    };
    try {
      if (this.editingId) await papRecordsApi.update(this.editingId, input);
      else await papRecordsApi.create(input);
      this.resetForm(); await this.loadRecords();
    } catch (error) { this.error = error instanceof Error ? error.message : "Unable to save PAP record."; }
    finally { this.saving = false; }
  }

  private async deleteRecord(record: PapRecord) {
    if (!window.confirm(`Delete the PAP record for ${this.formatDate(record.therapyDate)}?`)) return;
    this.deletingId = record.id; this.error = null;
    try {
      await papRecordsApi.delete(record.id);
      this.records = this.records.filter(({ id }) => id !== record.id);
      if (this.editingId === record.id) this.resetForm();
    } catch (error) { this.error = error instanceof Error ? error.message : "Unable to delete PAP record."; }
    finally { this.deletingId = null; }
  }

  private formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
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
    if (this.loading) return html`<div class="state" aria-live="polite"><span class="spinner"></span>Loading PAP records…</div>`;
    if (!this.records.length) {
      const active = hasActiveFilter(this.filter);
      return html`<div class="state empty"><span class="empty-mark">04</span><strong>${active ? "No PAP records match these dates" : "Start your PAP history"}</strong><p>${active ? "Clear or change the date filters to see other records." : "Add the values reported by your machine or service."}</p></div>`;
    }
    return html`<div class="measurement-list"><div class="list-head pap-grid" aria-hidden="true"><span>PAP & Health dates</span><span>Usage & AHI</span><span>Score</span><span>Actions</span></div>${this.records.map((item) => html`
      <article class="measurement-row pap-grid">
        <div class="date-cell pap-date-cell"><span class="mobile-label">Dates</span><div class="pap-date-pair"><div><small>PAP</small><strong>${this.formatDate(item.therapyDate)}</strong></div><div><small>Health</small>${item.healthDate ? html`<strong>${this.formatDate(item.healthDate)}</strong>` : html`<span class="muted">Not set</span>`}</div></div></div>
        <div class="pap-metrics"><span class="mobile-label">Usage & AHI</span>${item.usageMinutes === null ? nothing : html`<strong>${formatDuration(item.usageMinutes)}</strong>`}${item.eventsPerHour === null ? nothing : html`<span>${item.eventsPerHour} events/hour (AHI)</span>`}${item.usageMinutes === null && item.eventsPerHour === null ? html`<span class="muted">Not recorded</span>` : nothing}</div>
        <div class="pap-metrics"><span class="mobile-label">Score</span>${item.totalScore === null ? html`<span class="muted">Not recorded</span>` : html`<strong>${item.totalScore}</strong>`}${item.maskOnOffCount === null ? nothing : html`<span>Mask on/off ${item.maskOnOffCount}</span>`}</div>
        <div class="actions"><button class="text-button" type="button" @click=${() => this.edit(item)}>Edit</button><button class="text-button danger" type="button" ?disabled=${this.deletingId === item.id} @click=${() => this.deleteRecord(item)}>${this.deletingId === item.id ? "Deleting…" : "Delete"}</button></div>
      </article>` )}</div>`;
  }

  render() {
    const latest = this.records[0];
    return html`<main><section class="page-heading"><div><span class="eyebrow">Daily records</span><h1>PAP</h1><p>PAP date is shown by the PAP service. Health date aligns the session with Sleep.</p></div><span class="section-index">04</span></section>
      <section class="summary" aria-label="PAP summary"><div><span class="eyebrow">Latest usage</span><strong>${latest?.usageMinutes === null || !latest ? "—" : formatDuration(latest.usageMinutes)}</strong><span>${latest ? this.formatDate(latest.therapyDate) : "No PAP records yet"}</span></div><div><span class="eyebrow">Latest score</span><strong>${latest?.totalScore ?? "—"}</strong><span>${latest?.totalScore == null ? "No score recorded" : "Points out of 100"}</span></div><div><span class="eyebrow">Entries</span><strong>${this.records.length}</strong><span>Total PAP records</span></div></section>
      ${this.error ? html`<div class="error-banner" role="alert"><strong>Something needs attention.</strong><span>${this.error}</span><button type="button" @click=${() => (this.error = null)} aria-label="Dismiss error">×</button></div>` : nothing}
      <div class="workspace pap-workspace"><section class="list-card"><div class="card-heading"><div><span class="eyebrow">History</span><h2>Your PAP records</h2></div><button class="refresh-button" type="button" @click=${this.loadRecords} ?disabled=${this.loading}>Refresh</button></div>${this.renderFilters()}${this.renderList()}</section>
      <aside class="entry-card daily-entry-card"><span class="eyebrow">${this.editingId ? "Edit entry" : "New entry"}</span><h2>${this.editingId ? "Update PAP record" : "Add PAP record"}</h2><form class="compact-entry-form" @submit=${this.submit}>
        <p class="form-help">PAP date is the date shown by the PAP service. Health date is the wake-up date Healthz uses to align this session with Sleep.</p>
        <label>PAP date <span class="required-marker" aria-hidden="true">*</span><input type="date" required .value=${this.therapyDate} @input=${(e: InputEvent) => this.changeTherapyDate((e.target as HTMLInputElement).value)} /></label>
        <label>Health date <span>${this.editingId && !this.healthDate ? "required for this older record" : "wake-up date"} <span class="required-marker" aria-hidden="true">*</span></span><input type="date" required .value=${this.healthDate} @input=${(e: InputEvent) => { this.healthDate = (e.target as HTMLInputElement).value; this.healthDateAutomatic = false; }} /></label>${this.editingId && !this.healthDate ? html`<button class="text-button health-date-default" type="button" @click=${() => { this.healthDate = followingCalendarDay(this.therapyDate); this.healthDateAutomatic = false; }}>Use following day</button>` : nothing}
        <label>Total score <span>0–100</span><input type="number" min="0" max="100" step="1" inputmode="numeric" .value=${this.totalScore} @input=${(e: InputEvent) => (this.totalScore = (e.target as HTMLInputElement).value)} /></label>
        <fieldset class="duration-field"><legend>Usage duration</legend><div class="duration-inputs"><label><span class="sr-only">Usage hours</span><input type="number" min="0" max="24" step="1" inputmode="numeric" placeholder="h" .value=${this.usageHours} @input=${(e: InputEvent) => (this.usageHours = (e.target as HTMLInputElement).value)} /></label><span>h</span><label><span class="sr-only">Usage minutes</span><input type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="min" .value=${this.usageMinutes} @input=${(e: InputEvent) => (this.usageMinutes = (e.target as HTMLInputElement).value)} /></label><span>min</span></div></fieldset>
        <label>Mask seal score<input type="number" min="0" step="1" inputmode="numeric" .value=${this.maskSealScore} @input=${(e: InputEvent) => (this.maskSealScore = (e.target as HTMLInputElement).value)} /></label>
        <div class="compact-form-row"><label>Events per hour <span>AHI</span><input type="number" min="0" step="0.01" inputmode="decimal" placeholder="2.4" .value=${this.eventsPerHour} @input=${(e: InputEvent) => (this.eventsPerHour = (e.target as HTMLInputElement).value)} /></label>
        <label>Mask on/off<input type="number" min="0" step="1" inputmode="numeric" .value=${this.maskOnOffCount} @input=${(e: InputEvent) => (this.maskOnOffCount = (e.target as HTMLInputElement).value)} /></label></div>
        <label>Source <span class="required-marker" aria-hidden="true">*</span><input type="text" required maxlength="200" .value=${this.source} @input=${(e: InputEvent) => (this.source = (e.target as HTMLInputElement).value)} /></label>
        <label>Notes<textarea maxlength="2000" rows="2" .value=${this.notes} @input=${(e: InputEvent) => (this.notes = (e.target as HTMLTextAreaElement).value)}></textarea></label>
        <button class="primary-button" type="submit" ?disabled=${this.saving}>${this.saving ? "Saving…" : this.editingId ? "Save changes" : "Add PAP record"}</button>${this.editingId ? html`<button class="cancel-button" type="button" @click=${this.resetForm}>Cancel editing</button>` : nothing}
      </form></aside></div></main>`;
  }
}

customElements.define("pap-page", PapPage);
