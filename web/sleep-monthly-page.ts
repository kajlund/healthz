import { LitElement, html, nothing } from "lit";
import { monthlySleepApi, type MonthlySleepAverage } from "./api.js";
import { createMonthlySleepSchema } from "../src/sleep-monthly-averages/schemas.js";
import { durationDraft, durationValue, formatDuration, type DurationDraft } from "./sleep-editor.js";
import { localizedMonth } from "./report-format.js";

export const monthlyDurationFields = [
  ["averageTotalSleepMinutes", "Average total sleep"], ["averageDeepMinutes", "Average deep sleep"],
  ["averageLightMinutes", "Average light sleep"], ["averageRemMinutes", "Average REM sleep"],
] as const;
type Key = typeof monthlyDurationFields[number][0];
const emptyDurations = () => Object.fromEntries(monthlyDurationFields.map(([key]) => [key, durationDraft(null)])) as Record<Key, DurationDraft>;

class SleepMonthlyPage extends LitElement {
  static properties = { records: { state: true }, loading: { state: true }, busy: { state: true }, error: { state: true }, editing: { state: true }, month: { state: true }, durations: { state: true }, notes: { state: true }, notice: { state: true } };
  declare private records: MonthlySleepAverage[];
  declare private loading: boolean;
  declare private busy: boolean;
  declare private error: string;
  declare private editing: MonthlySleepAverage | null;
  declare private month: string;
  declare private durations: Record<Key, DurationDraft>;
  declare private notes: string;
  declare private notice: string;
  constructor() { super(); this.records = []; this.loading = true; this.busy = false; this.error = ""; this.editing = null; this.month = ""; this.durations = emptyDurations(); this.notes = ""; this.notice = ""; }
  protected createRenderRoot() { return this; }
  connectedCallback() { super.connectedCallback(); void this.load(); }
  private async load() {
    this.loading = true;
    try { this.records = await monthlySleepApi.list(); }
    catch (error) { this.error = error instanceof Error ? error.message : "Unable to load monthly averages."; }
    finally { this.loading = false; }
  }
  private reset() { this.editing = null; this.month = ""; this.durations = emptyDurations(); this.notes = ""; this.error = ""; }
  private edit(record: MonthlySleepAverage) {
    this.editing = record; this.month = `${record.year}-${String(record.month).padStart(2, "0")}`;
    this.durations = Object.fromEntries(monthlyDurationFields.map(([key]) => [key, durationDraft(record[key])])) as Record<Key, DurationDraft>;
    this.notes = record.notes ?? ""; this.error = ""; this.notice = "";
    this.querySelector("form")?.scrollIntoView({ block: "start" });
    this.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
  }
  private async submit(event: SubmitEvent) {
    event.preventDefault(); this.error = ""; this.notice = "";
    const [year, month] = this.month.split("-").map(Number);
    const result = createMonthlySleepSchema.safeParse({ year, month, ...Object.fromEntries(monthlyDurationFields.map(([key]) => [key, durationValue(this.durations[key])])), notes: this.notes.trim() || null, source: this.editing?.source ?? "manual" });
    if (!result.success) { this.error = "Choose a valid month and enter all four averages (0–24 hours each). Empty values are not zero."; return; }
    if (!this.editing && this.records.some((record) => record.year === year && record.month === month)) { this.error = "A monthly sleep average already exists for this month. Edit its entry instead."; return; }
    this.busy = true;
    try {
      if (this.editing) { const { year: _year, month: _month, ...values } = result.data; await monthlySleepApi.update(this.editing.year, this.editing.month, values); }
      else await monthlySleepApi.create(result.data);
      this.reset(); this.notice = "Monthly sleep average saved."; await this.load();
    } catch (error) { this.error = error instanceof Error ? error.message : "Unable to save monthly average."; }
    finally { this.busy = false; }
  }
  private async deleteAverage(record: MonthlySleepAverage) {
    if (!window.confirm(`Delete the monthly sleep average for ${record.year}-${String(record.month).padStart(2, "0")}? Reports will return to daily-derived values where daily data exists. Daily records are not changed.`)) return;
    this.busy = true; this.error = "";
    try { await monthlySleepApi.delete(record.year, record.month); if (this.editing?.id === record.id) this.reset(); this.notice = "Monthly average deleted. Reports now use available daily values for this month."; await this.load(); }
    catch (error) { this.error = error instanceof Error ? error.message : "Unable to delete monthly average."; }
    finally { this.busy = false; }
  }
  render() {
    return html`<main class="monthly-sleep-page"><section class="page-heading"><div><span class="eyebrow">Sleep</span><h1>Monthly sleep averages</h1><p>Enter monthly nightly averages, not monthly totals.</p><a href="#/measurements/sleep">Back to daily Sleep records</a></div></section>
      <p>Use this for a month where detailed daily Sleep data is unavailable. When present, these four averages are used in Sleep reports instead of averages calculated from the available daily records. Daily records are not changed.</p>
      ${this.error ? html`<p class="error-banner" role="alert">${this.error}</p>` : nothing}
      <p role="status">${this.notice}</p>
      <div class="workspace"><section class="list-card"><div class="card-heading"><h2>Entered months</h2></div>
      ${this.loading ? html`<p role="status">Loading monthly averages…</p>` : this.records.length ? this.records.map((record) => html`<article class="monthly-sleep-record"><h3>${localizedMonth(`${record.year}-${String(record.month).padStart(2, "0")}`)}</h3><dl>${monthlyDurationFields.map(([key, label]) => html`<div><dt>${label}</dt><dd>${formatDuration(record[key])}</dd></div>`)}<div><dt>Source</dt><dd>${record.source}</dd></div></dl><div class="actions"><button class="text-button" ?disabled=${this.busy} @click=${() => this.edit(record)}>Edit</button><button class="text-button danger" ?disabled=${this.busy} @click=${() => this.deleteAverage(record)}>Delete</button></div></article>`) : html`<p class="state">No monthly sleep averages entered.</p>`}</section>
      <aside class="entry-card"><h2>${this.editing ? "Edit monthly average" : "Add monthly average"}</h2><form class="compact-entry-form" @submit=${this.submit}>
      <label>Month<input type="month" required min="1900-01" max="9999-12" ?disabled=${this.busy || !!this.editing} .value=${this.month} @input=${(e: Event) => this.month = (e.target as HTMLInputElement).value}></label>
      ${monthlyDurationFields.map(([key, label]) => html`<fieldset class="duration-field"><legend>${label} *</legend><div class="duration-inputs">${(["hours", "minutes"] as const).map((part) => html`<label><span class="sr-only">${label} ${part}</span><input type="number" min="0" max=${part === "hours" ? 24 : 59} step="1" inputmode="numeric" placeholder=${part === "hours" ? "h" : "min"} ?disabled=${this.busy} .value=${this.durations[key][part]} @input=${(e: Event) => this.durations = { ...this.durations, [key]: { ...this.durations[key], [part]: (e.target as HTMLInputElement).value } }}></label><span>${part === "hours" ? "h" : "min"}</span>`)}</div></fieldset>`)}
      <label>Optional notes<textarea maxlength="2000" rows="2" ?disabled=${this.busy} .value=${this.notes} @input=${(e: Event) => this.notes = (e.target as HTMLTextAreaElement).value}></textarea></label>
      <button class="primary-button" ?disabled=${this.busy}>${this.busy ? "Saving…" : this.editing ? "Save changes" : "Add monthly average"}</button>${this.editing ? html`<button class="cancel-button" type="button" ?disabled=${this.busy} @click=${this.reset}>Cancel editing</button>` : nothing}
      </form><p>All four averages are required. Enter 0 explicitly for a known zero. Deleting an entry returns reports to daily-derived values when daily data exists.</p></aside></div></main>`;
  }
}
customElements.define("sleep-monthly-page", SleepMonthlyPage);
