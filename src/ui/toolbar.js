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
    this.exportPngBtn = document.getElementById('exportPngBtn');
    this.linkTypesToggle = document.getElementById('linkTypesToggle');
    this.linkTypesDropdown = document.getElementById('linkTypesDropdown');
    this.newTreeBtn = document.getElementById('newTreeBtn');
    this.newTreePopover = document.getElementById('newTreePopover');
    this.newTreeNameInput = document.getElementById('newTreeNameInput');
    this.newTreeConfirmBtn = document.getElementById('newTreeConfirmBtn');
    this.clearProjectBtn = document.getElementById('clearProjectBtn');
    
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

    // Export JSON button
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => {
        this.handlers.onExport?.();
      });
    }

    // Export PNG button
    if (this.exportPngBtn) {
      this.exportPngBtn.addEventListener('click', () => {
        this.handlers.onExportPng?.();
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
      if (this.newTreePopover &&
          !this.newTreePopover.contains(e.target) &&
          e.target !== this.newTreeBtn) {
        this.newTreePopover.classList.remove('open');
      }
    });

    // New Tree button
    if (this.newTreeBtn) {
      this.newTreeBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.newTreePopover.classList.toggle('open');
        if (this.newTreePopover.classList.contains('open')) {
          this.newTreeNameInput.focus();
        }
      });
    }

    // Confirm new tree (button or Enter)
    const confirmNewTree = () => {
      const name = this.newTreeNameInput?.value.trim();
      if (name) {
        this.handlers.onNewTree?.(name);
        this.newTreeNameInput.value = '';
        this.newTreePopover.classList.remove('open');
      }
    };
    this.newTreeConfirmBtn?.addEventListener('click', confirmNewTree);
    this.newTreeNameInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmNewTree();
      else if (e.key === 'Escape') {
        this.newTreeNameInput.value = '';
        this.newTreePopover.classList.remove('open');
      }
    });

    // Clear / new project
    if (this.clearProjectBtn) {
      this.clearProjectBtn.addEventListener('click', () => {
        if (confirm('Clear all data and start a new project?\nThis cannot be undone.')) {
          this.handlers.onClearAll?.();
        }
      });
    }
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
      if (this.exportPngBtn) this.exportPngBtn.disabled = true;
      return;
    }

    this.treeSelect.disabled = false;
    this.fitBtn.disabled = false;
    this.exportBtn.disabled = false;
    if (this.exportPngBtn) this.exportPngBtn.disabled = false;

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
