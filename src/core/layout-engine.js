import * as d3 from 'd3';
import { graphlib, layout as dagreLayout } from '@dagrejs/dagre';
import {
  NODE_W,
  NODE_H,
  SPOUSE_PAD,
  SIBLING_PAD,
  GROUP_PAD,
  X_GAP,
  TOP_MARGIN,
  LEFT_MARGIN,
  generationColors
} from '../utils/constants.js';
import { unique } from '../utils/helpers.js';

/**
 * Compute layout for family tree using Sugiyama-inspired algorithm
 */
export function computeLayout(tree) {
  function nodeLabel(n) {
    return String(n.content || '').split(',')[0].trim().toLowerCase();
  }

  function linkTypeRank(type) {
    return ({ married: 0, father: 1, mother: 2, default: 3 })[type || 'default'] ?? 9;
  }

  // Work on sorted copies only to prevent insertion order from controlling layout
  const rawNodes = tree.nodes
    .map(d => ({ ...d }))
    .sort((a, b) =>
      d3.ascending(a.generation ?? 0, b.generation ?? 0) ||
      d3.ascending(nodeLabel(a), nodeLabel(b)) ||
      d3.ascending(+a.id, +b.id)
    );

  const nodeById = new Map(rawNodes.map(d => [d.id, d]));

  const links = tree.links
    .map((d, i) => ({ ...d, index: i, type: d.type || 'default' }))
    .filter(l => nodeById.has(l.from) && nodeById.has(l.to))
    .sort((a, b) => {
      const aFrom = nodeById.get(a.from);
      const aTo = nodeById.get(a.to);
      const bFrom = nodeById.get(b.from);
      const bTo = nodeById.get(b.to);

      const aMinGen = Math.min(aFrom?.generation ?? 0, aTo?.generation ?? 0);
      const bMinGen = Math.min(bFrom?.generation ?? 0, bTo?.generation ?? 0);

      return linkTypeRank(a.type) - linkTypeRank(b.type) ||
        d3.ascending(aMinGen, bMinGen) ||
        d3.ascending(Math.min(+a.from, +a.to), Math.min(+b.from, +b.to)) ||
        d3.ascending(Math.max(+a.from, +a.to), Math.max(+b.from, +b.to)) ||
        d3.ascending(a.index, b.index);
    });

  // father/mother links define parent-child layout;
  // default links between different generations also count (earlier gen = parent)
  const parentLinks = links.filter(l =>
    nodeById.has(l.from) &&
    nodeById.has(l.to) &&
    (
      l.type === 'father' ||
      l.type === 'mother' ||
      (l.type === 'default' && (nodeById.get(l.from).generation ?? 0) !== (nodeById.get(l.to).generation ?? 0))
    )
  );

const marriageLinks = links.filter(
  (l) =>
    (l.type === "married" || (l.type || "").includes("marri")) &&
    nodeById.has(l.from) &&
    nodeById.has(l.to),
);
  const incomingParents = new Map();
  const outgoingChildren = new Map();

  parentLinks.forEach(l => {
    // Always normalize by generation: earlier generation = parent
    // (link direction can be arbitrary if user changed type after dragging)
    const fromGen = nodeById.get(l.from)?.generation ?? 0;
    const toGen = nodeById.get(l.to)?.generation ?? 0;
    const parentId = fromGen > toGen ? l.to : l.from;
    const childId  = fromGen > toGen ? l.from : l.to;

    if (!incomingParents.has(childId)) incomingParents.set(childId, []);
    incomingParents.get(childId).push(parentId);

    if (!outgoingChildren.has(parentId)) outgoingChildren.set(parentId, []);
    outgoingChildren.get(parentId).push(childId);
  });

  const nodeGenerationValues = [...new Set(rawNodes.map(d => d.generation ?? 0))].sort((a, b) => a - b);
  const minNodeGeneration = d3.min(nodeGenerationValues) ?? 0;
  const maxNodeGeneration = d3.max(nodeGenerationValues) ?? 0;
  const minGeneration = tree['generation-range']?.min ?? minNodeGeneration;
  const maxGeneration = tree['generation-range']?.max ?? maxNodeGeneration;
  const generationValues = d3.range(minGeneration, maxGeneration + 1);
  const generationOrderIndex = new Map(generationValues.map((g, i) => [g, i]));

  // Initialize layout nodes
  const layoutNodes = rawNodes.map(n => ({
    ...n,
    x: LEFT_MARGIN + (n.generation ?? 0) * X_GAP - NODE_W / 2,
    y: TOP_MARGIN,
    desiredY: TOP_MARGIN,
    order: 0,
    color: '#fff'
  }));

  const placedById = new Map(layoutNodes.map(n => [n.id, n]));
  const nodesByGeneration = new Map(
    generationValues.map(gen => [gen, layoutNodes.filter(n => (n.generation ?? 0) === gen)])
  );

  function parentKeyForNode(id) {
    return unique(incomingParents.get(id) || []).sort((a, b) => a - b).join('|') || 'no-parents';
  }

  // Union-find: group nodes that share ANY common parent as siblings
  const _sg = new Map(rawNodes.map(n => [n.id, n.id]));
  function _findSG(x) {
    let p = _sg.get(x) ?? x;
    while (_sg.get(p) !== p) {
      const pp = _sg.get(_sg.get(p) ?? p) ?? _sg.get(p) ?? p;
      _sg.set(p, pp);
      p = _sg.get(p);
    }
    return p;
  }
  outgoingChildren.forEach(children => {
    for (let i = 1; i < children.length; i++) {
      const ra = _findSG(children[0]), rb = _findSG(children[i]);
      if (ra !== rb) _sg.set(rb, ra);
    }
  });
  function siblingGroupKey(id) {
    const parents = incomingParents.get(id);
    if (!parents || parents.length === 0) return 'no-parents';
    return String(_findSG(id));
  }

  function isMarried(aId, bId) {
    return marriageLinks.some(l =>
      (l.from === aId && l.to === bId) ||
      (l.from === bId && l.to === aId)
    );
  }

  function marriageComponents(genNodes) {
    const ids = new Set(genNodes.map(n => n.id));
    const parent = new Map(genNodes.map(n => [n.id, n.id]));

    function find(x) {
      let p = parent.get(x);
      while (p !== parent.get(p)) {
        parent.set(p, parent.get(parent.get(p)));
        p = parent.get(p);
      }
      return p;
    }

    function union(a, b) {
      if (!ids.has(a) || !ids.has(b)) return;
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    }

    marriageLinks.forEach(l => union(l.from, l.to));

    const comps = new Map();
    genNodes.forEach(n => {
      const r = find(n.id);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r).push(n);
    });

    return [...comps.values()];
  }

  function assignOrders() {
    generationValues.forEach(gen => {
      const arr = nodesByGeneration.get(gen) || [];
      arr.forEach((n, i) => n.order = i);
    });
  }

  function nodeCenter(n) {
    return n.y + NODE_H / 2;
  }

  function gapBetween(a, b) {
    if (!a || !b) return GROUP_PAD;
    if (isMarried(a.id, b.id)) return SPOUSE_PAD;

    const ak = siblingGroupKey(a.id);
    const bk = siblingGroupKey(b.id);
    return ak === bk && ak !== 'no-parents' ? SIBLING_PAD : GROUP_PAD;
  }

  function neighborBarycenter() {} // kept as no-op; replaced by dagre

  function moveToward(current, target, strength = 0.45, maxStep = 180) {
    const delta = target - current;
    const limited = Math.max(-maxStep, Math.min(maxStep, delta));
    return current + limited * strength;
  }

  // ── DAGRE: determine crossing-minimising order within each generation ──
  {
    const dg = new graphlib.Graph();
    dg.setGraph({ rankdir: 'LR', nodesep: SIBLING_PAD, ranksep: X_GAP });
    dg.setDefaultEdgeLabel(() => ({}));
    rawNodes.forEach(n => dg.setNode(String(n.id), { width: NODE_W, height: NODE_H }));

    // Feed only directed parent→child edges so dagre can minimise crossings
    parentLinks.forEach(l => {
      const fromGen = nodeById.get(l.from)?.generation ?? 0;
      const toGen   = nodeById.get(l.to)?.generation ?? 0;
      // Always normalize by generation (handles links whose type was changed)
      const [src, dst] = fromGen > toGen ? [l.to, l.from] : [l.from, l.to];
      if (!dg.hasEdge(String(src), String(dst))) {
        dg.setEdge(String(src), String(dst));
      }
    });

    dagreLayout(dg);

    // Re-sort each generation by dagre's within-rank y position
    generationValues.forEach(gen => {
      const arr = nodesByGeneration.get(gen) || [];
      arr.sort((a, b) => {
        const ay = dg.node(String(a.id))?.y ?? 0;
        const by = dg.node(String(b.id))?.y ?? 0;
        if (ay !== by) return ay - by;
        return a.id < b.id ? -1 : 1; // stable tie-break by id
      });
    });
    assignOrders();

    // Enforce spouse adjacency: married nodes that ended up non-adjacent after
    // the dagre sort are reinserted immediately after their partner so that
    // packGeneration can keep them together with the correct SPOUSE_PAD gap.
    generationValues.forEach(gen => {
      const arr = nodesByGeneration.get(gen) || [];
      const inGen = new Set(arr.map(n => n.id));
      const visited = new Set();
      const reordered = [];
      arr.forEach(n => {
        if (visited.has(n.id)) return;
        visited.add(n.id);
        reordered.push(n);
        // Append unvisited same-gen spouses immediately after this node
        marriageLinks
          .filter(l => l.from === n.id || l.to === n.id)
          .map(l => l.from === n.id ? l.to : l.from)
          .filter(sid => inGen.has(sid) && !visited.has(sid))
          .sort((a, b) => (dg.node(String(a))?.y ?? 0) - (dg.node(String(b))?.y ?? 0))
          .forEach(sid => { visited.add(sid); reordered.push(placedById.get(sid)); });
      });
      nodesByGeneration.set(gen, reordered.filter(Boolean));
    });
    assignOrders();
  }

  // ── layout_order is deprecated (manual drag was removed); dagre owns all ordering ──

  function packGeneration(gen, preserveOrder = true) {
    const arr = nodesByGeneration.get(gen) || [];
    if (!arr.length) return;

    if (!preserveOrder) {
      arr.sort((a, b) => {
        if (Math.abs(a.desiredY - b.desiredY) > 0.001) return a.desiredY - b.desiredY;
        return a.order - b.order;
      });
      arr.forEach((n, i) => n.order = i);
    }

    // Forward pass
    arr.forEach((n, i) => {
      if (i === 0) {
        n.y = Math.max(TOP_MARGIN, n.desiredY);
      } else {
        const prev = arr[i - 1];
        n.y = Math.max(n.desiredY, prev.y + NODE_H + gapBetween(prev, n));
      }
    });

    // Backward pass
    for (let i = arr.length - 2; i >= 0; i--) {
      const n = arr[i];
      const next = arr[i + 1];
      const maxY = next.y - gapBetween(n, next) - NODE_H;
      n.y = Math.min(n.y, maxY);
      n.y = Math.max(TOP_MARGIN, n.y);
    }

    // Safety pass
    arr.forEach((n, i) => {
      if (i === 0) {
        n.y = Math.max(TOP_MARGIN, n.y);
      } else {
        const prev = arr[i - 1];
        n.y = Math.max(n.y, prev.y + NODE_H + gapBetween(prev, n));
      }
    });
  }

  // ── Y-coordinate assignment ─────────────────────────────────────────────────
  //
  // "Nuclear-family" bottom-up algorithm — the standard approach used by
  // genealogy layout software:
  //
  //   genSpouses(id)  → same-generation spouse nodes of a given node
  //
  //   bottomUpPass()  deepest→root:
  //     For every couple (node + same-gen spouses), centre the couple block
  //     over the midpoint of ALL their combined children.
  //     packGeneration then resolves overlaps while preserving dagre's order,
  //     so siblings (already adjacent thanks to dagre) stay grouped.
  //
  //   topDownPass()   root→deepest:
  //     Pull each node toward the mean Y of its parents.
  //     Leaves snap fully; nodes with children blend 50/50 to balance
  //     the bottom-up child-centre pull against the top-down parent pull.
  //
  //   5 × (bottomUp + topDown), then one final bottomUp so every parent
  //   ends up centred over its children.

  function genSpouses(nodeId) {
    const gen = nodeById.get(nodeId)?.generation ?? 0;
    return marriageLinks
      .filter(l => l.from === nodeId || l.to === nodeId)
      .map(l => l.from === nodeId ? l.to : l.from)
      .filter(sid => (nodeById.get(sid)?.generation ?? 0) === gen)
      .map(sid => placedById.get(sid))
      .filter(Boolean);
  }

  // Seed: give every node a valid starting Y (compact, top-aligned)
  generationValues.forEach(gen => {
    const arr = nodesByGeneration.get(gen) || [];
    arr.forEach((n, i) => {
      n.y = n.desiredY = i === 0
        ? TOP_MARGIN
        : arr[i - 1].y + NODE_H + gapBetween(arr[i - 1], n);
    });
  });

  function bottomUpPass() {
    for (let gi = generationValues.length - 2; gi >= 0; gi--) {
      const gen = generationValues[gi];
      const arr = nodesByGeneration.get(gen) || [];
      const posInArr = new Map(arr.map((n, i) => [n.id, i]));
      const visited = new Set();

      arr.forEach(n => {
        if (visited.has(n.id)) return;
        visited.add(n.id);

        // Build couple: this node + unvisited same-gen spouses
        const couple = [n];
        genSpouses(n.id).forEach(s => {
          if (!visited.has(s.id)) { visited.add(s.id); couple.push(s); }
        });
        // Preserve the dagre-determined order within the generation
        couple.sort((a, b) => (posInArr.get(a.id) ?? 0) - (posInArr.get(b.id) ?? 0));

        // Collect every child that belongs to any member of this couple
        const childIds = new Set();
        couple.forEach(p => (outgoingChildren.get(p.id) || []).forEach(cid => childIds.add(cid)));
        const children = [...childIds].map(id => placedById.get(id)).filter(Boolean);

        const coupleH = couple.length * NODE_H + (couple.length - 1) * SPOUSE_PAD;

        if (children.length) {
          // Centre the couple block over the midpoint of their children
          const childMid = d3.mean(children, c => c.y + NODE_H / 2);
          const top = childMid - coupleH / 2;
          couple.forEach((p, i) => { p.desiredY = top + i * (NODE_H + SPOUSE_PAD); });
        } else {
          // No children: keep spouses centred around their current mean Y
          const mid = d3.mean(couple, p => p.y + NODE_H / 2);
          couple.forEach((p, i) => { p.desiredY = mid - coupleH / 2 + i * (NODE_H + SPOUSE_PAD); });
        }
      });

      // Resolve overlaps while keeping the dagre order (spouses already adjacent)
      packGeneration(gen, false);
    }
  }

  function topDownPass() {
    for (let gi = 1; gi < generationValues.length; gi++) {
      const gen = generationValues[gi];
      const arr = nodesByGeneration.get(gen) || [];

      arr.forEach(n => {
        const parents = unique(incomingParents.get(n.id) || [])
          .map(id => placedById.get(id)).filter(Boolean);
        if (!parents.length) return;

        const target = d3.mean(parents, p => p.y + NODE_H / 2) - NODE_H / 2;
        const hasChildren = (outgoingChildren.get(n.id) || []).length > 0;
        // Leaves snap to parent mean; intermediate nodes blend 50/50
        // n.desiredY = hasChildren ? 0.5 * n.y + 0.5 * target : target;
        n.desiredY = hasChildren
          ? moveToward(n.y, target, 0.25, 120)
          : moveToward(n.y, target, 0.55, 180);
      });

      packGeneration(gen, false);
    }
  }

  for (let pass = 0; pass < 5; pass++) {
    bottomUpPass();
    topDownPass();
  }
  bottomUpPass(); // final: ensure every parent is centred over its children
    topDownPass();

  // Normalize so the topmost node sits at TOP_MARGIN
  const minYFinal = d3.min(layoutNodes, n => n.y) ?? TOP_MARGIN;
  const shiftY = TOP_MARGIN - minYFinal;
  layoutNodes.forEach(n => { n.y += shiftY; n.desiredY += shiftY; });

  // Final positioning
  layoutNodes.forEach(n => {
    const order = generationOrderIndex.get(n.generation) ?? 0;
    n.x = LEFT_MARGIN + (n.generation ?? 0) * X_GAP - NODE_W / 2;
    n.cx = n.x + NODE_W / 2;
    n.cy = n.y + NODE_H / 2;
    n.color = generationColors[order % generationColors.length];
  });

  const finalPlacedById = new Map(layoutNodes.map(d => [d.id, d]));
  const minAxisX = LEFT_MARGIN + (d3.min(generationValues) ?? 0) * X_GAP - NODE_W / 2;
  const maxAxisX = LEFT_MARGIN + (d3.max(generationValues) ?? 0) * X_GAP + NODE_W / 2;
  const minX = Math.min(d3.min(layoutNodes, d => d.x) ?? minAxisX, minAxisX);
  const maxX = Math.max(d3.max(layoutNodes, d => d.x + NODE_W) ?? maxAxisX, maxAxisX);
  const minY = d3.min(layoutNodes, d => d.y) ?? TOP_MARGIN;
  const maxY = d3.max(layoutNodes, d => d.y + NODE_H) ?? (TOP_MARGIN + NODE_H);

  return {
    nodes: layoutNodes,
    links,
    groups: [],
    generations: generationValues,
    generationOrderIndex,
    placedById: finalPlacedById,
    bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
  };
}
