import { LitElement, html, nothing as litNothing } from 'lit';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import {
  reportsApi,
  type MonthlyReport,
  type ReportMetric,
  type YearReportResponse,
} from './api.js';
import {
  formatChartTick,
  formatReportValue,
  localizedMonth,
  metricDetail,
  stageCoverageDetail,
  type ReportFormat,
} from './report-format.js';
import {
  choiceFor,
  metricDataset,
  metricsFor,
  monthlyChartData,
  reportChoices,
  validMetricKey,
  yearSeriesData,
} from './report-chart-data.js';
import './report-chart.js';

type View = 'monthly' | 'year';
type Display = 'chart' | 'table';
const nothing: unknown = litNothing;
const latestRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return {
    from: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    to: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
};
const params = () =>
  new URLSearchParams(window.location.hash.split('?')[1] ?? '');
const validMonth = (value: string | null, fallback: string) =>
  value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;

export class ReportsPage extends LitElement {
  static properties = {
    view: {},
    from: { state: true },
    to: { state: true },
    years: { state: true },
    selectedMetric: { state: true },
    display: { state: true },
    sleepMetric: { state: true },
    papMetric: { state: true },
    showPulse: { state: true },
    months: { state: true },
    comparison: { state: true },
    loading: { state: true },
    error: { state: true },
  };
  declare view: View;
  declare private from: string;
  declare private to: string;
  declare private years: string;
  declare private selectedMetric: string;
  declare private display: Display;
  declare private sleepMetric: string;
  declare private papMetric: string;
  declare private showPulse: boolean;
  declare private months: MonthlyReport[];
  declare private comparison: YearReportResponse | null;
  declare private loading: boolean;
  declare private error: string | null;
  private loadedRange: string | null = null;
  private loadedYears: string | null = null;

  constructor() {
    super();
    const range = latestRange();
    this.view = 'monthly';
    this.from = range.from;
    this.to = range.to;
    this.years = String(new Date().getFullYear());
    this.selectedMetric = 'weight';
    this.display = 'chart';
    this.sleepMetric = 'sleep-total';
    this.papMetric = 'pap-usage';
    this.showPulse = false;
    this.months = [];
    this.comparison = null;
    this.loading = false;
    this.error = null;
  }
  protected createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.onHash);
    void this.syncAndLoad();
  }
  disconnectedCallback() {
    window.removeEventListener('hashchange', this.onHash);
    super.disconnectedCallback();
  }
  private onHash = () => {
    void this.syncAndLoad();
  };
  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('view') && changed.get('view') !== undefined)
      void this.syncAndLoad();
  }

  private parseYears(input: string): number[] {
    const raw = input
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!raw.length || raw.some((v) => !/^\d{4}$/.test(v)))
      throw new Error(
        'Enter calendar years as four digits, separated by commas.',
      );
    const years = [...new Set(raw.map(Number))].sort((a, b) => a - b);
    if (years.length > 4) throw new Error('Choose between one and four years.');
    return years;
  }

  private readUrl() {
    const hash = window.location.hash;
    const path = hash.split('?')[0];
    if (path === '#/reports/year-comparison') this.view = 'year';
    else if (path === '#/reports/monthly') this.view = 'monthly';

    const p = params();
    const range = latestRange();
    this.display = p.get('display') === 'table' ? 'table' : 'chart';
    if (this.view === 'monthly') {
      this.from = validMonth(p.get('from'), range.from);
      this.to = validMonth(p.get('to'), range.to);
      this.sleepMetric = validMetricKey(p.get('sleepMetric'), 'sleep-');
      this.papMetric = validMetricKey(p.get('papMetric'), 'pap-');
      this.showPulse = p.get('pulse') === 'true';
    } else {
      if (p.has('years')) this.years = p.get('years')!;
      this.selectedMetric = validMetricKey(p.get('metric'));
    }
  }

  private async syncAndLoad(force = false) {
    this.readUrl();
    if (this.view === 'monthly') {
      const rangeKey = `${this.from}/${this.to}`;
      if (force || this.loadedRange !== rangeKey || !this.months.length) {
        await this.load();
      }
    } else {
      let yearsKey: string;
      try {
        yearsKey = this.parseYears(this.years).join(',');
      } catch {
        await this.load();
        return;
      }
      if (force || this.loadedYears !== yearsKey || !this.comparison) {
        await this.load();
      }
    }
  }

  private async load() {
    this.loading = true;
    this.error = null;
    try {
      if (this.view === 'monthly') {
        this.months = (await reportsApi.monthly(this.from, this.to)).months;
        this.loadedRange = `${this.from}/${this.to}`;
      } else {
        const years = this.parseYears(this.years);
        this.comparison = await reportsApi.yearOverYear(years);
        this.loadedYears = years.join(',');
      }
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Unable to load report.';
    } finally {
      this.loading = false;
    }
  }

  private navigate(values: Record<string, string>) {
    const p = params();
    Object.entries(values).forEach(([key, value]) => p.set(key, value));
    const next = `${this.view === 'monthly' ? '#/reports/monthly' : '#/reports/year-comparison'}?${p}`;
    if (window.location.hash === next) {
      void this.syncAndLoad(true);
    } else {
      window.location.hash = next;
    }
  }

  private apply(event: SubmitEvent) {
    event.preventDefault();
    this.navigate(
      this.view === 'monthly'
        ? { from: this.from, to: this.to }
        : { years: this.years, metric: this.selectedMetric },
    );
  }
  private metric(metric: ReportMetric, format: ReportFormat) {
    return html`<span class="report-value"
        >${formatReportValue(metric.value, format)}</span
      ><small class=${`source-badge source-${metric.source}`}
        >${metricDetail(metric)}</small
      >`;
  }
  private section(
    title: string,
    columns: Array<{
      label: string;
      format: ReportFormat;
      get: (r: MonthlyReport) => ReportMetric | null;
    }>,
  ) {
    return html`<section class="report-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Monthly report</span>
          <h2>${title}</h2>
        </div>
      </div>
      ${title === 'Sleep' ? html`<p class="report-coverage-help">Times awake counts awakenings; Total time awake is a duration. Each metric shows its own source and sample count. Daily stage averages can use different sets of days. Entered monthly averages replace all four Sleep durations together; daily records remain unchanged.</p>` : nothing}
      <div>
        <div class="report-row report-head">
          <span>Month</span>${columns.map((c) => html`<span>${c.label}</span>`)}
        </div>
        ${this.months.map(
          (r) =>
            html`<div class="report-row">
                <strong>${localizedMonth(r.month)}</strong>${columns.map(
                  (c) => {
                    const value = c.get(r);
                    return html`<div data-label=${c.label}>
                      ${value ? this.metric(value, c.format) : html`<span class="report-value">—</span><small class="source-badge source-none">No data</small>`}
                    </div>`;
                  },
                )}
              </div>
              ${title === 'Sleep' ? html`<p class="report-coverage">${localizedMonth(r.month)} · ${stageCoverageDetail(r.sleep.stageCoverage)}. Coverage counts daily records only.</p>` : nothing}`,
        )}
      </div>
    </section>`;
  }
  private options(
    format: ReportFormat,
    sets: Array<Array<ReportMetric | null>>,
    extra?: (dataset: number, index: number) => string[],
  ): ChartOptions<'line'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? false
        : { duration: 350 },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: false,
          ticks: { callback: (v) => formatChartTick(Number(v), format) },
        },
      },
      plugins: {
        legend: { labels: { usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'line'>) =>
              `${item.dataset.label}: ${formatReportValue(Number(item.raw), format)}`,
            afterLabel: (item) => {
              const metric = sets[item.datasetIndex]?.[item.dataIndex];
              return metric
                ? [
                    metricDetail(metric),
                    ...(extra?.(item.datasetIndex, item.dataIndex) ?? []),
                  ]
                : [];
            },
          },
        },
      },
    };
  }
  private card(
    title: string,
    description: string,
    data: ChartData<'line', Array<number | null>>,
    options: ChartOptions<'line'>,
    controls = nothing,
  ) {
    const shownDescription = title.startsWith('PAP')
      ? `${description} Daily PAP records are aligned by Health date.`
      : description;
    return html`<section class="report-card chart-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Trend chart</span>
          <h2>${title}</h2>
          <p>${shownDescription}</p>
        </div>
        ${controls}
      </div>
      ${
        data.datasets.some((d) => d.data.some((v) => v !== null))
          ? html`<div class="chart-shell">
              <report-chart
                .data=${data}
                .options=${options}
                label=${`${title}. ${shownDescription}`}
              ></report-chart>
            </div>`
          : html`<div class="state empty">
              <strong>No data for this range</strong>
              <p>
                Choose another metric or date range, or switch to the exact
                table.
              </p>
            </div>`
      }
    </section>`;
  }
  private selector(
    param: 'sleepMetric' | 'papMetric',
    current: string,
    prefix: string,
  ) {
    return html`<label class="chart-selector"
      >Metric<select
        .value=${current}
        @change=${(e: Event) => this.navigate({ [param]: (e.target as HTMLSelectElement).value })}
      >
        ${reportChoices.filter((c) => c.key.startsWith(prefix)).map((c) => html`<option value=${c.key}>${c.label}</option>`)}
      </select></label
    >`;
  }
  private monthlyCharts() {
    const weight = this.months.map((r) => r.weight?.average ?? null);
    const sys = this.months.map(
      (r) => r.bloodPressure?.averageSystolic ?? null,
    );
    const dia = this.months.map(
      (r) => r.bloodPressure?.averageDiastolic ?? null,
    );
    const pulse = this.months.map((r) => r.bloodPressure?.averagePulse ?? null);
    const bpSets = this.showPulse ? [sys, dia, pulse] : [sys, dia];
    const sleep = choiceFor(this.sleepMetric, 'sleep-total');
    const sleepSet = metricsFor(this.months, sleep);
    const pap = choiceFor(this.papMetric, 'pap-usage');
    const papSet = metricsFor(this.months, pap);
    return html`${this.card(
      'Weight',
      'Average monthly weight in kilograms. Missing months remain gaps.',
      monthlyChartData(this.months, [metricDataset('Average weight', weight)]),
      this.options('weight', [weight], (_, i) => {
        const r = this.months[i]?.weight;
        return r
          ? [
              `Minimum: ${formatReportValue(r.minimum.value, 'weight')}`,
              `Maximum: ${formatReportValue(r.maximum.value, 'weight')}`,
              `First: ${formatReportValue(r.first.value, 'weight')}`,
              `Last: ${formatReportValue(r.last.value, 'weight')}`,
              `Measurements: ${r.measurementCount}`,
            ]
          : [];
      }),
    )}${this.card(
      'Blood pressure',
      'Average monthly systolic and diastolic pressure; pulse is optional.',
      monthlyChartData(this.months, [
        metricDataset('Systolic', sys),
        metricDataset('Diastolic', dia, {
          borderDash: [7, 4],
          pointStyle: 'rect',
        }),
        ...(this.showPulse
          ? [
              metricDataset('Pulse', pulse, {
                borderDash: [2, 3],
                pointStyle: 'triangle',
              }),
            ]
          : []),
      ]),
      this.options('pressure', bpSets, (_, i) => {
        const r = this.months[i]?.bloodPressure;
        return r
          ? [
              `Readings: ${r.readingCount}`,
              `Measured days: ${r.measuredDayCount}`,
            ]
          : [];
      }),
      html`<label class="toggle-control"
        ><input
          type="checkbox"
          .checked=${this.showPulse}
          @change=${(e: Event) => this.navigate({ pulse: String((e.target as HTMLInputElement).checked) })}
        /><span>Show pulse</span></label
      >`,
    )}${this.card(
      `Sleep — ${sleep.label}`,
      `Monthly averages. Times awake counts awakenings; Total time awake is a duration. Entered monthly averages replace all four Sleep durations together. Otherwise, known daily values are averaged independently. Score and awake metrics remain daily-only.`,
      monthlyChartData(this.months, [metricDataset(sleep.label, sleepSet)]),
      this.options(sleep.format, [sleepSet], (_, i) => [
        stageCoverageDetail(this.months[i]!.sleep.stageCoverage),
      ]),
      this.selector('sleepMetric', this.sleepMetric, 'sleep-'),
    )}${this.coverageNotes(this.months)}${this.card(`PAP — ${pap.label}`, `Average monthly ${pap.label.toLowerCase()}, calculated from detailed daily records.`, monthlyChartData(this.months, [metricDataset(pap.label, papSet)]), this.options(pap.format, [papSet]), this.selector('papMetric', this.papMetric, 'pap-'))}`;
  }
  private coverageNotes(months: MonthlyReport[]) {
    return html`<details class="report-coverage-notes">
      <summary>Sleep stage coverage by month</summary>
      <p>
        Counts describe daily records. Missing stage values are excluded
        independently; see Tables for each metric's sample count.
      </p>
      <ul>
        ${months.map((month) => html`<li>${localizedMonth(month.month)} · ${stageCoverageDetail(month.sleep.stageCoverage)}</li>`)}
      </ul>
    </details>`;
  }
  private monthlyTables() {
    const mapped = (prefix: string) =>
      reportChoices
        .filter((c) => c.key.startsWith(prefix))
        .map(({ label, format, get }) => ({ label, format, get }));
    return html`${this.section('Weight', [
      {
        label: 'Average',
        format: 'weight',
        get: (r) => r.weight?.average ?? null,
      },
      {
        label: 'Minimum',
        format: 'weight',
        get: (r) => r.weight?.minimum ?? null,
      },
      {
        label: 'Maximum',
        format: 'weight',
        get: (r) => r.weight?.maximum ?? null,
      },
      { label: 'First', format: 'weight', get: (r) => r.weight?.first ?? null },
      { label: 'Last', format: 'weight', get: (r) => r.weight?.last ?? null },
    ])}${this.section('Blood pressure', [
      {
        label: 'Systolic',
        format: 'pressure',
        get: (r) => r.bloodPressure?.averageSystolic ?? null,
      },
      {
        label: 'Diastolic',
        format: 'pressure',
        get: (r) => r.bloodPressure?.averageDiastolic ?? null,
      },
      {
        label: 'Pulse',
        format: 'pulse',
        get: (r) => r.bloodPressure?.averagePulse ?? null,
      },
    ])}${this.section('Sleep', mapped('sleep-'))}${this.section('PAP', mapped('pap-'))}`;
  }
  private comparisonView() {
    if (!this.comparison) return nothing;
    const choice = choiceFor(this.selectedMetric);
    if (this.display === 'chart') {
      const sets = this.comparison.series
        .filter(({ months }) =>
          metricsFor(months, choice).some((m) => m?.value != null),
        )
        .map(({ months }) => metricsFor(months, choice));
      return this.card(
        choice.label,
        `January through December comparison for ${this.comparison.meta.years.join(', ')}.`,
        yearSeriesData(this.comparison, choice),
        this.options(choice.format, sets, (dataset, index) =>
          this.selectedMetric.startsWith('sleep-')
            ? [
                stageCoverageDetail(
                  this.comparison!.series.filter(({ months }) =>
                    metricsFor(months, choice).some((m) => m?.value != null),
                  )[dataset]!.months[index]!.sleep.stageCoverage,
                ),
              ]
            : [],
        ),
      );
    }
    return html`<section class="report-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Year comparison</span>
          <h2>${choice.label}</h2>
        </div>
      </div>
      <div>
        <div class="comparison-row comparison-head">
          <span>Month</span
          >${this.comparison.meta.years.map((y) => html`<span>${y}</span>`)}
        </div>
        ${Array.from(
          { length: 12 },
          (_, i) =>
            html`<div class="comparison-row">
              <strong
                >${new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2024, i, 1, 12))}</strong
              >${this.comparison!.series.map(({ year, months }) => {
                const value = choice.get(months[i]!);
                return html`<div data-year=${year}>
                  ${value ? this.metric(value, choice.format) : html`<span>—</span><small>No data</small>`}${this.selectedMetric.startsWith('sleep-') ? html`<small class="comparison-coverage">${stageCoverageDetail(months[i]!.sleep.stageCoverage)}</small>` : nothing}
                </div>`;
              })}
            </div>`,
        )}
      </div>
    </section>`;
  }
  private switcher() {
    return html`<fieldset class="view-switch">
      <legend>Display</legend>
      ${(['chart', 'table'] as Display[]).map((value) => html`<button type="button" class=${this.display === value ? 'active' : ''} aria-pressed=${this.display === value} @click=${() => this.navigate({ display: value })}>${value === 'chart' ? 'Charts' : 'Tables'}</button>`)}
    </fieldset>`;
  }
  render() {
    return html`<main>
      <section class="page-heading">
        <div>
          <span class="eyebrow">Reporting</span>
          <h1>
            ${this.view === 'monthly' ? 'Monthly overview' : 'Year comparison'}
          </h1>
          <p>
            Reports use daily records, or entered monthly averages for Sleep
            durations. Missing measurements remain empty.
          </p>
        </div>
        <span class="section-index">06</span>
      </section>
      <section class="report-controls">
        <form @submit=${this.apply}>
          ${
            this.view === 'monthly'
              ? html`<label
                    >From month<input
                      type="month"
                      required
                      .value=${this.from}
                      @input=${(e: InputEvent) => (this.from = (e.target as HTMLInputElement).value)} /></label
                  ><label
                    >To month<input
                      type="month"
                      required
                      .value=${this.to}
                      @input=${(e: InputEvent) => (this.to = (e.target as HTMLInputElement).value)}
                  /></label>`
              : html`<label
                    >Years <span>1–4, comma-separated</span
                    ><input
                      required
                      .value=${this.years}
                      @input=${(e: InputEvent) => (this.years = (e.target as HTMLInputElement).value)}
                      @change=${(e: Event) => this.navigate({ years: (e.target as HTMLInputElement).value, metric: this.selectedMetric })} /></label
                  ><label
                    >Metric<select
                      .value=${this.selectedMetric}
                      @change=${(e: Event) => this.navigate({ metric: (e.target as HTMLSelectElement).value, years: this.years })}
                    >
                      ${reportChoices.map((c) => html`<option value=${c.key} ?selected=${this.selectedMetric === c.key}>${c.label}</option>`)}
                    </select></label
                  >`
          }<button class="primary-button" ?disabled=${this.loading}>
            ${this.loading ? 'Loading…' : 'Apply'}
          </button>
        </form>
        ${this.switcher()}
      </section>
      ${this.error ? html`<div class="error-banner" role="alert"><strong>Unable to load report.</strong><span>${this.error}</span></div>` : nothing}${this.loading ? html`<div class="state"><span class="spinner"></span>Loading report…</div>` : this.view === 'monthly' ? (this.display === 'chart' ? this.monthlyCharts() : this.monthlyTables()) : this.comparisonView()}
    </main>`;
  }
}
customElements.define('reports-page', ReportsPage);
