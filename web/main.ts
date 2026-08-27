import { LitElement, html, nothing } from "lit";

import { bodyMeasurementsApi, type BodyMeasurement, type BodyMeasurementInput } from "./api.js";
import "./blood-pressure-page.js";
import "./styles.css";

const today = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

class HealthzApp extends LitElement {
  static properties = {
    measurements: { state: true },
    loading: { state: true },
    saving: { state: true },
    deletingId: { state: true },
    error: { state: true },
    editingId: { state: true },
    measuredOn: { state: true },
    weightKg: { state: true },
    notes: { state: true },
    section: { state: true },
  };

  declare private measurements: BodyMeasurement[];
  declare private loading: boolean;
  declare private saving: boolean;
  declare private deletingId: string | null;
  declare private error: string | null;
  declare private editingId: string | null;
  declare private measuredOn: string;
  declare private weightKg: string;
  declare private notes: string;
  declare private section: "body-weight" | "blood-pressure";

  constructor() {
    super();
    this.measurements = [];
    this.loading = true;
    this.saving = false;
    this.deletingId = null;
    this.error = null;
    this.editingId = null;
    this.measuredOn = today();
    this.weightKg = "";
    this.notes = "";
    this.section = "body-weight";
  }

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadMeasurements();
  }

  private async loadMeasurements() {
    this.loading = true;
    this.error = null;
    try {
      this.measurements = await bodyMeasurementsApi.list();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to load measurements.";
    } finally {
      this.loading = false;
    }
  }

  private resetForm() {
    this.editingId = null;
    this.measuredOn = today();
    this.weightKg = "";
    this.notes = "";
  }

  private edit(measurement: BodyMeasurement) {
    this.editingId = measurement.id;
    this.measuredOn = measurement.measuredOn;
    this.weightKg = String(measurement.weightKg);
    this.notes = measurement.notes ?? "";
    this.error = null;
    document.querySelector(".entry-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  private async submit(event: SubmitEvent) {
    event.preventDefault();
    this.saving = true;
    this.error = null;

    const input: BodyMeasurementInput = {
      measuredOn: this.measuredOn,
      weightKg: Number(this.weightKg),
      notes: this.notes.trim() || null,
    };

    try {
      if (this.editingId) {
        await bodyMeasurementsApi.update(this.editingId, input);
      } else {
        await bodyMeasurementsApi.create(input);
      }
      this.resetForm();
      await this.loadMeasurements();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to save measurement.";
    } finally {
      this.saving = false;
    }
  }

  private async deleteMeasurement(measurement: BodyMeasurement) {
    if (!window.confirm(`Delete the measurement from ${this.formatDate(measurement.measuredOn)}?`)) return;
    this.deletingId = measurement.id;
    this.error = null;
    try {
      await bodyMeasurementsApi.delete(measurement.id);
      this.measurements = this.measurements.filter(({ id }) => id !== measurement.id);
      if (this.editingId === measurement.id) this.resetForm();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to delete measurement.";
    } finally {
      this.deletingId = null;
    }
  }

  private formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  }

  private renderSummary() {
    const latest = this.measurements[0];
    const previous = this.measurements[1];
    const change = latest && previous ? latest.weightKg - previous.weightKg : null;

    return html`
      <section class="summary" aria-label="Weight summary">
        <div>
          <span class="eyebrow">Latest weight</span>
          <strong>${latest ? latest.weightKg.toFixed(2) : "—"}<small> kg</small></strong>
          <span>${latest ? this.formatDate(latest.measuredOn) : "No measurements yet"}</span>
        </div>
        <div>
          <span class="eyebrow">Change</span>
          <strong class=${change !== null && change > 0 ? "change-up" : ""}>
            ${change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(2)}`}<small>${change === null ? "" : " kg"}</small>
          </strong>
          <span>From previous entry</span>
        </div>
        <div>
          <span class="eyebrow">Entries</span>
          <strong>${this.measurements.length}</strong>
          <span>Total measurements</span>
        </div>
      </section>
    `;
  }

  private renderList() {
    if (this.loading) {
      return html`<div class="state" aria-live="polite"><span class="spinner"></span>Loading measurements…</div>`;
    }
    if (this.measurements.length === 0) {
      return html`
        <div class="state empty">
          <span class="empty-mark">01</span>
          <strong>Start your weight history</strong>
          <p>Add your first measurement using the form.</p>
        </div>
      `;
    }

    return html`
      <div class="measurement-list">
        <div class="list-head" aria-hidden="true">
          <span>Date</span><span>Weight</span><span>Notes</span><span>Actions</span>
        </div>
        ${this.measurements.map(
          (item) => html`
            <article class="measurement-row">
              <div class="date-cell">
                <span class="mobile-label">Date</span>
                <strong>${this.formatDate(item.measuredOn)}</strong>
              </div>
              <div class="weight-cell">
                <span class="mobile-label">Weight</span>
                <strong>${item.weightKg.toFixed(2)} <small>kg</small></strong>
              </div>
              <div class="notes-cell">
                <span class="mobile-label">Notes</span>
                <span class=${item.notes ? "" : "muted"}>${item.notes || "No notes"}</span>
              </div>
              <div class="actions">
                <button class="text-button" type="button" @click=${() => this.edit(item)}>Edit</button>
                <button
                  class="text-button danger"
                  type="button"
                  ?disabled=${this.deletingId === item.id}
                  @click=${() => this.deleteMeasurement(item)}
                >${this.deletingId === item.id ? "Deleting…" : "Delete"}</button>
              </div>
            </article>
          `,
        )}
      </div>
    `;
  }

  render() {
    return html`
      <header class="site-header">
        <a class="brand" href="/" aria-label="Healthz home"><span>H</span>Healthz</a>
        <nav class="site-nav" aria-label="Health sections">
          <button class=${this.section === "body-weight" ? "active" : ""} type="button" @click=${() => (this.section = "body-weight")}>Body weight</button>
          <button class=${this.section === "blood-pressure" ? "active" : ""} type="button" @click=${() => (this.section = "blood-pressure")}>Blood pressure</button>
        </nav>
        <div class="header-meta"><span class="status-dot"></span>Personal health log</div>
      </header>

      ${this.section === "body-weight" ? html`<main>
        <section class="page-heading">
          <div>
            <span class="eyebrow">Measurements</span>
            <h1>Body weight</h1>
            <p>Keep a clear, consistent record of your weight over time.</p>
          </div>
          <span class="section-index">01</span>
        </section>

        ${this.renderSummary()}

        ${this.error
          ? html`<div class="error-banner" role="alert"><strong>Something needs attention.</strong><span>${this.error}</span><button type="button" @click=${() => (this.error = null)} aria-label="Dismiss error">×</button></div>`
          : nothing}

        <div class="workspace">
          <section class="list-card">
            <div class="card-heading">
              <div><span class="eyebrow">History</span><h2>Your measurements</h2></div>
              <button class="refresh-button" type="button" @click=${this.loadMeasurements} ?disabled=${this.loading}>Refresh</button>
            </div>
            ${this.renderList()}
          </section>

          <aside class="entry-card">
            <span class="eyebrow">${this.editingId ? "Edit entry" : "New entry"}</span>
            <h2>${this.editingId ? "Update measurement" : "Add measurement"}</h2>
            <p>${this.editingId ? "Change the details for this entry." : "Record one measurement per day."}</p>

            <form @submit=${this.submit}>
              <label>Date<input type="date" required .value=${this.measuredOn} @input=${(event: InputEvent) => (this.measuredOn = (event.target as HTMLInputElement).value)} /></label>
              <label>Weight <span>kg</span><div class="weight-input"><input type="number" required min="0.01" max="9999.99" step="0.01" inputmode="decimal" placeholder="82.45" .value=${this.weightKg} @input=${(event: InputEvent) => (this.weightKg = (event.target as HTMLInputElement).value)} /><span>kg</span></div></label>
              <label>Notes <span>optional</span><textarea maxlength="2000" rows="3" placeholder="Morning, before breakfast…" .value=${this.notes} @input=${(event: InputEvent) => (this.notes = (event.target as HTMLTextAreaElement).value)}></textarea></label>
              <button class="primary-button" type="submit" ?disabled=${this.saving}>${this.saving ? "Saving…" : this.editingId ? "Save changes" : "Add measurement"}</button>
              ${this.editingId ? html`<button class="cancel-button" type="button" @click=${this.resetForm}>Cancel editing</button>` : nothing}
            </form>
          </aside>
        </div>
      </main>` : html`<blood-pressure-page></blood-pressure-page>`}

      <footer><span>Healthz</span><span>Your data, clearly kept.</span></footer>
    `;
  }
}

customElements.define("healthz-app", HealthzApp);
