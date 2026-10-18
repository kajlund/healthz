import { LitElement, html, nothing } from 'lit';
import { sleepMetricSettingsApi } from './api.js';
import {
  sleepSources,
  type SleepMetricDefinition,
} from '../../api/src/sleep-records/metrics.js';

export class SleepSettings extends LitElement {
  static properties = {
    definitions: { state: true },
    error: { state: true },
    saving: { state: true },
    loading: { state: true },
    notice: { state: true },
  };
  declare private definitions: SleepMetricDefinition[];
  declare private error: string;
  declare private saving: boolean;
  declare private loading: boolean;
  declare private notice: string;
  constructor() {
    super();
    this.definitions = [];
    this.error = '';
    this.saving = false;
    this.loading = true;
    this.notice = '';
  }
  protected createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }
  private async load() {
    try {
      this.definitions = await sleepMetricSettingsApi.list();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }
  private async save(d: SleepMetricDefinition) {
    this.saving = true;
    this.error = '';
    this.notice = '';
    try {
      await sleepMetricSettingsApi.save(d);
      await this.load();
      this.notice = `${d.name} settings saved.`;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.saving = false;
    }
  }
  render() {
    return html`<main class="sleep-settings-page">
      <section class="page-heading">
        <div>
          <span class="eyebrow">Configuration</span>
          <h1>Sleep measurements</h1>
          <p>Choose the optional measurements shown when entering sleep.</p>
        </div>
      </section>
      <section
        class="sleep-settings-panel"
        aria-label="Measurement preferences"
      >
        <div class="sleep-settings-intro">
          <h2>Entry preferences</h2>
          <p>
            Checked measurements appear in entry forms. Lower order numbers
            appear first. Leave all sources unchecked to use a measurement with
            every source.
          </p>
          <p>
            Hiding a measurement keeps its recorded values. Sleep scores remain
            separate by device in reports.
          </p>
        </div>
        ${this.error ? html`<div class="error-banner" role="alert">${this.error}</div>` : nothing}
        <p class="sleep-settings-notice" role="status">${this.notice}</p>
        ${this.loading ? html`<div class="state" role="status">Loading measurement preferences…</div>` : nothing}
        <div class="sleep-settings-columns" aria-hidden="true">
          <span>Show in entry</span><span>Order</span
          ><span>Applicable sources</span><span></span>
        </div>
        ${this.definitions.map(
        (d) =>
          html`<form
            class="sleep-setting-row"
            aria-label=${d.name + ' preferences'}
            @submit=${(e: Event) => {
              e.preventDefault();
              void this.save(d);
            }}
          >
            <label class="sleep-setting-checkbox sleep-setting-name"
              ><input
                type="checkbox"
                .checked=${d.enabled}
                @change=${(e: Event) => {
                  d.enabled = (e.target as HTMLInputElement).checked;
                }}
              /><span class="field-label"
                >${d.name} <small>(${d.unit})</small></span
              ></label
            >
            <label class="sleep-setting-order"
              ><span class="field-label">Order</span
              ><input
                type="number"
                min="0"
                max="1000"
                required
                .value=${String(d.displayOrder)}
                @input=${(e: Event) => {
                  d.displayOrder = Number((e.target as HTMLInputElement).value);
                }}
            /></label>
            <fieldset class="sleep-setting-sources">
              <legend>Applicable sources</legend>
              ${sleepSources.map(
                (s) =>
                  html`<label class="sleep-setting-checkbox"
                    ><input
                      type="checkbox"
                      .checked=${d.sources.includes(s.key)}
                      @change=${(e: Event) => {
                        d.sources = (e.target as HTMLInputElement).checked
                          ? [...d.sources, s.key]
                          : d.sources.filter((k) => k !== s.key);
                      }}
                    />${s.label}</label
                  >`,
              )}
            </fieldset>
            <button
              class="secondary-button sleep-setting-save"
              aria-label=${'Save ' + d.name}
              ?disabled=${this.saving}
            >
              Save
            </button>
          </form>`,
      )}
      </section>
    </main>`;
  }
}
customElements.define('sleep-settings', SleepSettings);
