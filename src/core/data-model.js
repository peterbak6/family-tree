import { defaultLinkTypes, linkTypeColorPalette } from '../utils/constants.js';
import { sanitizeLinkTypeName, unique } from '../utils/helpers.js';
import * as d3 from 'd3';

/**
 * Normalize link type list with defaults and custom types
 */
export function normalizeLinkTypeList(rawTypes = [], links = []) {
  const result = [];
  const seen = new Set();

  function add(item) {
    const type = sanitizeLinkTypeName(typeof item === 'string' ? item : item?.type);
    if (!type || seen.has(type)) return;
    
    const color = typeof item === 'object' && item?.color
      ? item.color
      : linkTypeColorPalette[result.length % linkTypeColorPalette.length];
    const label = typeof item === 'object' && item?.label ? item.label : type;
    
    seen.add(type);
    result.push({ type, label, color });
  }

  // Add default types first
  defaultLinkTypes.forEach(add);
  
  // Add custom types
  (rawTypes || []).forEach(add);
  
  // Add types from links that aren't defined
  (links || []).forEach(l => add(l.type || 'default'));

  return result;
}

/**
 * Ensure tree has valid link types
 */
export function ensureTreeLinkTypes(tree) {
  if (!tree) return;
  tree['link-types'] = normalizeLinkTypeList(tree['link-types'], tree.links);
  return tree['link-types'];
}

/**
 * Normalize and validate project data
 */
export function normalizeProject(obj) {
  Object.values(obj).forEach(tree => {
    tree.nodes = tree.nodes || [];
    tree.links = tree.links || [];
    
    // Normalize nodes
    tree.nodes.forEach(n => {
      if (n.generation == null && n.vertical_position != null) {
        n.generation = n.vertical_position;
      }
      n.generation = +n.generation || 0;
      
      if (n.layout_order !== undefined && n.layout_order !== null && n.layout_order !== '') {
        n.layout_order = +n.layout_order;
      } else {
        delete n.layout_order;
      }
      
      // Remove deprecated fields
      delete n.vertical_position;
      delete n.row_position;
    });

    // Normalize generation range
    if (tree.generationRange && !tree['generation-range']) {
      tree['generation-range'] = tree.generationRange;
    }
    delete tree.generationRange;

    const minNodeGen = d3.min(tree.nodes, d => d.generation) ?? 0;
    const maxNodeGen = d3.max(tree.nodes, d => d.generation) ?? 0;
    const range = tree['generation-range'] || {};
    
    tree['generation-range'] = {
      min: Math.min(range.min ?? minNodeGen, minNodeGen),
      max: Math.max(range.max ?? maxNodeGen, maxNodeGen)
    };

    // Normalize links
    tree.links.forEach(l => {
      if (!l.type) l.type = 'default';
    });
    
    tree['link-types'] = normalizeLinkTypeList(tree['link-types'], tree.links);
  });
  
  return obj;
}

/**
 * Get next available node ID
 */
export function nextNodeId(tree) {
  return (d3.max(tree.nodes, d => +d.id) || 100000) + 1;
}

/**
 * Create a new empty project
 */
export function createEmptyProject() {
  return {
    'default-tree': {
      nodes: [],
      links: [],
      'link-types': normalizeLinkTypeList(),
      'generation-range': { min: 0, max: 0 }
    }
  };
}

/**
 * Add a node to a tree
 */
export function addNode(tree, node) {
  tree.nodes.push(node);
  
  // Update generation range
  const gen = node.generation || 0;
  const range = tree['generation-range'];
  tree['generation-range'] = {
    min: Math.min(range.min, gen),
    max: Math.max(range.max, gen)
  };
  
  return node;
}

/**
 * Remove a node and its associated links
 */
export function removeNode(tree, nodeId) {
  tree.nodes = tree.nodes.filter(n => n.id !== nodeId);
  tree.links = tree.links.filter(l => l.from !== nodeId && l.to !== nodeId);
}

/**
 * Add a link between two nodes
 */
export function addLink(tree, from, to, type = 'default') {
  const link = { from, to, type };
  tree.links.push(link);
  ensureTreeLinkTypes(tree);
  return link;
}

/**
 * Get color for link type
 */
export function colorForLinkType(linkTypes, type) {
  const item = linkTypes.find(t => t.type === (type || 'default'));
  return item?.color || '#8c8f98';
}
