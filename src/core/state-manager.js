import { createEmptyProject, createStarterProject, normalizeProject } from './data-model.js';
import { deepClone } from '../utils/helpers.js';

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
    this.showCurrentTreeLinkTypes();
    this.emit('tree-changed', { treeName });
    this.scheduleAutosave();
  }

  showCurrentTreeLinkTypes() {
    this.getCurrentTree()?.['link-types']?.forEach(({ type }) => {
      this.visibleLinkTypes.add(type);
    });
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
    this.showCurrentTreeLinkTypes();
    
    this.emit('project-loaded', { project: this.project });
    this.scheduleAutosave();
  }

  addTrees(project) {
    const normalized = normalizeProject(deepClone(project));
    let added = 0;

    Object.entries(normalized).forEach(([name, tree]) => {
      if (this.project[name]) return;
      this.project[name] = tree;
      added += 1;
    });

    if (added > 0) {
      this.emit('project-loaded', { project: this.project });
      this.scheduleAutosave();
    }

    return added;
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

          const treeNames = Object.keys(this.project);
          const legacyTree = this.project['default-tree'];
          if (treeNames.length === 1 && legacyTree?.nodes.length === 0 && legacyTree.links.length === 0) {
            this.project = createStarterProject();
            this.currentTreeName = Object.keys(this.project)[0];
          }
          
          if (state.visibleLinkTypes) {
            this.visibleLinkTypes = new Set(state.visibleLinkTypes);
          }

          this.showCurrentTreeLinkTypes();
          
          this.emit('loaded-from-storage', { savedAt: state.savedAt });
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    
    // Begin with a small tree that demonstrates generations and relationships.
    this.project = createStarterProject();
    this.currentTreeName = Object.keys(this.project)[0];
    return false;
  }

  /**
   * Add a new empty tree to the project
   */
  addTree(name) {
    if (!this.project) this.project = {};
    if (this.project[name]) return false;
    this.project[name] = Object.values(createEmptyProject())[0];
    this.currentTreeName = name;
    this.selectedNodeId = null;
    this.selectedLinkIndex = null;
    this.emit('project-loaded', { project: this.project });
    this.scheduleAutosave();
    return true;
  }

  /**
   * Clear everything and start a fresh project
   */
  clearAll() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    localStorage.removeItem(STORAGE_KEY);
    this.project = createStarterProject();
    this.currentTreeName = Object.keys(this.project)[0];
    this.selectedNodeId = null;
    this.selectedLinkIndex = null;
    this.lastLayout = null;
    this.visibleLinkTypes = new Set(['default', 'father', 'mother', 'married']);
    this.emit('project-loaded', { project: this.project });
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
