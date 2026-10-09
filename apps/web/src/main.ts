import { LitElement, html, nothing } from 'lit';

import {
  bodyMeasurementsApi,
  type BodyMeasurement,
  type BodyMeasurementInput,
} from './api.js';
import {
  emptyDateFilter,
  hasActiveFilter,
  parseDateFilter,
  updateDateFilterHash,
  type DateFilter,
} from './measurement-filter-helpers.js';
import './blood-pressure-page.js';
import './sleep-page.js';
import './pap-page.js';
import './reports-page.js';
import './dashboard-page.js';
import './journal-page.js';
import './config-page.js';
import './styles.css';

type Route =
  | 'dashboard'
  | 'weight'
  | 'blood-pressure'
  | 'sleep'
  | 'pap'
  | 'report-monthly'
  | 'report-year'
  | 'journal'
  | 'config';
type Category = 'dashboard' | 'measurements' | 'reports' | 'journal' | 'config';

const navigation: Array<{
  category: Category;
  label: string;
  items: Array<{ route: Route; label: string; hash: string }>;
}> = [
  {
    category: 'dashboard',
    label: 'Dashboard',
    items: [{ route: 'dashboard', label: 'Dashboard', hash: '/' }],
  },
  {
    category: 'measurements',
    label: 'Measurements',
    items: [
      { route: 'weight', label: 'Weight', hash: '#/measurements/weight' },
      {
        route: 'blood-pressure',
        label: 'Blood pressure',
        hash: '#/measurements/blood-pressure',
      },
      { route: 'sleep', label: 'Sleep', hash: '#/measurements/sleep' },
      { route: 'pap', label: 'PAP', hash: '#/measurements/pap' },
    ],
  },
  {
    category: 'reports',
    label: 'Reports',
    items: [
      {
        route: 'report-monthly',
        label: 'Monthly overview',
        hash: '#/reports/monthly',
      },
      {
        route: 'report-year',
        label: 'Year comparison',
        hash: '#/reports/year-comparison',
      },
    ],
  },
  {
    category: 'journal',
    label: 'Journal',
    items: [{ route: 'journal', label: 'Journal', hash: '#/journal' }],
  },
  {
    category: 'config',
    label: 'Config',
    items: [{ route: 'config', label: 'Data takeout', hash: '#/config' }],
  },
];
export const routeFromHash = (): Route => {
  const path = window.location.hash.split('?')[0];
  if (!path) return 'dashboard';
  if (path.startsWith('#/measurements/sleep/')) return 'sleep';
  if (path === '#config' || path === '#/config') return 'config';
  return (
    navigation.flatMap(({ items }) => items).find(({ hash }) => hash === path)
      ?.route ?? 'weight'
  );
};

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
    route: { state: true },
    mobileMenuOpen: { state: true },
    filter: { state: true },
    draftFilter: { state: true },
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
  declare private route: Route;
  declare private mobileMenuOpen: boolean;
  declare private filter: DateFilter;
  declare private draftFilter: DateFilter;

  constructor() {
    super();
    this.measurements = [];
    this.loading = true;
    this.saving = false;
    this.deletingId = null;
    this.error = null;
    this.editingId = null;
    this.measuredOn = today();
    this.weightKg = '';
    this.notes = '';
    this.route = routeFromHash();
    this.mobileMenuOpen = false;
    this.filter = parseDateFilter();
    this.draftFilter = { ...this.filter };
  }

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.handleRouteChange);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('pointerdown', this.handleOutsidePointer);
    void this.loadMeasurements();
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.handleRouteChange);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('pointerdown', this.handleOutsidePointer);
    super.disconnectedCallback();
  }

  private handleRouteChange = () => {
    this.route = routeFromHash();
    this.mobileMenuOpen = false;
    this.filter = parseDateFilter();
    this.draftFilter = { ...this.filter };
    if (this.route === 'weight') void this.loadMeasurements();
  };
  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.mobileMenuOpen) {
      this.mobileMenuOpen = false;
      this.querySelector<HTMLButtonElement>('.menu-toggle')?.focus();
    }
  };
  private handleOutsidePointer = (event: PointerEvent) => {
    if (
      this.mobileMenuOpen &&
      !this.querySelector('.navigation-shell')?.contains(event.target as Node)
    )
      this.mobileMenuOpen = false;
  };
  private get category(): Category {
    return this.route === 'dashboard'
      ? 'dashboard'
      : this.route === 'journal'
        ? 'journal'
        : this.route === 'config'
          ? 'config'
          : this.route.startsWith('report-')
            ? 'reports'
            : 'measurements';
  }
  private destination(route: Route) {
    return navigation
      .flatMap(({ items }) => items)
      .find((item) => item.route === route)!;
  }
  private categoryDestination(category: Category) {
    if (category === this.category) return this.destination(this.route).hash;
    return navigation.find((item) => item.category === category)!.items[0]!
      .hash;
  }
  private renderNavigationItems(category: Category, mobile = false) {
    return navigation
      .find((item) => item.category === category)!
      .items.map(
        (item) =>
          html`<a
            href=${item.hash}
            aria-current=${this.route === item.route ? 'page' : nothing}
            class=${this.route === item.route ? 'active' : ''}
            @click=${() => {
              if (mobile) this.mobileMenuOpen = false;
            }}
            >${item.label}</a
          >`,
      );
  }

  private async loadMeasurements() {
    this.loading = true;
    this.error = null;
    try {
      this.measurements = await bodyMeasurementsApi.list(this.filter);
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Unable to load measurements.';
    } finally {
      this.loading = false;
    }
  }

  private applyFilter(event: SubmitEvent) {
    event.preventDefault();
    const hash = updateDateFilterHash(
      '#/measurements/weight',
      this.draftFilter,
    );
    if (window.location.hash === hash) {
      this.filter = { ...this.draftFilter };
      void this.loadMeasurements();
    } else {
      window.location.hash = hash;
    }
  }

  private clearFilter() {
    this.draftFilter = emptyDateFilter();
    const hash = updateDateFilterHash(
      '#/measurements/weight',
      emptyDateFilter(),
    );
    if (window.location.hash === hash) {
      this.filter = emptyDateFilter();
      void this.loadMeasurements();
    } else {
      window.location.hash = hash;
    }
  }

  private resetForm() {
    this.editingId = null;
    this.measuredOn = today();
    this.weightKg = '';
    this.notes = '';
  }

  private edit(measurement: BodyMeasurement) {
    this.editingId = measurement.id;
    this.measuredOn = measurement.measuredOn;
    this.weightKg = String(measurement.weightKg);
    this.notes = measurement.notes ?? '';
    this.error = null;
    document
      .querySelector('.entry-card')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      this.error =
        error instanceof Error ? error.message : 'Unable to save measurement.';
    } finally {
      this.saving = false;
    }
  }

  private async deleteMeasurement(measurement: BodyMeasurement) {
    if (
      !window.confirm(
        `Delete the measurement from ${this.formatDate(measurement.measuredOn)}?`,
      )
    )
      return;
    this.deletingId = measurement.id;
    this.error = null;
    try {
      await bodyMeasurementsApi.delete(measurement.id);
      this.measurements = this.measurements.filter(
        ({ id }) => id !== measurement.id,
      );
      if (this.editingId === measurement.id) this.resetForm();
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : 'Unable to delete measurement.';
    } finally {
      this.deletingId = null;
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

  private renderSummary() {
    const latest = this.measurements[0];
    const previous = this.measurements[1];
    const change =
      latest && previous ? latest.weightKg - previous.weightKg : null;

    return html`
      <section class="summary" aria-label="Weight summary">
        <div>
          <span class="eyebrow">Latest weight</span>
          <strong
            >${latest ? latest.weightKg.toFixed(2) : '—'}<small>
              kg</small
            ></strong
          >
          <span
            >${latest ? this.formatDate(latest.measuredOn) : 'No measurements yet'}</span
          >
        </div>
        <div>
          <span class="eyebrow">Change</span>
          <strong class=${change !== null && change > 0 ? 'change-up' : ''}>
            ${change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(2)}`}<small
              >${change === null ? '' : ' kg'}</small
            >
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
    if (this.loading) {
      return html`<div class="state" aria-live="polite">
        <span class="spinner"></span>Loading measurements…
      </div>`;
    }
    if (this.measurements.length === 0) {
      const active = hasActiveFilter(this.filter);
      return html`
        <div class="state empty">
          <span class="empty-mark">01</span>
          <strong
            >${active ? 'No measurements match these dates' : 'Start your weight history'}</strong
          >
          <p>
            ${active ? 'Clear or change the date filters to see other measurements.' : 'Add your first measurement using the form.'}
          </p>
        </div>
      `;
    }

    return html`
      <div class="measurement-list">
        <div class="list-head" aria-hidden="true">
          <span>Date</span><span>Weight</span><span>Notes</span
          ><span>Actions</span>
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
                <span class=${item.notes ? '' : 'muted'}
                  >${item.notes || 'No notes'}</span
                >
              </div>
              <div class="actions">
                <button
                  class="text-button"
                  type="button"
                  @click=${() => this.edit(item)}
                >
                  Edit
                </button>
                <button
                  class="text-button danger"
                  type="button"
                  ?disabled=${this.deletingId === item.id}
                  @click=${() => this.deleteMeasurement(item)}
                >
                  ${this.deletingId === item.id ? 'Deleting…' : 'Delete'}
                </button>
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
        <a class="brand" href="/" aria-label="Healthz home"
          ><img
            src="/healthz-icon.svg"
            width="34"
            height="34"
            alt=""
          />Healthz</a
        >
        <div class="navigation-shell">
          <button
            class="menu-toggle"
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded=${this.mobileMenuOpen ? 'true' : 'false'}
            aria-controls="mobile-navigation"
            @click=${() => (this.mobileMenuOpen = !this.mobileMenuOpen)}
          >
            <span></span><span></span><span></span>
          </button>
          <nav class="primary-nav" aria-label="Health categories">
            ${navigation.map((item) => html`<a href=${this.categoryDestination(item.category)} aria-current=${this.category === item.category ? 'page' : nothing} class=${this.category === item.category ? 'active' : ''}>${item.label}</a>`)}
          </nav>
          <nav
            id="mobile-navigation"
            class=${`mobile-nav ${this.mobileMenuOpen ? 'open' : ''}`}
            aria-label="Health navigation"
          >
            ${navigation.map((group) => html`<section><strong>${group.label}</strong>${this.renderNavigationItems(group.category, true)}</section>`)}
          </nav>
        </div>
        <div class="header-meta">
          <span class="status-dot"></span>Personal health log
        </div>
      </header>

      ${this.category === 'measurements' ? html`<nav class="secondary-nav" aria-label="Measurements">${this.renderNavigationItems('measurements')}</nav>` : nothing}
      ${this.category === 'reports' ? html`<nav class="secondary-nav" aria-label="Reports">${this.renderNavigationItems('reports')}</nav>` : nothing}
      ${this.category === 'config' ? html`<nav class="secondary-nav" aria-label="Config">${this.renderNavigationItems('config')}</nav>` : nothing}
      ${
        this.route === 'dashboard'
          ? html`<dashboard-page></dashboard-page>`
          : this.route === 'journal'
            ? html`<journal-page></journal-page>`
            : this.route === 'config'
              ? html`<config-page></config-page>`
              : this.route === 'weight'
                ? html`<main>
                    <section class="page-heading">
                      <div>
                        <span class="eyebrow">Measurements</span>
                        <h1>Body weight</h1>
                        <p>
                          Keep a clear, consistent record of your weight over
                          time.
                        </p>
                      </div>
                      <span class="section-index">01</span>
                    </section>

                    ${this.renderSummary()}
                    ${
                      this.error
                        ? html`<div class="error-banner" role="alert">
                            <strong>Something needs attention.</strong
                            ><span>${this.error}</span
                            ><button
                              type="button"
                              @click=${() => (this.error = null)}
                              aria-label="Dismiss error"
                            >
                              ×
                            </button>
                          </div>`
                        : nothing
                    }

                    <div class="workspace">
                      <section class="list-card">
                        <div class="card-heading">
                          <div>
                            <span class="eyebrow">History</span>
                            <h2>Your measurements</h2>
                          </div>
                          <button
                            class="refresh-button"
                            type="button"
                            @click=${this.loadMeasurements}
                            ?disabled=${this.loading}
                          >
                            Refresh
                          </button>
                        </div>
                        ${this.renderFilters()} ${this.renderList()}
                      </section>

                      <aside class="entry-card daily-entry-card">
                        <span class="eyebrow"
                          >${this.editingId ? 'Edit entry' : 'New entry'}</span
                        >
                        <h2>
                          ${this.editingId ? 'Update measurement' : 'Add measurement'}
                        </h2>
                        <p>
                          ${this.editingId ? 'Change the details for this entry.' : 'Record one measurement per day.'}
                        </p>

                        <form class="compact-entry-form" @submit=${this.submit}>
                          <label
                            >Date
                            <span class="required-marker" aria-hidden="true"
                              >*</span
                            ><input
                              type="date"
                              required
                              .value=${this.measuredOn}
                              @input=${(event: InputEvent) => (this.measuredOn = (event.target as HTMLInputElement).value)}
                          /></label>
                          <label
                            >Weight
                            <span
                              >kg ·
                              <span class="required-marker" aria-hidden="true"
                                >*</span
                              ></span
                            >
                            <div class="weight-input">
                              <input
                                type="number"
                                required
                                min="0.01"
                                max="9999.99"
                                step="0.01"
                                inputmode="decimal"
                                placeholder="82.45"
                                .value=${this.weightKg}
                                @input=${(event: InputEvent) => (this.weightKg = (event.target as HTMLInputElement).value)}
                              /><span>kg</span>
                            </div></label
                          >
                          <label
                            >Notes<textarea
                              maxlength="2000"
                              rows="2"
                              placeholder="Morning, before breakfast…"
                              .value=${this.notes}
                              @input=${(event: InputEvent) => (this.notes = (event.target as HTMLTextAreaElement).value)}
                            ></textarea>
                          </label>
                          <button
                            class="primary-button"
                            type="submit"
                            ?disabled=${this.saving}
                          >
                            ${this.saving ? 'Saving…' : this.editingId ? 'Save changes' : 'Add measurement'}
                          </button>
                          ${this.editingId ? html`<button class="cancel-button" type="button" @click=${this.resetForm}>Cancel editing</button>` : nothing}
                        </form>
                      </aside>
                    </div>
                  </main>`
                : this.route === 'blood-pressure'
                  ? html`<blood-pressure-page></blood-pressure-page>`
                  : this.route === 'sleep'
                    ? html`<sleep-page></sleep-page>`
                    : this.route === 'pap'
                      ? html`<pap-page></pap-page>`
                      : html`<reports-page
                          .view=${this.route === 'report-year' ? 'year' : 'monthly'}
                        ></reports-page>`
      }

      <footer><span>Healthz</span><span>Your data, clearly kept.</span></footer>
    `;
  }
}

customElements.define('healthz-app', HealthzApp);
