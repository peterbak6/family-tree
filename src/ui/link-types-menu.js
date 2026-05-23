import { escapeHtml, sanitizeLinkTypeName } from '../utils/helpers.js';
import { ensureTreeLinkTypes } from '../core/data-model.js';
import { linkTypeColorPalette } from '../utils/constants.js';

/**
 * Link types menu component
 */
export class LinkTypesMenu {
  constructor(state, onUpdate) {
    this.state = state;
    this.onUpdate = onUpdate;
    this.menuElement = document.getElementById('linkTypesMenu');
  }

  render() {
    if (!this.menuElement) return;

    const tree = this.state.getCurrentTree();
    if (!tree) return;

    const linkTypes = ensureTreeLinkTypes(tree);
    const selectedLink = this.state.selectedLinkIndex != null ? tree.links[this.state.selectedLinkIndex] : null;

    // Build menu HTML
    let html = '';

    // Link type filters
    html += linkTypes.map(t => `
      <label class="link-type-row">
        <input type="checkbox" 
               data-link-filter="${t.type}" 
               ${this.state.visibleLinkTypes.has(t.type) ? 'checked' : ''} />
        <span class="type-swatch" style="background:${t.color}"></span>
        <span>${escapeHtml(t.label)}</span>
      </label>
    `).join('');

    // Selected link tools
    if (selectedLink) {
      html += `
        <div class="selected-link-tools">
          <div class="hint">Selected link type</div>
          <select id="selectedLinkTypeSelect">
            ${linkTypes.map(t => `
              <option value="${t.type}" ${selectedLink.type === t.type ? 'selected' : ''}>
                ${escapeHtml(t.label)}
              </option>
            `).join('')}
          </select>
          <button id="removeSelectedLinkBtn" class="mini-btn danger-mini" type="button">
            Remove selected link
          </button>
        </div>
      `;
    }

    // Add new link type
    html += `
      <div class="add-type-row">
        <input id="newLinkTypeInput" placeholder="new link type" />
        <button id="addLinkTypeBtn" class="mini-btn" type="button">Add</button>
      </div>
    `;

    this.menuElement.innerHTML = html;

    // Attach event listeners
    this.attachEventListeners(tree, linkTypes);
  }

  attachEventListeners(tree, linkTypes) {
    // Link type visibility toggles
    this.menuElement.querySelectorAll('[data-link-filter]').forEach(cb => {
      cb.addEventListener('change', () => {
        const type = cb.getAttribute('data-link-filter');
        this.state.toggleLinkTypeVisibility(type, cb.checked);
        this.onUpdate();
      });
    });

    // Selected link type change
    const selectedLinkSelect = document.getElementById('selectedLinkTypeSelect');
    if (selectedLinkSelect && this.state.selectedLinkIndex != null) {
      selectedLinkSelect.addEventListener('change', () => {
        tree.links[this.state.selectedLinkIndex].type = selectedLinkSelect.value;
        ensureTreeLinkTypes(tree);
        this.state.scheduleAutosave();
        this.onUpdate();
      });
    }

    // Remove selected link
    const removeBtn = document.getElementById('removeSelectedLinkBtn');
    if (removeBtn && this.state.selectedLinkIndex != null) {
      removeBtn.addEventListener('click', () => {
        tree.links.splice(this.state.selectedLinkIndex, 1);
        this.state.clearSelection();
        this.state.scheduleAutosave();
        this.onUpdate();
      });
    }

    // Add new link type
    const addBtn = document.getElementById('addLinkTypeBtn');
    const addInput = document.getElementById('newLinkTypeInput');
    
    if (addBtn && addInput) {
      const addHandler = () => {
        const value = addInput.value.trim();
        if (value) {
          this.addNewLinkType(value);
          addInput.value = '';
        }
      };

      addBtn.addEventListener('click', addHandler);
      addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addHandler();
      });
    }
  }

  addNewLinkType(rawName) {
    const tree = this.state.getCurrentTree();
    if (!tree) return;

    const type = sanitizeLinkTypeName(rawName);
    if (!type) return;

    ensureTreeLinkTypes(tree);

    if (!tree['link-types'].some(t => t.type === type)) {
      const color = linkTypeColorPalette[tree['link-types'].length % linkTypeColorPalette.length];
      tree['link-types'].push({ type, label: rawName.trim(), color });
    }

    this.state.visibleLinkTypes.add(type);
    this.state.scheduleAutosave();
    this.render();
    this.onUpdate();
  }
}
