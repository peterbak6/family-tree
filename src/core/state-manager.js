import { createEmptyProject, normalizeProject } from './data-model.js';

const STORAGE_KEY = 'family-tree-state';
const AUTOSAVE_DELAY = 1000; // 1 second debounce

/**
 * Application state manager with localStorage persistence
 */
class StateManager {
  constructor() {
    this.project = null;
    this.currentTreeName = null;
    this.selectedNodeId = null;
    this.selectedLinkIndex = null;
    this.visibleLinkTypes = new Set(['default', 'father', 'mother', 'married']);
    this.lastLayout = null;
    this.listeners = new Map();
    this.autosaveTimer = null;
    
    // Load from localStorage on init
    this.loadFromStorage();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    return () => {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    };
  }

  /**
   * Emit state change event
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  /**
   * Get current tree
   */
  getCurrentTree() {
    return this.project?.[this.currentTreeName] || null;
  }

  /**
   * Set current tree
   */
  setCurrentTreeName(treeName) {
    this.currentTreeName = treeName;
    this.selectedNodeId = null;
    this.selectedLinkIndex = null;
    this.emit('tree-changed', { treeName });
    this.scheduleAutosave();
  }

  /**
   * Load or create project
   */
  loadProject(project) {
    this.project = normalizeProject(project);
    
    // Select first tree if no tree is selected
    if (!this.currentTreeName || !this.project[this.currentTreeName]) {
      const treeNames = Object.keys(this.project);
      this.currentTreeName = treeNames[0] || null;
    }
    
    // Ensure link types are visible
    const tree = this.getCurrentTree();
    if (tree && tree['link-types']) {
      tree['link-types'].forEach(lt => {
        this.visibleLinkTypes.add(lt.type);
      });
    }
    
    this.emit('project-loaded', { project: this.project });
    this.scheduleAutosave();
  }

  /**
   * Select a node
   */
  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.selectedLinkIndex = null;
    this.emit('node-selected', { nodeId });
  }

  /**
   * Select a link
   */
  selectLink(linkIndex) {
    this.selectedLinkIndex = linkIndex;
    this.selectedNodeId = null;
    this.emit('link-selected', { linkIndex });
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedNodeId = null;
    this.selectedLinkIndex = null;
    this.emit('selection-cleared', {});
  }

  /**
   * Toggle link type visibility
   */
  toggleLinkTypeVisibility(type, visible) {
    if (visible) {
      this.visibleLinkTypes.add(type);
    } else {
      this.visibleLinkTypes.delete(type);
    }
    this.emit('link-types-changed', { visibleTypes: this.visibleLinkTypes });
  }

  /**
   * Update node
   */
  updateNode(nodeId, updates) {
    const tree = this.getCurrentTree();
    if (!tree) return;
    
    const node = tree.nodes.find(n => n.id === nodeId);
    if (node) {
      Object.assign(node, updates);
      this.emit('tree-modified', { tree });
      this.scheduleAutosave();
    }
  }

  /**
   * Save to localStorage with debouncing
   */
  scheduleAutosave() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    
    this.autosaveTimer = setTimeout(() => {
      this.saveToStorage();
    }, AUTOSAVE_DELAY);
  }

  /**
   * Save state to localStorage
   */
  saveToStorage() {
    try {
      const state = {
        project: this.project,
        currentTreeName: this.currentTreeName,
        visibleLinkTypes: Array.from(this.visibleLinkTypes),
        savedAt: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.emit('saved', { savedAt: state.savedAt });
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      this.emit('save-error', { error });
    }
  }

  /**
   * Load state from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        const state = JSON.parse(stored);
        
        if (state.project) {
          this.project = normalizeProject(state.project);
          this.currentTreeName = state.currentTreeName;
          
          if (state.visibleLinkTypes) {
            this.visibleLinkTypes = new Set(state.visibleLinkTypes);
          }
          
          this.emit('loaded-from-storage', { savedAt: state.savedAt });
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    
    // If no stored state or error, create empty project
    this.project = createEmptyProject();
    this.currentTreeName = 'default-tree';
    return false;
  }

  /**
   * Clear localStorage
   */
  clearStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.emit('storage-cleared', {});
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Export project as JSON
   */
  exportProject() {
    return JSON.stringify(this.project, null, 2);
  }

  /**
   * Get state snapshot
   */
  getSnapshot() {
    return {
      project: this.project,
      currentTreeName: this.currentTreeName,
      selectedNodeId: this.selectedNodeId,
      selectedLinkIndex: this.selectedLinkIndex,
      visibleLinkTypes: this.visibleLinkTypes,
      lastLayout: this.lastLayout
    };
  }
}

// Create singleton instance
export const state = new StateManager();
