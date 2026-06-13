import { NODE_W, NODE_H } from '../utils/constants.js';
import { colorForLinkType } from '../core/data-model.js';

/**
 * Render parent-child links
 */
export function renderLinks(linkG, links, layout, state, handlers) {
  const tree = state.getCurrentTree();
  const linkTypes = tree?.['link-types'] || [];

  linkG.selectAll('path.parent-link')
    .data(links, d => d.index)
    .join('path')
    .attr('class', d => `parent-link ${d.type || 'default'} ${state.selectedLinkIndex === d.index ? 'selected' : ''}`)
    .attr('stroke', d => colorForLinkType(linkTypes, d.type || 'default'))
    .attr('d', d => {
      const a = layout.placedById.get(d.from);
      const b = layout.placedById.get(d.to);
      if (!a || !b) return '';

      // Draw horizontally between node sides
      const left = a.x <= b.x ? a : b;
      const right = a.x <= b.x ? b : a;
      const x1 = left.x + NODE_W;
      const y1 = left.y + NODE_H / 2;
      const x2 = right.x;
      const y2 = right.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    })
    .on('click', (event, d) => {
      event.stopPropagation();
      handlers.onLinkClick?.(d.index, event.clientX, event.clientY);
    });
}

/**
 * Render married links
 */
export function renderMarriedLinks(marriedG, links, layout, state, handlers) {
  const tree = state.getCurrentTree();
  const linkTypes = tree?.['link-types'] || [];
debugger;
  marriedG.selectAll('line.married-link')
    .data(links, d => d.index)
    .join('path')
    .attr('class', d => `married-link ${state.selectedLinkIndex === d.index ? 'selected' : ''}`)
    .attr('stroke', d => colorForLinkType(linkTypes, d.type || 'married'))
    // .attr('x1', d => {
    //   const a = layout.placedById.get(d.from);
    //   return a ? a.x + NODE_W : 0;
    // })
    // .attr('x2', d => {
    //   const b = layout.placedById.get(d.to);
    //   return b ? b.x + NODE_W : 0;
    // })
    // .attr('y1', d => {
    //   const a = layout.placedById.get(d.from);
    //   return a ? a.y + NODE_H / 2 : 0;
    // })
    // .attr('y2', d => {
    //   const b = layout.placedById.get(d.to);
    //   return b ? b.y + NODE_H / 2 : 0;
    // })
    // draw an arc between the two points above:
    .attr('d', d => {
      const a = layout.placedById.get(d.from);
      const b = layout.placedById.get(d.to);
      if (!a || !b) return '';

      // Draw horizontally between node sides
      const left = a.x <= b.x ? a : b;
      const right = a.x <= b.x ? b : a;
      const x1 = left.x + NODE_W;
      const y1 = left.y + NODE_H / 2;
      const x2 = right.x + NODE_W;
      const y2 = right.y + NODE_H / 2;
      const mx = (x1 + x2) / 2 + NODE_W / 4; // offset the midpoint to create a curve
      return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    })
    .style('fill', 'none')
    .on('click', (event, d) => {
      event.stopPropagation();
      handlers.onLinkClick?.(d.index, event.clientX, event.clientY);
    });
}
