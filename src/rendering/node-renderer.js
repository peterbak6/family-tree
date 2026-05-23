import * as d3 from 'd3';
import { NODE_W, NODE_H } from '../utils/constants.js';

/**
 * Render nodes
 */
export function renderNodes(nodeG, nodes, layout, state, handlers) {
  const node = nodeG.selectAll('g.node')
    .data(nodes, d => d.id)
    .join('g')
    .attr('class', d => `node ${state.selectedNodeId === d.id ? 'selected' : ''}`)
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .on('click', (event, d) => {
      event.stopPropagation();
      handlers.onNodeClick?.(d.id);
    });

  // Node rectangle
  node.append('rect')
    .attr('width', NODE_W)
    .attr('height', NODE_H)
    .style('fill', "rgba(255,255,255,1.0)")
    .style('stroke', d => d.color)
    .style('stroke-width', 2.5);

  // Node text content
  node.each(function(d) {
    const lines = String(d.content || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
    const g = d3.select(this);
    if (lines.length === 0) lines.push('Unnamed person');

    const lineHeight = lines.length === 1 ? 0 : 14;
    const startY = lines.length === 1 ? 34 : 18;

    lines.forEach((line, i) => {
      g.append('text')
        .attr('class', `line-${i} editable-text`)
        .attr('x', 14)
        .attr('y', startY + i * lineHeight)
        .text(line.length > 32 ? line.slice(0, 30) + '…' : line)
        .on('mousedown', (event) => event.stopPropagation())
        .on('touchstart', (event) => event.stopPropagation())
        .on('click', (event) => {
          event.stopPropagation();
          handlers.onNodeClick?.(d.id);
        });
    });
  });

  // Connector dot for creating links
  const connector = node.append('g')
    .attr('class', 'connector-dot')
    .attr('transform', `translate(0,${NODE_H / 2})`)
    .style('pointer-events', 'all')
    .on('mousedown', event => event.stopPropagation())
    .on('touchstart', event => event.stopPropagation())
    .on('mouseenter', function(event) {
      event.stopPropagation();
      d3.select(this).classed('connector-hover', true);
    })
    .on('mouseleave', function(event) {
      d3.select(this).classed('connector-hover', false);
    })
    .call(d3.drag()
      .on('start', function(event, d) {
        event.sourceEvent.stopPropagation();
        handlers.onLinkDragStart?.(d, this.parentNode.parentNode);
      })
      .on('drag', function(event, d) {
        handlers.onLinkDrag?.(event, d, this.parentNode.parentNode);
      })
      .on('end', function(event, d) {
        handlers.onLinkDragEnd?.(event, d, this.parentNode.parentNode);
      })
    );

  connector.append('circle').attr('r', 6);
  
  // Tooltip for connector
  connector.append('text')
    .attr('class', 'connector-tooltip')
    .attr('x', 0)
    .attr('y', -15)
    .attr('text-anchor', 'middle')
    .text('Drag to a connected node');

  // Edit button
  const editBtn = node.append('g')
    .attr('class', 'edit-node-btn')
    .attr('transform', `translate(${NODE_W - 26},10)`)
    .style('pointer-events', 'all')
    .on('mousedown', event => event.stopPropagation())
    .on('touchstart', event => event.stopPropagation())
    .on('mouseenter', event => event.stopPropagation())
    .on('mousemove', event => event.stopPropagation())
    .on('click', (event, d) => {
      event.stopPropagation();
      handlers.onNodeEdit?.(d.id);
    });

  editBtn.append('circle').attr('r', 8);
  editBtn.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .text('✎');

  // Delete button
  const deleteX = node.append('g')
    .attr('class', 'delete-node-x')
    .attr('transform', `translate(${NODE_W - 10},10)`)
    .style('pointer-events', 'all')
    .on('mousedown', event => event.stopPropagation())
    .on('touchstart', event => event.stopPropagation())
    .on('mouseenter', event => event.stopPropagation())
    .on('mousemove', event => event.stopPropagation())
    .on('click', (event, d) => {
      event.stopPropagation();
      handlers.onNodeDelete?.(d.id);
    });

  deleteX.append('circle').attr('r', 8);
  deleteX.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .text('×');
}
