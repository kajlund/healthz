import { LitElement, html } from "lit";

let nextId = 0;

/** Native popovers provide top-layer rendering, outside dismissal and one-open-at-a-time behavior. */
export class RecordActions extends LitElement {
  static properties = { label: {}, editHref: {}, busy: { type: Boolean }, open: { state: true } };
  declare label: string;
  declare editHref: string;
  declare busy: boolean;
  declare private open: boolean;
  private readonly menuId = `record-actions-${++nextId}`;
  constructor() { super(); this.label = "Record actions"; this.editHref = ""; this.busy = false; this.open = false; }
  protected createRenderRoot() { return this; }
  private get menu() { return this.querySelector<HTMLElement>('[role="menu"]')!; }
  private get trigger() { return this.querySelector<HTMLButtonElement>(".record-actions-trigger")!; }
  focusTrigger() { this.trigger.focus(); }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("resize", this.positionMenu);
    document.addEventListener("scroll", this.positionMenu, true);
  }
  disconnectedCallback() {
    window.removeEventListener("resize", this.positionMenu);
    document.removeEventListener("scroll", this.positionMenu, true);
    super.disconnectedCallback();
  }
  private closeMenu(restoreFocus: boolean) {
    this.menu.hidePopover(); this.open = false;
    if (restoreFocus) this.focusTrigger();
  }
  private positionMenu = () => {
    if (!this.open) return;
    const rect = this.trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) { this.closeMenu(false); return; }
    const menuRect = this.menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - menuRect.width, window.innerWidth - menuRect.width - 8));
    const top = rect.bottom + menuRect.height + 8 <= window.innerHeight
      ? rect.bottom + 4 : Math.max(8, rect.top - menuRect.height - 4);
    this.menu.style.left = `${left}px`; this.menu.style.top = `${top}px`;
  };
  private openMenu(last = false) {
    if (this.busy) return;
    // The DOM library predates the optional invoker argument; browsers without it ignore it.
    const menu = this.menu as HTMLElement & { showPopover(options: { source: HTMLElement }): void };
    menu.showPopover({ source: this.trigger }); this.open = true;
    this.positionMenu();
    const items = this.menu.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items[last ? items.length - 1 : 0]?.focus({ preventScroll: true });
  }
  private triggerKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); this.openMenu(event.key === "ArrowUp");
    }
  }
  private menuKey(event: KeyboardEvent) {
    const items = [...this.menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[index]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); this.closeMenu(true);
    } else if (event.key === "Tab") {
      this.closeMenu(true);
    } else if (event.key === " " && document.activeElement instanceof HTMLAnchorElement) {
      event.preventDefault(); document.activeElement.click();
    }
  }
  render() {
    return html`<button class="text-button record-actions-trigger" type="button" aria-label=${this.label}
      aria-haspopup="menu" aria-expanded=${String(this.open)} aria-controls=${this.menuId} ?disabled=${this.busy}
      @keydown=${this.triggerKey} @click=${() => this.open ? this.closeMenu(true) : this.openMenu()}>
      ${this.busy ? "Deleting…" : "Actions"}<span aria-hidden="true"> ▾</span></button>
      <div id=${this.menuId} class="record-actions-menu" popover="auto" role="menu" aria-label=${this.label}
        @toggle=${() => { this.open = this.menu.matches(":popover-open"); }} @keydown=${this.menuKey}>
        <a role="menuitem" tabindex="-1" href=${this.editHref} @click=${() => this.closeMenu(false)}>Edit</a>
        <button role="menuitem" tabindex="-1" type="button" class="danger" @click=${() => {
          this.closeMenu(true);
          this.dispatchEvent(new CustomEvent("delete-request", { bubbles: true }));
        }}>Delete</button>
      </div>`;
  }
}
customElements.define("record-actions", RecordActions);
