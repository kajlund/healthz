import {
  Chart,
  registerables,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { LitElement, html } from 'lit';

Chart.register(...registerables);

export class ReportChart extends LitElement {
  static properties = {
    data: { attribute: false },
    options: { attribute: false },
    label: {},
  };
  declare data: ChartData<'line', Array<number | null>>;
  declare options: ChartOptions<'line'>;
  declare label: string;
  private chart?: Chart<'line', Array<number | null>>;
  protected createRenderRoot() {
    return this;
  }
  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('data') || changed.has('options')) this.draw();
  }
  disconnectedCallback() {
    this.destroyChart();
    super.disconnectedCallback();
  }
  private destroyChart() {
    this.chart?.destroy();
    this.chart = undefined;
  }
  private draw() {
    const canvas = this.querySelector('canvas');
    if (!canvas || !this.data) return;
    this.destroyChart();
    this.chart = new Chart(canvas, {
      type: 'line',
      data: this.data,
      options: this.options,
    });
  }
  render() {
    return html`<canvas role="img" aria-label=${this.label}></canvas>`;
  }
}
customElements.define('report-chart', ReportChart);
