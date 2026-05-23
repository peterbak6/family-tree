import { state } from './core/state-manager.js';
import { computeLayout } from './core/layout-engine.js';
import { normalizeLinksDirection } from './core/data-model.js';
import { SVGRenderer } from './rendering/svg-renderer.js';
import { LinkCreator, NodeEditor, NodeCreator } from './interactions/interaction-handlers.js';
import { Toolbar } from './ui/toolbar.js';
import { LinkTypesMenu } from './ui/link-types-menu.js';
import { importJSON, exportJSON } from './io/json-io.js';
import { exportAsPng } from './io/png-export.js';

/**
 * Main application class
 */
class FamilyTreeApp {
  constructor() {
    this.renderer = new SVGRenderer('#chart');
    this.toolbar = null;
    this.linkTypesMenu = null;
    this.linkCreator = null;
    this.nodeEditor = null;
    this.nodeCreator = null;
    
    this.init();
  }

  init() {
    // Initialize handlers - all preserve view to avoid unwanted recentering
    this.linkCreator = new LinkCreator(state, () => this.render(true), this.renderer.linkG, this.renderer.nodeG, this.renderer.rootG);
    this.nodeEditor = new NodeEditor(state, () => this.render(true), this.renderer.nodeG, this.renderer.rootG);
    this.nodeCreator = new NodeCreator(state, () => this.render(true));
    this.nodeCreator.setNodeEditor(this.nodeEditor);
    
    // Set up callbacks for centering on newly created nodes/links
    this.nodeCreator.onNodeCreated = (nodeId) => {
      this.centerOnNodeId = nodeId;
      this.render(); // Recalculate layout and center on new node
    };
    this.linkCreator.onLinkCreated = (nodeId) => {
      this.centerOnNodeId = nodeId;
      this.render(); // Recalculate layout and center on source node
    };

    // Initialize UI components
    this.toolbar = new Toolbar(state, {
      onImport: (file) => this.handleImport(file),
      onTreeChange: (treeName) => this.handleTreeChange(treeName),
      onFitView: () => {
        const tree = state.getCurrentTree();
        if (tree) {
          normalizeLinksDirection(tree);
          state.scheduleAutosave();
        }
        this.render();
      },
      onExport: () => this.handleExport(),
      onExportPng: async () => {
        this.toolbar.setStatus('Exporting PNG…');
        try {
          await exportAsPng(state);
          this.toolbar.setStatus(`${state.currentTreeName}: PNG exported`);
        } catch (err) {
          console.error('PNG export failed:', err);
          this.toolbar.setStatus('PNG export failed — check console');
        }
      }
    });

    this.linkTypesMenu = new LinkTypesMenu(state, () => this.render());

    // Setup background click handler
    this.renderer.onBackgroundClick(() => {
      state.clearSelection();
      // Don't call render() here - the 'selection-cleared' event will handle it with preserveView=true
    });

    // Subscribe to state changes
    state.subscribe('project-loaded', () => this.onProjectLoaded());
    state.subscribe('tree-changed', () => this.render(true)); // Preserve view when switching trees
    state.subscribe('node-selected', () => this.render(true)); // Preserve view on selection
    state.subscribe('link-selected', () => {
      this.linkTypesMenu.render();
      this.render(true); // Preserve view on link selection
    });
    state.subscribe('selection-cleared', () => {
      this.linkTypesMenu.render();
      this.render(true); // Preserve view when clearing selection
    });
    state.subscribe('link-types-changed', () => this.render(true)); // Preserve view when link types change
    state.subscribe('saved', ({ savedAt }) => {
      console.log('Auto-saved at', savedAt);
    });
    state.subscribe('loaded-from-storage', ({ savedAt }) => {
      console.log('Loaded previous session from', savedAt);
      this.toolbar.setStatus(`Restored session from ${new Date(savedAt).toLocaleString()}`);
    });

    // Initial render
    this.onProjectLoaded();
  }

  onProjectLoaded() {
    this.toolbar.updateTreeSelector();
    this.linkTypesMenu.render();
    
    if (state.getCurrentTree()) {
      this.render();
      document.getElementById('emptyState').style.display = 'none';
    } else {
      document.getElementById('emptyState').style.display = 'grid';
    }
  }

  render(preserveView = false) {
    const tree = state.getCurrentTree();
    if (!tree) {
      document.getElementById('emptyState').style.display = 'grid';
      return;
    }

    document.getElementById('emptyState').style.display = 'none';

    // Save current transform if preserving view
    const oldTransform = preserveView ? this.renderer.getTransform() : null;

    // Compute layout
    const layout = computeLayout(tree);
    state.lastLayout = layout;

    // Prepare handlers for rendering
    const handlers = {
      onNodeClick: (nodeId) => {
        const wasSelected = state.selectedNodeId === nodeId;
        state.selectNode(nodeId);
        if (wasSelected) {
          this.nodeEditor.startInlineEdit(nodeId);
        }
      },
      onNodeEdit: (nodeId) => this.nodeEditor.startInlineEdit(nodeId),
      onNodeDelete: (nodeId) => this.nodeCreator.deleteNode(nodeId),
      onLinkClick: (linkIndex) => state.selectLink(linkIndex),
      onLinkDragStart: (...args) => this.linkCreator.onLinkDragStart(...args),
      onLinkDrag: (...args) => this.linkCreator.onLinkDrag(...args),
      onLinkDragEnd: (...args) => this.linkCreator.onLinkDragEnd(...args),
      onAddNodeToGeneration: (gen) => this.nodeCreator.addNodeToGeneration(gen),
      onAddAxisLeft: () => this.nodeCreator.addAxisLeft(),
      onAddAxisRight: () => this.nodeCreator.addAxisRight()
    };

    // Render
    this.renderer.render(layout, state, handlers);

    // Handle view positioning
    if (this.centerOnNodeId) {
      this.renderer.centerOnNode(this.centerOnNodeId, layout);
      this.centerOnNodeId = null;
    } else if (preserveView && oldTransform) {
      this.renderer.setTransform(oldTransform);
    } else if (!preserveView) {
      this.renderer.fitView();
    }

    // Update status
    this.toolbar.setStatus(
      `${state.currentTreeName}: ${layout.nodes.length} nodes, ${layout.links.length} links`
    );
  }

  handleImport(file) {
    if (!file) return;

    importJSON(
      file,
      (project) => {
        state.loadProject(project);
        this.toolbar.setStatus('Imported successfully');
      },
      (error) => {
        alert('Failed to import file: ' + error.message);
      }
    );
  }

  handleTreeChange(treeName) {
    state.setCurrentTreeName(treeName);
  }

  handleExport() {
    const filename = `family-tree-${state.currentTreeName}-${new Date().toISOString().split('T')[0]}.json`;
    exportJSON(state.project, filename);
    this.toolbar.setStatus('Exported successfully');
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new FamilyTreeApp());
} else {
  new FamilyTreeApp();
}
