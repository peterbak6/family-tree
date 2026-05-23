import * as d3 from 'd3';
import { NODE_H } from '../utils/constants.js';
import { addLink, nextNodeId, addNode } from '../core/data-model.js';

/**
 * Handle node drag operations
 */
export class DragHandlers {
  constructor(state, onUpdate) {
    this.state = state;
    this.onUpdate = onUpdate;
  }

  onNodeDragStart(nodeId) {
    this.state.selectNode(nodeId);
  }

  onNodeDragEnd(nodeId, newY) {
    const tree = this.state.getCurrentTree();
    if (!tree) return;

    const node = tree.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Save layout order based on final Y position
    const gen = node.generation;
    const sameGenNodes = tree.nodes
      .filter(n => n.generation === gen)
      .sort((a, b) => {
        if (a.id === nodeId) return newY - (b.layout_order !== undefined ? b.layout_order * 100 : 0);
        if (b.id === nodeId) return (a.layout_order !== undefined ? a.layout_order * 100 : 0) - newY;
        return (a.layout_order !== undefined ? a.layout_order : 999999) - (b.layout_order !== undefined ? b.layout_order : 999999);
      });

    const newOrder = sameGenNodes.findIndex(n => n.id === nodeId);
    node.layout_order = newOrder;

    this.state.scheduleAutosave();
    this.onUpdate();
  }
}

/**
 * Handle link creation via drag
 */
export class LinkCreator {
  constructor(state, onUpdate, linkG, nodeG, rootG) {
    this.state = state;
    this.onUpdate = onUpdate;
    this.linkG = linkG;
    this.nodeG = nodeG;
    this.rootG = rootG;
    this.dragLinkSourceId = null;
    this.dragPreview = null;
    this.onLinkCreated = null; // Callback for when link is created
  }

  onLinkDragStart(sourceNode, nodeElement) {
    this.dragLinkSourceId = sourceNode.id;
    d3.select(nodeElement).classed('selected', true);
    
    this.dragPreview = this.linkG.append('path')
      .attr('class', 'drag-preview')
      .attr('d', `M${sourceNode.x},${sourceNode.y + NODE_H / 2} L${sourceNode.x},${sourceNode.y + NODE_H / 2}`);
  }

  onLinkDrag(event, sourceNode, nodeElement) {
    if (!this.dragPreview) return;
    
    const p = d3.pointer(event, this.rootG.node());
    this.dragPreview.attr('d', `M${sourceNode.x},${sourceNode.y + NODE_H / 2} L${p[0]},${p[1]}`);
    
    const target = this.nodeAtPoint(p[0], p[1], sourceNode.id);
    this.nodeG.selectAll('g.node').classed('drop-target', nd => target && nd.id === target.id);
  }

  onLinkDragEnd(event, sourceNode, nodeElement) {
    const p = d3.pointer(event, this.rootG.node());
    const target = this.nodeAtPoint(p[0], p[1], sourceNode.id);
    
    if (this.dragPreview) {
      this.dragPreview.remove();
      this.dragPreview = null;
    }
    
    this.nodeG.selectAll('g.node').classed('drop-target', false);

    if (target) {
      this.createLinkBetween(sourceNode.id, target.id);
    } else {
      this.onUpdate();
    }
    
    this.dragLinkSourceId = null;
  }

  nodeAtPoint(x, y, excludeId) {
    const layout = this.state.lastLayout;
    if (!layout) return null;

    return layout.nodes.find(n => {
      if (n.id === excludeId) return false;
      return x >= n.x && x <= n.x + 220 && y >= n.y && y <= n.y + 58;
    });
  }

  createLinkBetween(fromId, toId) {
    const tree = this.state.getCurrentTree();
    if (!tree) return;

    // Check if link already exists
    const exists = tree.links.some(l => 
      (l.from === fromId && l.to === toId) || 
      (l.from === toId && l.to === fromId)
    );

    if (!exists) {
      addLink(tree, fromId, toId, 'default');
      this.state.scheduleAutosave();
      
      // Notify that a link was created - callback will handle render
      if (this.onLinkCreated) {
        this.onLinkCreated(fromId); // Center on the origin/source node
      }
    }
  }
}

/**
 * Handle node editing
 */
export class NodeEditor {
  constructor(state, onUpdate, nodeG, rootG) {
    this.state = state;
    this.onUpdate = onUpdate;
    this.nodeG = nodeG;
    this.rootG = rootG;
    this.currentEditor = null;
  }

  startInlineEdit(nodeId) {
    const tree = this.state.getCurrentTree();
    if (!tree) return;

    const node = tree.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Remove any existing editor
    this.closeEditor();

    const nodeElement = this.nodeG.selectAll('g.node')
      .filter(d => d.id === nodeId)
      .node();

    if (!nodeElement) return;

    const nodeData = d3.select(nodeElement).datum();

    // Create foreign object for textarea
    const foreign = d3.select(nodeElement)
      .append('foreignObject')
      .attr('class', 'node-foreign-editor')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 220)
      .attr('height', 58);

    const textarea = foreign.append('xhtml:textarea')
      .attr('rows', 3)
      .property('value', node.content || '')
      .on('click', (event) => event.stopPropagation())
      .on('blur', () => this.saveAndCloseEditor(nodeId))
      .on('keydown', (event) => {
        if (event.key === 'Enter' && event.metaKey) {
          this.saveAndCloseEditor(nodeId);
        } else if (event.key === 'Escape') {
          this.closeEditor();
        }
      });

    this.currentEditor = { nodeId, foreign, textarea: textarea.node() };
    
    // Focus and select
    setTimeout(() => {
      textarea.node().focus();
      textarea.node().select();
    }, 50);
  }

  saveAndCloseEditor(nodeId) {
    if (!this.currentEditor || this.currentEditor.nodeId !== nodeId) return;

    const newContent = this.currentEditor.textarea.value;
    this.state.updateNode(nodeId, { content: newContent });
    this.closeEditor();
    this.onUpdate();
  }

  closeEditor() {
    if (this.currentEditor) {
      this.currentEditor.foreign.remove();
      this.currentEditor = null;
    }
  }
}

/**
 * Handle node creation
 */
export class NodeCreator {
  constructor(state, onUpdate) {
    this.state = state;
    this.onUpdate = onUpdate;
    this.onNodeCreated = null; // Callback for when node is created
  }

  addNodeToGeneration(generation) {
    const tree = this.state.getCurrentTree();
    if (!tree) return;

    const newNode = {
      id: nextNodeId(tree),
      generation: generation,
      content: 'New person, birth-death, location, notes'
    };

    addNode(tree, newNode);
    this.state.selectNode(newNode.id);
    this.state.scheduleAutosave();
    
    // Notify that a node was created - callback will handle render
    if (this.onNodeCreated) {
      this.onNodeCreated(newNode.id);
    }
    
    // Start editing the new node immediately
    setTimeout(() => {
      const nodeEditor = this.nodeEditor;
      if (nodeEditor && nodeEditor.startInlineEdit) {
        nodeEditor.startInlineEdit(newNode.id);
      }
    }, 100);
  }
  
  setNodeEditor(nodeEditor) {
    this.nodeEditor = nodeEditor;
  }

  addAxisLeft() {
    const tree = this.state.getCurrentTree();
    if (!tree) return;

    const range = tree['generation-range'];
    range.min = range.min - 1;
    this.state.scheduleAutosave();
    this.onUpdate();
  }

  addAxisRight() {
    const tree = this.state.getCurrentTree();
    if (!tree) return;

    const range = tree['generation-range'];
    range.max = range.max + 1;
    this.state.scheduleAutosave();
    this.onUpdate();
  }

  deleteNode(nodeId) {
    const tree = this.state.getCurrentTree();
    if (!tree) return;

    tree.nodes = tree.nodes.filter(n => n.id !== nodeId);
    tree.links = tree.links.filter(l => l.from !== nodeId && l.to !== nodeId);
    
    if (this.state.selectedNodeId === nodeId) {
      this.state.clearSelection();
    }

    this.state.scheduleAutosave();
    this.onUpdate();
  }
}
