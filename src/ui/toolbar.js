import { escapeHtml } from '../utils/helpers.js';

/**
 * Toolbar UI component
 */
export class Toolbar {
  constructor(state, handlers) {
    this.state = state;
    this.handlers = handlers;
    this.fileInput = document.getElementById('fileInput');
    this.treeSelect = document.getElementById('treeSelect');
    this.fitBtn = document.getElementById('fitBtn');
    this.exportBtn = document.getElementById('exportJsonBtn');
    this.linkTypesToggle = document.getElementById('linkTypesToggle');
    this.linkTypesDropdown = document.getElementById('linkTypesDropdown');
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Import button
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        this.handlers.onImport?.(e.target.files[0]);
      });
    }

    // Tree selector
    if (this.treeSelect) {
      this.treeSelect.addEventListener('change', (e) => {
        this.handlers.onTreeChange?.(e.target.value);
      });
    }

    // Fit view button
    if (this.fitBtn) {
      this.fitBtn.addEventListener('click', () => {
        this.handlers.onFitView?.();
      });
    }

    // Export button
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => {
        this.handlers.onExport?.();
      });
    }

    // Link types dropdown toggle
    if (this.linkTypesToggle) {
      this.linkTypesToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLinkTypesDropdown();
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.linkTypesDropdown && 
          !this.linkTypesDropdown.contains(e.target)) {
        this.linkTypesDropdown.classList.remove('open');
      }
    });
  }

  toggleLinkTypesDropdown() {
    if (this.linkTypesDropdown) {
      this.linkTypesDropdown.classList.toggle('open');
    }
  }

  updateTreeSelector() {
    if (!this.treeSelect || !this.state.project) return;

    const treeNames = Object.keys(this.state.project);
    
    if (treeNames.length === 0) {
      this.treeSelect.innerHTML = '<option>No tree loaded</option>';
      this.treeSelect.disabled = true;
      this.fitBtn.disabled = true;
      this.exportBtn.disabled = true;
      return;
    }

    this.treeSelect.disabled = false;
    this.fitBtn.disabled = false;
    this.exportBtn.disabled = false;

    this.treeSelect.innerHTML = treeNames.map(name => 
      `<option value="${escapeHtml(name)}" ${name === this.state.currentTreeName ? 'selected' : ''}>
        ${escapeHtml(name)}
      </option>`
    ).join('');
  }

  setStatus(text) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = text;
    }
  }
}
