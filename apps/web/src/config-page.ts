import { LitElement, html, nothing } from 'lit';
import { takeoutApi, type TakeoutData } from './api.js';

const LAST_EXPORT_KEY = 'healthz_last_takeout_at';

export class ConfigPage extends LitElement {
  static properties = {
    takeout: { state: true },
    loading: { state: true },
    downloadingDataset: { state: true },
    error: { state: true },
    lastExported: { state: true },
    successMessage: { state: true },
  };

  declare private takeout: TakeoutData | null;
  declare private loading: boolean;
  declare private downloadingDataset: string | null;
  declare private error: string | null;
  declare private lastExported: string | null;
  declare private successMessage: string | null;

  constructor() {
    super();
    this.takeout = null;
    this.loading = true;
    this.downloadingDataset = null;
    this.error = null;
    this.lastExported = localStorage.getItem(LAST_EXPORT_KEY);
    this.successMessage = null;
  }

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadSummary();
  }

  private async loadSummary() {
    this.loading = true;
    this.error = null;
    try {
      this.takeout = await takeoutApi.get();
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : 'Unable to inspect data counts.';
    } finally {
      this.loading = false;
    }
  }

  private triggerDownload(url: string, filename: string) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    const now = new Date().toISOString();
    this.lastExported = now;
    localStorage.setItem(LAST_EXPORT_KEY, now);
    this.successMessage = `Downloaded ${filename} successfully.`;
    setTimeout(() => {
      if (this.successMessage?.includes(filename)) this.successMessage = null;
    }, 5000);
  }

  private async exportDataset(dataset = 'all') {
    this.downloadingDataset = dataset;
    this.error = null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const filename =
        dataset === 'all'
          ? `healthz-takeout-${today}.json`
          : `healthz-${dataset}-${today}.json`;
      this.triggerDownload(
        takeoutApi.downloadUrl(dataset === 'all' ? undefined : dataset),
        filename,
      );
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : 'Download failed. Please try again.';
    } finally {
      this.downloadingDataset = null;
    }
  }

  private formatTimestamp(iso: string | null) {
    if (!iso) return 'Never exported';
    try {
      const date = new Date(iso);
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return iso;
    }
  }

  render() {
    const counts = this.takeout?.counts;
    const totalRecords = counts
      ? counts.bodyMeasurements +
        counts.bloodPressureReadings +
        counts.sleepRecords +
        counts.papRecords +
        counts.healthcareEvents +
        counts.healthcareTags
      : 0;

    return html`
      <main class="config-page">
        <section class="page-heading">
          <div>
            <span class="eyebrow">Settings</span>
            <h1>Configuration</h1>
            <p>Application settings and complete personal data takeout.</p>
          </div>
          <span class="section-index">07</span>
        </section>

        <section class="summary" aria-label="Configuration summary">
          <div>
            <span class="eyebrow">Total records</span>
            <strong>${this.loading ? '…' : totalRecords}</strong>
            <span>Across all personal health categories</span>
          </div>
          <div>
            <span class="eyebrow">Datasets</span>
            <strong>6</strong>
            <span>Weight, BP, Sleep, PAP, Journal, Tags</span>
          </div>
          <div>
            <span class="eyebrow">Last takeout</span>
            <strong>${this.lastExported ? 'Exported' : 'None'}</strong>
            <span>${this.formatTimestamp(this.lastExported)}</span>
          </div>
        </section>

        ${
          this.error
            ? html`<div class="error-banner" role="alert">
                <strong>Something needs attention.</strong
                ><span>${this.error}</span>
                <button
                  type="button"
                  @click=${() => (this.error = null)}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>`
            : nothing
        }
        ${
          this.successMessage
            ? html`<div class="success-banner" role="status">
                <strong>Export ready.</strong
                ><span>${this.successMessage}</span>
                <button
                  type="button"
                  @click=${() => (this.successMessage = null)}
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>`
            : nothing
        }

        <section class="takeout-container">
          <div class="takeout-hero-card">
            <div class="takeout-hero-body">
              <span class="eyebrow">Complete export</span>
              <h2>Data takeout</h2>
              <p>
                Download a complete archive of your Healthz records in open,
                structured JSON format. The bundle includes all body
                measurements, blood pressure readings, sleep history with
                detailed sessions, PAP therapy entries, and your healthcare
                journal with associated tags.
              </p>
              <div class="takeout-hero-meta">
                <span>Version 1 format</span>
                <span>•</span>
                <span>Standard UTF-8 JSON</span>
                <span>•</span>
                <span>${totalRecords} records total</span>
              </div>
            </div>
            <div class="takeout-hero-action">
              <button
                class="primary-button takeout-all-button"
                type="button"
                ?disabled=${this.downloadingDataset !== null || this.loading}
                @click=${() => this.exportDataset('all')}
              >
                ${this.downloadingDataset === 'all' ? 'Preparing export…' : 'Download all data (JSON)'}
              </button>
            </div>
          </div>

          <div class="card-heading takeout-section-heading">
            <div>
              <span class="eyebrow">Modular exports</span>
              <h2>Individual datasets</h2>
              <p>
                Export specific health categories separately as individual JSON
                files.
              </p>
            </div>
          </div>

          <div class="takeout-grid">
            <article class="takeout-card">
              <div class="takeout-card-header">
                <h3>Body weight</h3>
                <span class="takeout-count"
                  >${counts?.bodyMeasurements ?? 0} entries</span
                >
              </div>
              <p>
                Daily weight measurements in kilograms with timestamps and
                optional notes.
              </p>
              <button
                class="secondary-button takeout-btn"
                type="button"
                ?disabled=${this.downloadingDataset !== null}
                @click=${() => this.exportDataset('body-measurements')}
              >
                ${this.downloadingDataset === 'body-measurements' ? 'Downloading…' : 'Download JSON'}
              </button>
            </article>

            <article class="takeout-card">
              <div class="takeout-card-header">
                <h3>Blood pressure</h3>
                <span class="takeout-count"
                  >${counts?.bloodPressureReadings ?? 0} readings</span
                >
              </div>
              <p>
                Systolic, diastolic, and pulse rate readings with precise
                measurement timestamps.
              </p>
              <button
                class="secondary-button takeout-btn"
                type="button"
                ?disabled=${this.downloadingDataset !== null}
                @click=${() => this.exportDataset('blood-pressure')}
              >
                ${this.downloadingDataset === 'blood-pressure' ? 'Downloading…' : 'Download JSON'}
              </button>
            </article>

            <article class="takeout-card">
              <div class="takeout-card-header">
                <h3>Sleep records</h3>
                <span class="takeout-count"
                  >${counts?.sleepRecords ?? 0} records ·
                  ${counts?.sleepSessions ?? 0} sessions</span
                >
              </div>
              <p>
                Daily sleep totals, scores, stage breakdowns, and all nested
                individual sleep sessions.
              </p>
              <button
                class="secondary-button takeout-btn"
                type="button"
                ?disabled=${this.downloadingDataset !== null}
                @click=${() => this.exportDataset('sleep')}
              >
                ${this.downloadingDataset === 'sleep' ? 'Downloading…' : 'Download JSON'}
              </button>
            </article>

            <article class="takeout-card">
              <div class="takeout-card-header">
                <h3>PAP therapy</h3>
                <span class="takeout-count"
                  >${counts?.papRecords ?? 0} records</span
                >
              </div>
              <p>
                Therapy dates, aligned health dates, usage duration, AHI
                events/hour, and mask scores.
              </p>
              <button
                class="secondary-button takeout-btn"
                type="button"
                ?disabled=${this.downloadingDataset !== null}
                @click=${() => this.exportDataset('pap')}
              >
                ${this.downloadingDataset === 'pap' ? 'Downloading…' : 'Download JSON'}
              </button>
            </article>

            <article class="takeout-card">
              <div class="takeout-card-header">
                <h3>Healthcare journal</h3>
                <span class="takeout-count"
                  >${counts?.healthcareEvents ?? 0} events</span
                >
              </div>
              <p>
                Appointments, procedures, clinical encounters, providers,
                facilities, and tags.
              </p>
              <button
                class="secondary-button takeout-btn"
                type="button"
                ?disabled=${this.downloadingDataset !== null}
                @click=${() => this.exportDataset('journal-events')}
              >
                ${this.downloadingDataset === 'journal-events' ? 'Downloading…' : 'Download JSON'}
              </button>
            </article>

            <article class="takeout-card">
              <div class="takeout-card-header">
                <h3>Healthcare tags</h3>
                <span class="takeout-count"
                  >${counts?.healthcareTags ?? 0} tags</span
                >
              </div>
              <p>
                Taxonomy tags used across healthcare events along with
                normalized lookup keys.
              </p>
              <button
                class="secondary-button takeout-btn"
                type="button"
                ?disabled=${this.downloadingDataset !== null}
                @click=${() => this.exportDataset('journal-tags')}
              >
                ${this.downloadingDataset === 'journal-tags' ? 'Downloading…' : 'Download JSON'}
              </button>
            </article>
          </div>

          <details class="takeout-disclosure">
            <summary>Format & privacy specifications</summary>
            <div class="takeout-disclosure-content">
              <p>
                All data is exported as human-readable, formatted JSON. Dates
                are formatted as ISO 8601 strings (e.g.,
                <code>YYYY-MM-DD</code> or
                <code>YYYY-MM-DDTHH:mm:ss.sssZ</code>).
              </p>
              <p>
                Your export is generated directly from your local Healthz
                instance database. No third-party servers or external cloud
                providers receive or process your exported files.
              </p>
            </div>
          </details>
        </section>
      </main>
    `;
  }
}

customElements.define('config-page', ConfigPage);
