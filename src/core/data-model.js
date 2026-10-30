import { defaultLinkTypes, linkTypeColorPalette } from '../utils/constants.js';
import { sanitizeLinkTypeName, unique } from '../utils/helpers.js';
import * as d3 from 'd3';

const SAFE_COLOR_PATTERN = /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([0-9.,%+\-\s]+\)|[a-z]+)$/i;

function normalizeLinkTypeColor(value, fallback) {
  const color = typeof value === 'string' ? value.trim() : '';
  return SAFE_COLOR_PATTERN.test(color) ? color : fallback;
}

/**
 * Normalize link type list with defaults and custom types
 */
export function normalizeLinkTypeList(rawTypes = [], links = []) {
  const result = [];
  const seen = new Set();

  function add(item) {
    const type = sanitizeLinkTypeName(typeof item === 'string' ? item : item?.type);
    if (!type || seen.has(type)) return;

    const fallbackColor = linkTypeColorPalette[result.length % linkTypeColorPalette.length];
    const color = normalizeLinkTypeColor(item?.color, fallbackColor);
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
      
      // Remove deprecated fields (layout_order was used for manual drag, which is gone)
      delete n.layout_order;
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

export function createStarterProject() {
  return normalizeProject({
    'Start here: three generations': {
      nodes: [
        { id: 100001, generation: 0, content: 'Sam Rivera, grandparent' },
        { id: 100002, generation: 0, content: 'Lee Chen, grandparent' },
        { id: 100003, generation: 1, content: 'Maya Rivera, parent' },
        { id: 100004, generation: 1, content: 'Noah Okafor, parent' },
        { id: 100005, generation: 2, content: 'Ava Rivera, child' },
        { id: 100006, generation: 2, content: 'Leo Rivera, child' }
      ],
      links: [
        { from: 100001, to: 100002, type: 'married' },
        { from: 100001, to: 100003, type: 'father' },
        { from: 100002, to: 100003, type: 'mother' },
        { from: 100003, to: 100004, type: 'married' },
        { from: 100003, to: 100005, type: 'mother' },
        { from: 100004, to: 100005, type: 'father' },
        { from: 100003, to: 100006, type: 'mother' },
        { from: 100004, to: 100006, type: 'father' }
      ],
      'generation-range': { min: 0, max: 2 }
    }
  });
}

/**
 * Normalize all hierarchical link directions so that `from` is always the
 * earlier-generation (parent) node and `to` is always the child node.
 * This fixes links whose direction got flipped when a user changed the type
 * after dragging in the "wrong" direction.
 */
export function normalizeLinksDirection(tree) {
  if (!tree) return;
  // Strip stale layout_order from in-memory nodes (manual drag is gone)
  tree.nodes.forEach(n => delete n.layout_order);

  const nodeGenMap = new Map(tree.nodes.map(n => [n.id, n.generation ?? 0]));
  const hierarchicalTypes = new Set(['father', 'mother', 'default']);

  tree.links.forEach(l => {
    if (!hierarchicalTypes.has(l.type ?? 'default')) return;
    const fromGen = nodeGenMap.get(l.from) ?? 0;
    const toGen   = nodeGenMap.get(l.to)   ?? 0;
    if (fromGen > toGen) {
      [l.from, l.to] = [l.to, l.from];
    }
  });
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
