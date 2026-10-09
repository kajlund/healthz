import { LitElement, html, nothing } from 'lit';
import {
  healthcareEventsApi,
  healthcareTagsApi,
  type HealthcareEvent,
  type HealthcareEventInput,
  type HealthcareTag,
} from './api.js';
import {
  emptyJournalFilters,
  formatCalendarDate,
  localToday,
  parseJournalFilters,
  serializeJournalFilters,
  type JournalFilters,
} from './journal-helpers.js';

export class JournalPage extends LitElement {
  static properties = {
    events: { state: true },
    tags: { state: true },
    total: { state: true },
    latestEventDate: { state: true },
    loading: { state: true },
    saving: { state: true },
    error: { state: true },
    editingId: { state: true },
    eventDate: { state: true },
    eventTime: { state: true },
    title: { state: true },
    description: { state: true },
    provider: { state: true },
    organization: { state: true },
    locationValue: { state: true },
    selectedTagIds: { state: true },
    filters: { state: true },
    draftFilters: { state: true },
    deletingId: { state: true },
    newTagName: { state: true },
    tagSaving: { state: true },
    tagError: { state: true },
    tagDropdownOpen: { state: true },
    tagFilterSearch: { state: true },
  };
  declare private events: HealthcareEvent[];
  declare private tags: HealthcareTag[];
  declare private total: number;
  declare private latestEventDate: string | null;
  declare private loading: boolean;
  declare private saving: boolean;
  declare private error: string | null;
  declare private editingId: string | null;
  declare private eventDate: string;
  declare private eventTime: string;
  declare title: string;
  declare private description: string;
  declare private provider: string;
  declare private organization: string;
  declare private locationValue: string;
  declare private selectedTagIds: string[];
  declare private filters: JournalFilters;
  declare private draftFilters: JournalFilters;
  declare private deletingId: string | null;
  declare private newTagName: string;
  declare private tagSaving: boolean;
  declare private tagError: string | null;
  declare private tagDropdownOpen: boolean;
  declare private tagFilterSearch: string;
  private controller?: AbortController;
  constructor() {
    super();
    this.events = [];
    this.tags = [];
    this.total = 0;
    this.latestEventDate = null;
    this.loading = true;
    this.saving = false;
    this.error = null;
    this.editingId = null;
    this.eventDate = localToday();
    this.eventTime = '';
    this.title = '';
    this.description = '';
    this.provider = '';
    this.organization = '';
    this.locationValue = '';
    this.selectedTagIds = [];
    this.filters = parseJournalFilters();
    this.draftFilters = { ...this.filters, tagIds: [...this.filters.tagIds] };
    this.deletingId = null;
    this.newTagName = '';
    this.tagSaving = false;
    this.tagError = null;
    this.tagDropdownOpen = false;
    this.tagFilterSearch = '';
  }
  protected createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    addEventListener('hashchange', this.onLocationChange);
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    void Promise.all([this.loadTags(), this.loadEvents()]);
  }
  disconnectedCallback() {
    removeEventListener('hashchange', this.onLocationChange);
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeyDown);
    this.controller?.abort();
    super.disconnectedCallback();
  }
  private onLocationChange = () => {
    this.filters = parseJournalFilters();
    this.draftFilters = { ...this.filters, tagIds: [...this.filters.tagIds] };
    void this.loadEvents();
  };
  private onDocumentClick = (event: MouseEvent) => {
    if (
      this.tagDropdownOpen &&
      !event
        .composedPath()
        .some(
          (el) =>
            el instanceof HTMLElement &&
            el.classList?.contains('tag-select-dropdown'),
        )
    ) {
      this.tagDropdownOpen = false;
    }
  };
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.tagDropdownOpen) {
      this.tagDropdownOpen = false;
    }
  };
  private toggleTagDropdown = (e: MouseEvent) => {
    e.stopPropagation();
    this.tagDropdownOpen = !this.tagDropdownOpen;
    if (this.tagDropdownOpen) this.tagFilterSearch = '';
  };
  private clearDraftTags = () => {
    this.draftFilters = { ...this.draftFilters, tagIds: [] };
  };
  private selectAllDraftTags = () => {
    this.draftFilters = {
      ...this.draftFilters,
      tagIds: this.tags.map((t) => t.id),
    };
  };
  private async loadTags() {
    try {
      this.tags = await healthcareTagsApi.list();
    } catch (error) {
      this.tagError =
        error instanceof Error ? error.message : 'Unable to load tags.';
    }
  }
  private async loadEvents() {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.loading = true;
    this.error = null;
    try {
      const response = await healthcareEventsApi.list(
        serializeJournalFilters(this.filters),
        controller.signal,
      );
      this.events = response.items;
      this.total = response.total;
      this.latestEventDate = response.latestEventDate;
    } catch (error) {
      if (!controller.signal.aborted)
        this.error =
          error instanceof Error ? error.message : 'Unable to load journal.';
    } finally {
      if (this.controller === controller) this.loading = false;
    }
  }
  private updateUrl(filters: JournalFilters) {
    const query = serializeJournalFilters(filters);
    const next = `#/journal${query ? `?${query}` : ''}`;
    if (location.hash === next) {
      this.filters = filters;
      this.draftFilters = { ...filters, tagIds: [...filters.tagIds] };
      void this.loadEvents();
    } else location.hash = next;
  }
  private applyFilters(event: SubmitEvent) {
    event.preventDefault();
    this.tagDropdownOpen = false;
    this.updateUrl({
      ...this.draftFilters,
      search: this.draftFilters.search.trim(),
      page: 1,
    });
  }
  private clearFilters() {
    this.tagDropdownOpen = false;
    this.tagFilterSearch = '';
    this.updateUrl(emptyJournalFilters());
  }
  private setDraftTag(id: string, checked: boolean) {
    this.draftFilters = {
      ...this.draftFilters,
      tagIds: checked
        ? [...this.draftFilters.tagIds, id]
        : this.draftFilters.tagIds.filter((value) => value !== id),
    };
  }
  private setEventTag(id: string, checked: boolean) {
    this.selectedTagIds = checked
      ? [...this.selectedTagIds, id]
      : this.selectedTagIds.filter((value) => value !== id);
  }
  private resetForm() {
    this.editingId = null;
    this.eventDate = localToday();
    this.eventTime = '';
    this.title = '';
    this.description = '';
    this.provider = '';
    this.organization = '';
    this.locationValue = '';
    this.selectedTagIds = [];
  }
  private edit(item: HealthcareEvent) {
    this.editingId = item.id;
    this.eventDate = item.eventDate;
    this.eventTime = item.eventTime ?? '';
    this.title = item.title;
    this.description = item.description ?? '';
    this.provider = item.provider ?? '';
    this.organization = item.organization ?? '';
    this.locationValue = item.location ?? '';
    this.selectedTagIds = item.tags.map(({ id }) => id);
    this.error = null;
    this.querySelector('.journal-entry-card')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }
  private async submit(event: SubmitEvent) {
    event.preventDefault();
    this.saving = true;
    this.error = null;
    const input: HealthcareEventInput = {
      eventDate: this.eventDate,
      eventTime: this.eventTime || null,
      title: this.title,
      description: this.description.trim() || null,
      provider: this.provider.trim() || null,
      organization: this.organization.trim() || null,
      location: this.locationValue.trim() || null,
      tagIds: this.selectedTagIds,
    };
    try {
      if (this.editingId)
        await healthcareEventsApi.update(this.editingId, input);
      else await healthcareEventsApi.create(input);
      this.resetForm();
      await Promise.all([this.loadEvents(), this.loadTags()]);
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Unable to save event.';
    } finally {
      this.saving = false;
    }
  }
  private async deleteEvent(item: HealthcareEvent) {
    if (!confirm(`Delete “${item.title}”?`)) return;
    this.deletingId = item.id;
    this.error = null;
    try {
      await healthcareEventsApi.delete(item.id);
      if (this.editingId === item.id) this.resetForm();
      await Promise.all([this.loadEvents(), this.loadTags()]);
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Unable to delete event.';
    } finally {
      this.deletingId = null;
    }
  }
  private async createTag(event: SubmitEvent) {
    event.preventDefault();
    this.tagSaving = true;
    this.tagError = null;
    try {
      const tag = await healthcareTagsApi.create(this.newTagName);
      this.newTagName = '';
      await this.loadTags();
      this.selectedTagIds = [...this.selectedTagIds, tag.id];
    } catch (error) {
      this.tagError =
        error instanceof Error ? error.message : 'Unable to create tag.';
    } finally {
      this.tagSaving = false;
    }
  }
  private async renameTag(tag: HealthcareTag) {
    const name = prompt('Rename healthcare tag', tag.name);
    if (name === null || name.trim() === tag.name) return;
    this.tagError = null;
    try {
      await healthcareTagsApi.update(tag.id, name);
      await this.loadTags();
    } catch (error) {
      this.tagError =
        error instanceof Error ? error.message : 'Unable to rename tag.';
    }
  }
  private async deleteTag(tag: HealthcareTag) {
    if (!confirm(`Delete the unused tag “${tag.name}”?`)) return;
    this.tagError = null;
    try {
      await healthcareTagsApi.delete(tag.id);
      this.selectedTagIds = this.selectedTagIds.filter((id) => id !== tag.id);
      this.draftFilters = {
        ...this.draftFilters,
        tagIds: this.draftFilters.tagIds.filter((id) => id !== tag.id),
      };
      await this.loadTags();
    } catch (error) {
      this.tagError =
        error instanceof Error ? error.message : 'Unable to delete tag.';
    }
  }
  private tagChoices(
    selected: string[],
    change: (id: string, checked: boolean) => void,
    label: string,
  ) {
    return html`
      <fieldset class="tag-choices">
        <legend class="field-label">${label}</legend>
        ${
          this.tags.length
            ? html`
                <div>
                  ${this.tags.map(
                    (tag) => html`
                      <label>
                        <input
                          type="checkbox"
                          .checked=${selected.includes(tag.id)}
                          @change=${(e: Event) => change(tag.id, (e.target as HTMLInputElement).checked)}
                        />
                        <span>${tag.name}</span>
                      </label>
                    `,
                  )}
                </div>
              `
            : html`<p>No tags yet. You can create one below.</p>`
        }
      </fieldset>
    `;
  }
  private renderTagFilterDropdown() {
    const selectedCount = this.draftFilters.tagIds.length;
    const query = this.tagFilterSearch.trim().toLowerCase();
    const filteredTags = query
      ? this.tags.filter((t) => t.name.toLowerCase().includes(query))
      : this.tags;

    return html`
      <div class="tag-filter-control">
        <span class="field-label">Tags</span>
        <div class="tag-select-dropdown ${this.tagDropdownOpen ? 'open' : ''}">
          <button
            type="button"
            class="tag-select-trigger ${selectedCount > 0 ? 'has-selection' : ''}"
            aria-expanded=${this.tagDropdownOpen}
            aria-haspopup="listbox"
            @click=${this.toggleTagDropdown}
          >
            <span class="tag-select-summary">
              ${
                selectedCount === 0
                  ? html`<span class="tag-select-placeholder">All tags</span>`
                  : html`
                      <span class="tag-select-badge"
                        >${selectedCount} selected</span
                      >
                      <span class="tag-select-match-indicator"
                        >${this.draftFilters.tagMatch === 'all' ? '(all match)' : '(any match)'}</span
                      >
                    `
              }
            </span>
            <span class="tag-select-icons">
              ${
                selectedCount > 0
                  ? html`
                      <span
                        class="tag-select-clear-btn"
                        role="button"
                        tabindex="0"
                        title="Clear tags"
                        aria-label="Clear tag selection"
                        @click=${(e: MouseEvent) => {
                          e.stopPropagation();
                          this.clearDraftTags();
                        }}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            e.preventDefault();
                            this.clearDraftTags();
                          }
                        }}
                        >×</span
                      >
                    `
                  : nothing
              }
              <span class="tag-select-chevron">▾</span>
            </span>
          </button>

          ${
            this.tagDropdownOpen
              ? html`
                  <div
                    class="tag-dropdown-menu"
                    role="listbox"
                    aria-multiselectable="true"
                    @click=${(e: MouseEvent) => e.stopPropagation()}
                  >
                    <div class="tag-dropdown-header">
                      <span class="tag-dropdown-count">
                        ${selectedCount ? `${selectedCount} of ${this.tags.length} selected` : `${this.tags.length} tags available`}
                      </span>
                      <div class="tag-dropdown-quick-actions">
                        ${
                          selectedCount > 0
                            ? html`<button
                                type="button"
                                class="tag-quick-btn"
                                @click=${this.clearDraftTags}
                              >
                                Clear
                              </button>`
                            : nothing
                        }
                        ${
                          selectedCount < this.tags.length &&
                          this.tags.length > 0
                            ? html`<button
                                type="button"
                                class="tag-quick-btn"
                                @click=${this.selectAllDraftTags}
                              >
                                Select all
                              </button>`
                            : nothing
                        }
                      </div>
                    </div>

                    ${
                      this.tags.length > 5
                        ? html`
                            <div class="tag-dropdown-search">
                              <input
                                type="search"
                                placeholder="Search tags…"
                                .value=${this.tagFilterSearch}
                                @input=${(e: Event) => (this.tagFilterSearch = (e.target as HTMLInputElement).value)}
                              />
                            </div>
                          `
                        : nothing
                    }

                    <div class="tag-dropdown-list">
                      ${
                        !this.tags.length
                          ? html`<div class="tag-dropdown-empty">
                              No tags available yet.
                            </div>`
                          : !filteredTags.length
                            ? html`<div class="tag-dropdown-empty">
                                No matching tags
                              </div>`
                            : filteredTags.map((tag) => {
                                const isChecked =
                                  this.draftFilters.tagIds.includes(tag.id);
                                return html`
                                  <label
                                    class="tag-dropdown-item ${isChecked ? 'selected' : ''}"
                                  >
                                    <input
                                      type="checkbox"
                                      .checked=${isChecked}
                                      @change=${(e: Event) => this.setDraftTag(tag.id, (e.target as HTMLInputElement).checked)}
                                    />
                                    <span class="tag-dropdown-tag-name"
                                      >${tag.name}</span
                                    >
                                    <span class="tag-dropdown-tag-count"
                                      >${tag.usageCount}</span
                                    >
                                  </label>
                                `;
                              })
                      }
                    </div>

                    <div class="tag-dropdown-footer">
                      <span class="tag-match-label">Match:</span>
                      <div class="tag-match-options">
                        <label class="tag-match-option">
                          <input
                            type="radio"
                            name="filter-tag-match"
                            value="any"
                            .checked=${this.draftFilters.tagMatch === 'any'}
                            @change=${() => (this.draftFilters = { ...this.draftFilters, tagMatch: 'any' })}
                          />
                          <span>Any tag</span>
                        </label>
                        <label class="tag-match-option">
                          <input
                            type="radio"
                            name="filter-tag-match"
                            value="all"
                            .checked=${this.draftFilters.tagMatch === 'all'}
                            @change=${() => (this.draftFilters = { ...this.draftFilters, tagMatch: 'all' })}
                          />
                          <span>All tags</span>
                        </label>
                      </div>
                    </div>
                  </div>
                `
              : nothing
          }
        </div>
      </div>
    `;
  }
  private renderEvent(item: HealthcareEvent) {
    return html`
      <article class="journal-event">
        <div class="journal-event-date">
          <strong
            >${formatCalendarDate(item.eventDate, { day: 'numeric', month: 'short' })}
            <small
              >${formatCalendarDate(item.eventDate, { year: 'numeric' })}</small
            ></strong
          >
          <span>${item.eventTime ?? 'Time unknown'}</span>
        </div>
        <div class="journal-event-body">
          <h3>${item.title}</h3>
          ${
            item.tags.length
              ? html`<div class="tag-chips" aria-label="Tags">
                  ${item.tags.map((tag) => html`<span>${tag.name}</span>`)}
                </div>`
              : html`<span class="muted">No tags</span>`
          }
          ${
            item.description
              ? html`<details class="description-preview">
                  <summary>View description</summary>
                  <p>${item.description}</p>
                </details>`
              : nothing
          }
          <p class="journal-context">
            ${[item.provider, item.organization, item.location].filter(Boolean).join(' · ') || nothing}
          </p>
        </div>
        <div class="actions">
          <button class="text-button" @click=${() => this.edit(item)}>
            Edit
          </button>
          <button
            class="text-button danger"
            ?disabled=${this.deletingId === item.id}
            @click=${() => this.deleteEvent(item)}
          >
            ${this.deletingId === item.id ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </article>
    `;
  }
  render() {
    const pages = Math.max(1, Math.ceil(this.total / this.filters.pageSize));
    const latestDate = this.latestEventDate;
    const filtered = Boolean(
      this.filters.search ||
      this.filters.from ||
      this.filters.to ||
      this.filters.tagIds.length,
    );
    return html`
      <main class="journal">
        <section class="page-heading">
          <div>
            <span class="eyebrow">Healthcare</span>
            <h1>Journal</h1>
            <p>
              Appointments, procedures, donations and other healthcare events.
            </p>
          </div>
          <span class="section-index">06</span>
        </section>
        ${this.error ? html`<div class="error-banner" role="alert"><strong>Something needs attention.</strong><span>${this.error}</span><button @click=${() => (this.error = null)} aria-label="Dismiss error">×</button></div>` : nothing}
        <details class="journal-filters" open>
          <summary>Filter journal</summary>
          <form @submit=${this.applyFilters}>
            <label>
              <span class="field-label">Search</span>
              <input
                type="search"
                placeholder="Search events…"
                .value=${this.draftFilters.search}
                @input=${(e: Event) => (this.draftFilters = { ...this.draftFilters, search: (e.target as HTMLInputElement).value })}
              />
            </label>
            <div class="compact-form-row">
              <label>
                <span class="field-label">From</span>
                <input
                  type="date"
                  .value=${this.draftFilters.from}
                  @input=${(e: Event) => (this.draftFilters = { ...this.draftFilters, from: (e.target as HTMLInputElement).value })}
                />
              </label>
              <label>
                <span class="field-label">To</span>
                <input
                  type="date"
                  .value=${this.draftFilters.to}
                  @input=${(e: Event) => (this.draftFilters = { ...this.draftFilters, to: (e.target as HTMLInputElement).value })}
                />
              </label>
            </div>
            ${this.renderTagFilterDropdown()}
            <div class="filter-actions">
              <button class="primary-button" type="submit">
                Apply filters
              </button>
              <button
                class="cancel-button"
                type="button"
                @click=${this.clearFilters}
              >
                Clear filters
              </button>
            </div>
          </form>
        </details>
        <section class="journal-summary" aria-live="polite">
          <div>
            <span class="eyebrow">Matching events</span>
            <strong>${this.total}</strong>
          </div>
          <div>
            <span class="eyebrow">Latest matching event</span>
            <strong
              >${latestDate ? formatCalendarDate(latestDate) : '—'}</strong
            >
          </div>
        </section>
        <div class="workspace journal-workspace">
          <section class="list-card">
            <div class="card-heading">
              <div>
                <span class="eyebrow">History</span>
                <h2>Healthcare events</h2>
              </div>
              <span class="muted">Page ${this.filters.page} of ${pages}</span>
            </div>
            ${
              this.loading
                ? html`<div class="state">
                    <span class="spinner"></span>Loading journal…
                  </div>`
                : !this.events.length
                  ? html`
                      <div class="state empty">
                        <span class="empty-mark">06</span>
                        <strong
                          >${filtered ? 'No events match these filters' : 'Start your healthcare journal'}</strong
                        >
                        <p>
                          ${filtered ? 'Clear or change the filters to see other events.' : 'Add your first healthcare event using the form.'}
                        </p>
                      </div>
                    `
                  : html`<div class="journal-list">
                      ${this.events.map((item) => this.renderEvent(item))}
                    </div>`
            }
            <nav class="pagination" aria-label="Journal pages">
              <button
                ?disabled=${this.filters.page <= 1 || this.loading}
                @click=${() => this.updateUrl({ ...this.filters, page: this.filters.page - 1 })}
              >
                Newer
              </button>
              <button
                ?disabled=${this.filters.page >= pages || this.loading}
                @click=${() => this.updateUrl({ ...this.filters, page: this.filters.page + 1 })}
              >
                Older
              </button>
            </nav>
          </section>
          <aside class="entry-card daily-entry-card journal-entry-card">
            <span class="eyebrow"
              >${this.editingId ? 'Edit event' : 'New event'}</span
            >
            <h2>${this.editingId ? 'Update event' : 'Add healthcare event'}</h2>
            <form class="compact-entry-form" @submit=${this.submit}>
              <div class="compact-form-row">
                <label>
                  <span class="field-label"
                    >Date
                    <span class="required-marker" aria-hidden="true"
                      >*</span
                    ></span
                  >
                  <input
                    type="date"
                    required
                    .value=${this.eventDate}
                    @input=${(e: Event) => (this.eventDate = (e.target as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span class="field-label">Time</span>
                  <input
                    type="time"
                    .value=${this.eventTime}
                    @input=${(e: Event) => (this.eventTime = (e.target as HTMLInputElement).value)}
                  />
                </label>
              </div>
              <label>
                <span class="field-label"
                  >Title
                  <span class="required-marker" aria-hidden="true"
                    >*</span
                  ></span
                >
                <input
                  required
                  maxlength="300"
                  .value=${this.title}
                  @input=${(e: Event) => (this.title = (e.target as HTMLInputElement).value)}
                />
              </label>
              ${this.tagChoices(this.selectedTagIds, (id, checked) => this.setEventTag(id, checked), 'Tags (recommended)')}
              <label>
                <span class="field-label">Description</span>
                <textarea
                  rows="3"
                  maxlength="10000"
                  .value=${this.description}
                  @input=${(e: Event) => (this.description = (e.target as HTMLTextAreaElement).value)}
                ></textarea>
              </label>
              <label>
                <span class="field-label">Provider / person</span>
                <input
                  maxlength="300"
                  .value=${this.provider}
                  @input=${(e: Event) => (this.provider = (e.target as HTMLInputElement).value)}
                />
              </label>
              <label>
                <span class="field-label">Organization</span>
                <input
                  maxlength="300"
                  .value=${this.organization}
                  @input=${(e: Event) => (this.organization = (e.target as HTMLInputElement).value)}
                />
              </label>
              <label>
                <span class="field-label">Location</span>
                <input
                  maxlength="500"
                  .value=${this.locationValue}
                  @input=${(e: Event) => (this.locationValue = (e.target as HTMLInputElement).value)}
                />
              </label>
              <button class="primary-button" ?disabled=${this.saving}>
                ${this.saving ? 'Saving…' : this.editingId ? 'Save changes' : 'Add event'}
              </button>
              ${this.editingId ? html`<button class="cancel-button" type="button" @click=${this.resetForm}>Cancel editing</button>` : nothing}
            </form>
            <details class="tag-manager">
              <summary>Manage tags</summary>
              ${this.tagError ? html`<p class="inline-error" role="alert">${this.tagError}</p>` : nothing}
              <form @submit=${this.createTag}>
                <label>
                  <span class="field-label">New tag</span>
                  <input
                    maxlength="100"
                    required
                    .value=${this.newTagName}
                    @input=${(e: Event) => (this.newTagName = (e.target as HTMLInputElement).value)}
                  />
                </label>
                <button class="primary-button" ?disabled=${this.tagSaving}>
                  Create tag
                </button>
              </form>
              <ul>
                ${this.tags.map(
                  (tag) => html`
                    <li>
                      <span>
                        <strong>${tag.name}</strong>
                        <small
                          >${tag.usageCount}
                          ${tag.usageCount === 1 ? 'event' : 'events'}</small
                        >
                      </span>
                      <div class="actions">
                        <button
                          class="text-button"
                          @click=${() => this.renameTag(tag)}
                        >
                          Rename
                        </button>
                        <button
                          class="text-button danger"
                          ?disabled=${tag.usageCount > 0}
                          title=${tag.usageCount > 0 ? 'In-use tags cannot be deleted' : 'Delete unused tag'}
                          @click=${() => this.deleteTag(tag)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  `,
                )}
              </ul>
              <p>Tags assigned to events cannot be deleted.</p>
            </details>
          </aside>
        </div>
      </main>
    `;
  }
}
customElements.define('journal-page', JournalPage);
