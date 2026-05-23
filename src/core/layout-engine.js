import * as d3 from 'd3';
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

  function hasLayoutOrder(n) {
    return n.layout_order !== undefined && n.layout_order !== null && !Number.isNaN(+n.layout_order);
  }

  function layoutOrder(n) {
    return hasLayoutOrder(n) ? +n.layout_order : Infinity;
  }

  function componentLayoutOrder(component) {
    const values = component.filter(hasLayoutOrder).map(n => +n.layout_order);
    return values.length ? d3.min(values) : Infinity;
  }

  function linkTypeRank(type) {
    return ({ married: 0, father: 1, mother: 2, default: 3 })[type || 'default'] ?? 9;
  }

  // Work on sorted copies only to prevent insertion order from controlling layout
  const rawNodes = tree.nodes
    .map(d => ({ ...d }))
    .sort((a, b) =>
      d3.ascending(a.generation ?? 0, b.generation ?? 0) ||
      d3.ascending(layoutOrder(a), layoutOrder(b)) ||
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

  const marriageLinks = links.filter(l => l.type === 'married' && nodeById.has(l.from) && nodeById.has(l.to));

  const incomingParents = new Map();
  const outgoingChildren = new Map();

  parentLinks.forEach(l => {
    // For default links, normalize direction: earlier generation = parent
    const fromGen = nodeById.get(l.from)?.generation ?? 0;
    const toGen = nodeById.get(l.to)?.generation ?? 0;
    const parentId = (l.type === 'default' && fromGen > toGen) ? l.to : l.from;
    const childId = (l.type === 'default' && fromGen > toGen) ? l.from : l.to;

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

    const ak = parentKeyForNode(a.id);
    const bk = parentKeyForNode(b.id);
    return ak === bk && ak !== 'no-parents' ? SIBLING_PAD : GROUP_PAD;
  }

  function neighborBarycenter(n, direction) {
    const ids = direction === 'children'
      ? unique(outgoingChildren.get(n.id) || [])
      : unique(incomingParents.get(n.id) || []);

    const values = ids
      .map(id => placedById.get(id))
      .filter(Boolean)
      .map(other => other.order);

    return values.length ? d3.mean(values) : null;
  }

  function sortGenerationByBarycenter(gen, direction) {
    const arr = nodesByGeneration.get(gen) || [];
    if (!arr.length) return;

    const value = new Map();
    arr.forEach(n => {
      const b = neighborBarycenter(n, direction);
      value.set(n.id, b == null ? n.order : b);
    });

    const comps = marriageComponents(arr);

    comps.forEach(comp => {
      comp.sort((a, b) => {
        const av = value.get(a.id);
        const bv = value.get(b.id);
        if (Math.abs(av - bv) > 0.001) return av - bv;
        return a.order - b.order;
      });
    });

    comps.sort((a, b) => {
      const ao = componentLayoutOrder(a);
      const bo = componentLayoutOrder(b);
      if (ao !== Infinity || bo !== Infinity) {
        return d3.ascending(ao, bo) ||
          d3.ascending(d3.min(a, n => n.order), d3.min(b, n => n.order));
      }

      const av = d3.mean(a, n => value.get(n.id));
      const bv = d3.mean(b, n => value.get(n.id));
      if (Math.abs(av - bv) > 0.001) return av - bv;

      const ak = d3.min(a, n => parentKeyForNode(n.id));
      const bk = d3.min(b, n => parentKeyForNode(n.id));
      if (ak !== bk) return d3.ascending(ak, bk);

      const aHasChildren = d3.max(a, n => (outgoingChildren.get(n.id) || []).length) || 0;
      const bHasChildren = d3.max(b, n => (outgoingChildren.get(n.id) || []).length) || 0;
      if (aHasChildren !== bHasChildren) return d3.descending(aHasChildren, bHasChildren);

      return d3.ascending(d3.min(a, n => n.order), d3.min(b, n => n.order));
    });

    const flattened = comps.flat();
    nodesByGeneration.set(gen, flattened);
    flattened.forEach((n, i) => n.order = i);
  }

  // Initial order: sibling groups contiguous
  generationValues.forEach(gen => {
    const arr = nodesByGeneration.get(gen) || [];
    arr.sort((a, b) => {
      if (hasLayoutOrder(a) || hasLayoutOrder(b)) {
        return d3.ascending(layoutOrder(a), layoutOrder(b)) ||
          d3.ascending(a.id, b.id);
      }

      const ak = parentKeyForNode(a.id);
      const bk = parentKeyForNode(b.id);
      if (ak !== bk) return d3.ascending(ak, bk);

      const aHasChildren = (outgoingChildren.get(a.id) || []).length;
      const bHasChildren = (outgoingChildren.get(b.id) || []).length;
      if (aHasChildren !== bHasChildren) return d3.descending(aHasChildren, bHasChildren);

      return d3.ascending(a.id, b.id);
    });
  });
  assignOrders();

  // Barycentric crossing-reduction sweeps
  for (let iter = 0; iter < 18; iter++) {
    for (let gi = 1; gi < generationValues.length; gi++) {
      sortGenerationByBarycenter(generationValues[gi], 'parents');
    }
    for (let gi = generationValues.length - 2; gi >= 0; gi--) {
      sortGenerationByBarycenter(generationValues[gi], 'children');
    }
  }

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

  // Initial compact y positions
  generationValues.forEach(gen => {
    const arr = nodesByGeneration.get(gen) || [];
    arr.forEach((n, i) => {
      n.desiredY = i === 0 ? TOP_MARGIN : arr[i - 1].y + NODE_H + gapBetween(arr[i - 1], n);
      n.y = n.desiredY;
    });
    packGeneration(gen, true);
  });

  function rightToLeftCoordinatePass() {
    for (let gi = generationValues.length - 2; gi >= 0; gi--) {
      const gen = generationValues[gi];
      const arr = nodesByGeneration.get(gen) || [];

      arr.forEach(n => {
        const children = unique(outgoingChildren.get(n.id) || [])
          .map(id => placedById.get(id))
          .filter(Boolean);

        if (children.length) {
          n.desiredY = d3.mean(children, c => nodeCenter(c)) - NODE_H / 2;
        } else {
          n.desiredY = n.y;
        }
      });

      packGeneration(gen, true);
    }
  }

  function gentleLeftToRightCoordinatePass() {
    for (let gi = 1; gi < generationValues.length; gi++) {
      const gen = generationValues[gi];
      const arr = nodesByGeneration.get(gen) || [];

      arr.forEach(n => {
        const parents = unique(incomingParents.get(n.id) || [])
          .map(id => placedById.get(id))
          .filter(Boolean);
        const hasChildren = (outgoingChildren.get(n.id) || []).length > 0;

        if (parents.length && !hasChildren) {
          const targetY = d3.mean(parents, p => nodeCenter(p)) - NODE_H / 2;
          n.desiredY = 0.9 * n.y + 0.1 * targetY;
        } else {
          n.desiredY = n.y;
        }
      });

      packGeneration(gen, true);
    }
  }

  function postProcessMarriedProximity() {
    generationValues.forEach(gen => {
      const arr = nodesByGeneration.get(gen) || [];
      if (!arr.length) return;

      const comps = marriageComponents(arr)
        .map(comp => comp.slice().sort((a, b) => a.y - b.y))
        .sort((a, b) => d3.min(a, n => n.y) - d3.min(b, n => n.y));

      comps.forEach(comp => {
        if (comp.length <= 1) return;
        const center = d3.mean(comp, n => nodeCenter(n));
        const height = comp.length * NODE_H + (comp.length - 1) * SPOUSE_PAD;
        const top = center - height / 2;
        comp.forEach((n, i) => {
          n.y = top + i * (NODE_H + SPOUSE_PAD);
          n.desiredY = n.y;
        });
      });

      let prevComp = null;
      comps.forEach(comp => {
        const top = d3.min(comp, n => n.y);
        const height = comp.length * NODE_H + (comp.length - 1) * SPOUSE_PAD;
        let newTop = Math.max(TOP_MARGIN, top);

        if (prevComp) {
          const prevTop = d3.min(prevComp, n => n.y);
          const prevHeight = prevComp.length * NODE_H + (prevComp.length - 1) * SPOUSE_PAD;
          const prevBottom = prevTop + prevHeight;
          const prevLast = prevComp[prevComp.length - 1];
          const currFirst = comp[0];
          const gap = isMarried(prevLast.id, currFirst.id) ? SPOUSE_PAD : gapBetween(prevLast, currFirst);
          newTop = Math.max(newTop, prevBottom + gap);
        }

        comp.forEach((n, i) => {
          n.y = newTop + i * (NODE_H + SPOUSE_PAD);
          n.desiredY = n.y;
        });

        prevComp = comp;
      });

      const flattened = comps.flat();
      nodesByGeneration.set(gen, flattened);
      flattened.forEach((n, i) => n.order = i);
    });
  }

  // Coordinate refinement passes
  for (let i = 0; i < 12; i++) {
    rightToLeftCoordinatePass();
    gentleLeftToRightCoordinatePass();
  }

  rightToLeftCoordinatePass();
  postProcessMarriedProximity();

  // Normalize top
  const minYBefore = d3.min(layoutNodes, n => n.y) ?? TOP_MARGIN;
  const shiftY = TOP_MARGIN - minYBefore;
  layoutNodes.forEach(n => n.y += shiftY);

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
