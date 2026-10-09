import { LitElement, html, nothing } from "lit";

import {
  bloodPressureReadingsApi,
  type BloodPressureReading,
  type BloodPressureReadingInput,
} from "./api.js";
import { emptyDateFilter, hasActiveFilter, parseDateFilter, updateDateFilterHash, type DateFilter } from "./measurement-filter-helpers.js";

const toLocalInputValue = (value: Date | string) => {
  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
};

export class BloodPressurePage extends LitElement {
  static properties = {
    readings: { state: true },
    loading: { state: true },
    saving: { state: true },
    deletingId: { state: true },
    error: { state: true },
    editingId: { state: true },
    measuredAt: { state: true },
    systolic: { state: true },
    diastolic: { state: true },
    pulse: { state: true },
    notes: { state: true },
    filter: { state: true },
    draftFilter: { state: true },
  };

  declare private readings: BloodPressureReading[];
  declare private loading: boolean;
  declare private saving: boolean;
  declare private deletingId: string | null;
  declare private error: string | null;
  declare private editingId: string | null;
  declare private measuredAt: string;
  declare private systolic: string;
  declare private diastolic: string;
  declare private pulse: string;
  declare private notes: string;
  declare private filter: DateFilter;
  declare private draftFilter: DateFilter;

  constructor() {
    super();
    this.readings = [];
    this.loading = true;
    this.saving = false;
    this.deletingId = null;
    this.error = null;
    this.editingId = null;
    this.measuredAt = toLocalInputValue(new Date());
    this.systolic = "";
    this.diastolic = "";
    this.pulse = "";
    this.notes = "";
    this.filter = parseDateFilter();
    this.draftFilter = { ...this.filter };
  }

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("hashchange", this.handleRouteChange);
    void this.loadReadings();
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.handleRouteChange);
    super.disconnectedCallback();
  }

  private handleRouteChange = () => {
    this.filter = parseDateFilter();
    this.draftFilter = { ...this.filter };
    void this.loadReadings();
  };

  private async loadReadings() {
    this.loading = true;
    this.error = null;
    try {
      this.readings = await bloodPressureReadingsApi.list(this.filter);
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to load readings.";
    } finally {
      this.loading = false;
    }
  }

  private applyFilter(event: SubmitEvent) {
    event.preventDefault();
    const hash = updateDateFilterHash("#/measurements/blood-pressure", this.draftFilter);
    if (window.location.hash === hash) {
      this.filter = { ...this.draftFilter };
      void this.loadReadings();
    } else {
      window.location.hash = hash;
    }
  }

  private clearFilter() {
    this.draftFilter = emptyDateFilter();
    const hash = updateDateFilterHash("#/measurements/blood-pressure", emptyDateFilter());
    if (window.location.hash === hash) {
      this.filter = emptyDateFilter();
      void this.loadReadings();
    } else {
      window.location.hash = hash;
    }
  }

  private resetForm() {
    this.editingId = null;
    this.measuredAt = toLocalInputValue(new Date());
    this.systolic = "";
    this.diastolic = "";
    this.pulse = "";
    this.notes = "";
  }

  private edit(reading: BloodPressureReading) {
    this.editingId = reading.id;
    this.measuredAt = toLocalInputValue(reading.measuredAt);
    this.systolic = String(reading.systolic);
    this.diastolic = String(reading.diastolic);
    this.pulse = reading.pulse === null ? "" : String(reading.pulse);
    this.notes = reading.notes ?? "";
    this.error = null;
    document.querySelector("blood-pressure-page .entry-card")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  private async submit(event: SubmitEvent) {
    event.preventDefault();
    this.saving = true;
    this.error = null;

    const input: BloodPressureReadingInput = {
      measuredAt: new Date(this.measuredAt).toISOString(),
      systolic: Number(this.systolic),
      diastolic: Number(this.diastolic),
      pulse: this.pulse ? Number(this.pulse) : null,
      notes: this.notes.trim() || null,
    };

    try {
      if (this.editingId) {
        await bloodPressureReadingsApi.update(this.editingId, input);
      } else {
        await bloodPressureReadingsApi.create(input);
      }
      this.resetForm();
      await this.loadReadings();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to save reading.";
    } finally {
      this.saving = false;
    }
  }

  private async deleteReading(reading: BloodPressureReading) {
    if (!window.confirm(`Delete the reading from ${this.formatDateTime(reading.measuredAt)}?`)) return;
    this.deletingId = reading.id;
    this.error = null;
    try {
      await bloodPressureReadingsApi.delete(reading.id);
      this.readings = this.readings.filter(({ id }) => id !== reading.id);
      if (this.editingId === reading.id) this.resetForm();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to delete reading.";
    } finally {
      this.deletingId = null;
    }
  }

  private formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  private renderSummary() {
    const latest = this.readings[0];
    return html`
      <section class="summary" aria-label="Blood pressure summary">
        <div>
          <span class="eyebrow">Latest reading</span>
          <strong>${latest ? `${latest.systolic} / ${latest.diastolic}` : "—"}<small>${latest ? " mmHg" : ""}</small></strong>
          <span>${latest ? this.formatDateTime(latest.measuredAt) : "No readings yet"}</span>
        </div>
        <div>
          <span class="eyebrow">Latest pulse</span>
          <strong>${latest?.pulse ?? "—"}<small>${latest?.pulse ? " bpm" : ""}</small></strong>
          <span>${latest?.pulse ? "Recorded with latest reading" : "No pulse recorded"}</span>
        </div>
        <div>
          <span class="eyebrow">Entries</span>
          <strong>${this.readings.length}</strong>
          <span>Total readings</span>
        </div>
      </section>
    `;
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
    if (this.loading) {
      return html`<div class="state" aria-live="polite"><span class="spinner"></span>Loading readings…</div>`;
    }
    if (this.readings.length === 0) {
      const active = hasActiveFilter(this.filter);
      return html`
        <div class="state empty">
          <span class="empty-mark">02</span>
          <strong>${active ? "No readings match these dates" : "Start your blood pressure history"}</strong>
          <p>${active ? "Clear or change the date filters to see other readings." : "Add your first reading using the form."}</p>
        </div>
      `;
    }

    return html`
      <div class="measurement-list blood-pressure-list">
        <div class="list-head blood-pressure-grid" aria-hidden="true">
          <span>Date & time</span><span>Reading</span><span>Pulse</span><span>Notes</span><span>Actions</span>
        </div>
        ${this.readings.map(
          (item) => html`
            <article class="measurement-row blood-pressure-grid">
              <div class="date-cell">
                <span class="mobile-label">Date & time</span>
                <strong>${this.formatDateTime(item.measuredAt)}</strong>
              </div>
              <div class="pressure-cell">
                <span class="mobile-label">Reading</span>
                <strong>${item.systolic} / ${item.diastolic} <small>mmHg</small></strong>
              </div>
              <div class="pulse-cell">
                <span class="mobile-label">Pulse</span>
                <span class=${item.pulse ? "" : "muted"}>${item.pulse ? `${item.pulse} bpm` : "—"}</span>
              </div>
              <div class="notes-cell">
                <span class="mobile-label">Notes</span>
                <span class=${item.notes ? "" : "muted"}>${item.notes || "No notes"}</span>
              </div>
              <div class="actions">
                <button class="text-button" type="button" @click=${() => this.edit(item)}>Edit</button>
                <button class="text-button danger" type="button" ?disabled=${this.deletingId === item.id} @click=${() => this.deleteReading(item)}>${this.deletingId === item.id ? "Deleting…" : "Delete"}</button>
              </div>
            </article>
          `,
        )}
      </div>
    `;
  }

  render() {
    return html`
      <main>
        <section class="page-heading">
          <div>
            <span class="eyebrow">Measurements</span>
            <h1>Blood pressure</h1>
            <p>Record readings with their time, pulse and useful context.</p>
          </div>
          <span class="section-index">02</span>
        </section>

        ${this.renderSummary()}

        ${this.error
          ? html`<div class="error-banner" role="alert"><strong>Something needs attention.</strong><span>${this.error}</span><button type="button" @click=${() => (this.error = null)} aria-label="Dismiss error">×</button></div>`
          : nothing}

        <div class="workspace">
          <section class="list-card">
            <div class="card-heading">
              <div><span class="eyebrow">History</span><h2>Your readings</h2></div>
              <button class="refresh-button" type="button" @click=${this.loadReadings} ?disabled=${this.loading}>Refresh</button>
            </div>
            ${this.renderFilters()}
            ${this.renderList()}
          </section>

          <aside class="entry-card daily-entry-card">
            <span class="eyebrow">${this.editingId ? "Edit entry" : "New entry"}</span>
            <h2>${this.editingId ? "Update reading" : "Add reading"}</h2>
            <p>${this.editingId ? "Change the details for this reading." : "Multiple readings per day are welcome."}</p>

            <form class="compact-entry-form" @submit=${this.submit}>
              <label>Date & time <span class="required-marker" aria-hidden="true">*</span><input type="datetime-local" required .value=${this.measuredAt} @input=${(event: InputEvent) => (this.measuredAt = (event.target as HTMLInputElement).value)} /></label>
              <div class="vitals-inputs">
                <label>Systolic <span class="required-marker" aria-hidden="true">*</span><input type="number" required min="1" step="1" inputmode="numeric" placeholder="120" .value=${this.systolic} @input=${(event: InputEvent) => (this.systolic = (event.target as HTMLInputElement).value)} /></label>
                <label>Diastolic <span class="required-marker" aria-hidden="true">*</span><input type="number" required min="1" step="1" inputmode="numeric" placeholder="80" .value=${this.diastolic} @input=${(event: InputEvent) => (this.diastolic = (event.target as HTMLInputElement).value)} /></label>
              </div>
              <label>Pulse <span>bpm</span><input type="number" min="1" step="1" inputmode="numeric" placeholder="64" .value=${this.pulse} @input=${(event: InputEvent) => (this.pulse = (event.target as HTMLInputElement).value)} /></label>
              <label>Notes<textarea maxlength="2000" rows="2" placeholder="Seated, after resting…" .value=${this.notes} @input=${(event: InputEvent) => (this.notes = (event.target as HTMLTextAreaElement).value)}></textarea></label>
              <button class="primary-button" type="submit" ?disabled=${this.saving}>${this.saving ? "Saving…" : this.editingId ? "Save changes" : "Add reading"}</button>
              ${this.editingId ? html`<button class="cancel-button" type="button" @click=${this.resetForm}>Cancel editing</button>` : nothing}
            </form>
          </aside>
        </div>
      </main>
    `;
  }
}

customElements.define("blood-pressure-page", BloodPressurePage);
