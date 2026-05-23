import { ensureTreeLinkTypes } from '../core/data-model.js';
import { escapeHtml } from '../utils/helpers.js';

/**
 * Floating context menu that appears at the cursor when a link is clicked,
 * letting the user change the link type or remove the link without having
 * to reach up to the toolbar.
 */
export class LinkContextMenu {
  constructor(state, onUpdate) {
    this.state = state;
    this.onUpdate = onUpdate;
    this._outsideHandler = null;
    this._keyHandler = null;

    this.el = document.createElement('div');
    this.el.id = 'linkContextMenu';
    this.el.className = 'link-ctx-menu';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  show(clientX, clientY) {
    const tree = this.state.getCurrentTree();
    if (!tree || this.state.selectedLinkIndex == null) return;
    const link = tree.links[this.state.selectedLinkIndex];
    if (!link) return;

    const linkTypes = ensureTreeLinkTypes(tree);

    this.el.innerHTML = `
      <div class="link-ctx-title">Link type</div>
      <div class="link-ctx-types">
        ${linkTypes.map(t => `
          <button class="link-ctx-type-btn ${link.type === t.type ? 'active' : ''}"
                  data-type="${t.type}"
                  style="--swatch:${t.color}">
            ${escapeHtml(t.label)}
          </button>
        `).join('')}
      </div>
      <button class="link-ctx-remove" id="linkCtxRemoveBtn">Remove link</button>
    `;

    // Position: avoid going off-screen
    this.el.style.display = 'block';
    const rect = this.el.getBoundingClientRect();
    const left = Math.min(clientX + 8, window.innerWidth  - rect.width  - 8);
    const top  = Math.min(clientY + 8, window.innerHeight - rect.height - 8);
    this.el.style.left = `${Math.max(8, left)}px`;
    this.el.style.top  = `${Math.max(8, top)}px`;

    // Type buttons
    this.el.querySelectorAll('.link-ctx-type-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        tree.links[this.state.selectedLinkIndex].type = btn.dataset.type;
        ensureTreeLinkTypes(tree);
        this.state.scheduleAutosave();
        this.onUpdate();
        this.hide();
      });
    });

    // Remove button
    document.getElementById('linkCtxRemoveBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      tree.links.splice(this.state.selectedLinkIndex, 1);
      this.state.clearSelection();
      this.state.scheduleAutosave();
      this.onUpdate();
      this.hide();
    });

    // Close on outside click or Escape (deferred one tick so the triggering
    // click doesn't immediately close the menu)
    this._outsideHandler = e => { if (!this.el.contains(e.target)) this.hide(); };
    this._keyHandler     = e => { if (e.key === 'Escape') this.hide(); };
    setTimeout(() => {
      document.addEventListener('click',   this._outsideHandler);
      document.addEventListener('keydown', this._keyHandler);
    }, 0);
  }

  hide() {
    this.el.style.display = 'none';
    if (this._outsideHandler) { document.removeEventListener('click',   this._outsideHandler); this._outsideHandler = null; }
    if (this._keyHandler)     { document.removeEventListener('keydown', this._keyHandler);     this._keyHandler     = null; }
  }
}
