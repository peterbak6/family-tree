import * as d3 from 'd3';
import { NODE_W, NODE_H, X_GAP, LEFT_MARGIN, generationColors } from '../utils/constants.js';
import { renderNodes } from './node-renderer.js';
import { renderLinks, renderMarriedLinks } from './link-renderer.js';

/**
 * Main SVG renderer
 */
export class SVGRenderer {
  constructor(svgSelector) {
    this.svg = d3.select(svgSelector);
    this.rootG = this.svg.append('g').attr('class', 'root');
    this.axisG = this.rootG.append('g').attr('class', 'axes');
    this.linkG = this.rootG.append('g').attr('class', 'links');
    this.marriedG = this.rootG.append('g').attr('class', 'married-links');
    this.nodeG = this.rootG.append('g').attr('class', 'nodes');
    
    this.zoom = d3.zoom()
      .scaleExtent([0.15, 2.4])
      .on('zoom', (event) => this.rootG.attr('transform', event.transform));
    
    this.svg.call(this.zoom);
  }

  /**
   * Render complete layout
   */
  render(layout, state, handlers) {
    // Clear previous render
    this.axisG.selectAll('*').remove();
    this.linkG.selectAll('*').remove();
    this.marriedG.selectAll('*').remove();
    this.nodeG.selectAll('*').remove();

    // Render generation axes
    this.renderAxes(layout, handlers);

    // Render links and nodes
    const parentLinks = layout.links.filter(l => 
      l.type !== 'married' && state.visibleLinkTypes.has(l.type || 'default')
    );
    const marriedLinks = layout.links.filter(l => 
      l.type === 'married' && state.visibleLinkTypes.has('married')
    );

    renderLinks(this.linkG, parentLinks, layout, state, handlers);
    renderMarriedLinks(this.marriedG, marriedLinks, layout, state, handlers);
    renderNodes(this.nodeG, layout.nodes, layout, state, handlers);
  }

  /**
   * Render generation axes with add buttons
   */
  renderAxes(layout, handlers) {
    const y0 = Math.max(40, layout.bounds.minY - 80);
    const y1 = layout.bounds.maxY + 90;

    const axisWrap = this.axisG.selectAll('g.axis-wrap')
      .data(layout.generations)
      .join('g')
      .attr('class', 'axis-wrap');

    // Axis line
    axisWrap.append('line')
      .attr('class', 'axis-line')
      .attr('x1', d => LEFT_MARGIN + d * X_GAP)
      .attr('x2', d => LEFT_MARGIN + d * X_GAP)
      .attr('y1', y0)
      .attr('y2', y1)
      .attr('stroke', d => generationColors[(layout.generationOrderIndex.get(d) ?? 0) % generationColors.length]);

    // Hit area for interaction with hover tooltip
    const axisHit = axisWrap.append('line')
      .attr('class', 'axis-hit')
      .attr('x1', d => LEFT_MARGIN + d * X_GAP)
      .attr('x2', d => LEFT_MARGIN + d * X_GAP)
      .attr('y1', y0)
      .attr('y2', y1)
      .on('mousemove', function(event, generation) {
        const p = d3.pointer(event, this.parentNode.parentNode);
        d3.select(this.parentNode)
          .classed('axis-hover', true)
          .select('text.axis-label')
          .attr('x', p[0])
          .attr('y', p[1] - 10);
      })
      .on('mouseenter', function(event, generation) {
        const p = d3.pointer(event, this.parentNode.parentNode);
        d3.select(this.parentNode)
          .classed('axis-hover', true)
          .select('text.axis-label')
          .attr('x', p[0])
          .attr('y', p[1] - 10);
      })
      .on('mouseleave', function() {
        d3.select(this.parentNode).classed('axis-hover', false);
      })
      .on('click', function(event, generation) {
        event.stopPropagation();
        handlers.onAddNodeToGeneration?.(generation);
      });

    // Tooltip label for axis (follows mouse)
    axisWrap.append('text')
      .attr('class', 'axis-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .text('Click to add a node');

    // Side buttons for adding new generations
    const minGen = d3.min(layout.generations);
    const maxGen = d3.max(layout.generations);
    const axisCenterY = (y0 + y1) / 2;

    const sideAdds = [
      { side: 'left', generation: minGen - 1, x: LEFT_MARGIN + (minGen - 1) * X_GAP, y: axisCenterY },
      { side: 'right', generation: maxGen + 1, x: LEFT_MARGIN + (maxGen + 1) * X_GAP, y: axisCenterY }
    ];

    const sideAxisAdd = this.axisG.selectAll('g.side-axis-add')
      .data(sideAdds, d => d.side)
      .join('g')
      .attr('class', 'side-axis-add')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('pointer-events', 'all')
      .on('mouseenter', function(event, d) {
        event.stopPropagation();
        d3.select(this).classed('side-hover', true);
      })
      .on('mouseleave', function(event) {
        d3.select(this).classed('side-hover', false);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.side === 'left') {
          handlers.onAddAxisLeft?.();
        } else {
          handlers.onAddAxisRight?.();
        }
      });

    sideAxisAdd.append('circle').attr('r', 18);
    sideAxisAdd.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.33em')
      .text('+');
    
    // Tooltip for side buttons
    sideAxisAdd.append('text')
      .attr('class', 'side-tooltip')
      .attr('x', d => d.side === 'left' ? -35 : 35)
      .attr('y', -25)
      .attr('text-anchor', 'middle')
      .text(d => `Create new axis to the ${d.side}`);
  }

  /**
   * Fit view to content
   */
  fitView() {
    const bounds = this.rootG.node().getBBox();
    const parent = this.svg.node();
    const fullWidth = parent.clientWidth;
    const fullHeight = parent.clientHeight;

    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;

    if (width === 0 || height === 0) return;

    const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [
      fullWidth / 2 - scale * midX,
      fullHeight / 2 - scale * midY
    ];

    this.svg.transition()
      .duration(750)
      .call(
        this.zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  }

  /**
   * Get current zoom transform
   */
  getTransform() {
    return d3.zoomTransform(this.svg.node());
  }

  /**
   * Set zoom transform
   */
  setTransform(transform) {
    this.svg.call(this.zoom.transform, transform);
  }

  /**
   * Center view on a specific node
   */
  centerOnNode(nodeId, layout) {
    const node = layout.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const parent = this.svg.node();
    const fullWidth = parent.clientWidth;
    const fullHeight = parent.clientHeight;

    // Center position of the node
    const nodeCenterX = node.x + 110; // NODE_W / 2
    const nodeCenterY = node.y + 29;  // NODE_H / 2

    // Use current scale or default to 1
    const currentTransform = this.getTransform();
    const scale = currentTransform.k || 1;

    const translate = [
      fullWidth / 2 - scale * nodeCenterX,
      fullHeight / 2 - scale * nodeCenterY
    ];

    this.svg.transition()
      .duration(500)
      .call(
        this.zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  }

  /**
   * Handle background click
   */
  onBackgroundClick(handler) {
    this.svg.on('click', (event) => {
      if (event.defaultPrevented) return;
      handler();
    });
  }
}
