/**
 * Export the current tree as a PNG.
 *
 * The canvas size is derived from the layout bounding box so every node
 * renders at its natural pixel dimensions (NODE_W × NODE_H) — the image
 * grows to fit the content, not the other way around.
 */

const PADDING = 60;   // whitespace around the tree in the output image
const BG_COLOR = '#fafafa';

/**
 * Critical visual styles with CSS custom-property values resolved to their
 * literal colour strings.  Interaction-only rules (hover, transition, cursor,
 * pointer-events) are intentionally omitted so the export stays clean.
 */
const EXPORT_STYLES = `
  text {
    font-family: 'Source Sans Pro', system-ui, -apple-system, Arial, sans-serif;
  }
  .axis-line {
    stroke-width: 3;
    stroke-linecap: round;
    opacity: 0.3;
  }
  .parent-link {
    fill: none;
    stroke-width: 2;
    opacity: 0.5;
  }
  .parent-link.default { stroke-dasharray: 8 5; stroke: #94a3b8; }
  .parent-link.father  { stroke: #3b82f6; }
  .parent-link.mother  { stroke: #ec4899; }
  .married-link {
    fill: none;
    stroke: #64748b;
    stroke-width: 2;
    opacity: 0.7;
  }
  .node rect {
    stroke: rgba(0,0,0,0.12);
    stroke-width: 1.5;
  }
  .node text {
    font-size: 13px;
    fill: #1a1a1a;
    font-weight: 500;
  }
  .node .line-0 {
    font-weight: 700;
    font-size: 13.5px;
    fill: #1a1a1a;
  }
  .node .line-1,
  .node .line-2,
  .node .line-3 {
    fill: #6b7280;
    font-size: 11.5px;
    font-weight: 400;
  }
`;

/** Elements that only exist for mouse interaction — strip them from the export. */
const REMOVE_SELECTORS = [
  '.axis-hit',
  '.side-axis-add',
  '.axis-label',
  '.side-tooltip',
  '.connector-dot',
  '.connector-tooltip',
  '.edit-node-btn',
  '.delete-node-x',
  '.node-foreign-editor',
  'foreignObject',
  '.drag-preview',
];

export async function exportAsPng(state) {
  const layout = state.lastLayout;
  if (!layout || !layout.nodes.length) {
    alert('Nothing to export — load a tree first.');
    return;
  }

  const { minX, maxX, minY, maxY } = layout.bounds;
  const canvasW = Math.ceil(maxX - minX + PADDING * 2);
  const canvasH = Math.ceil(maxY - minY + PADDING * 2);

  // ── 1. Clone the live SVG ────────────────────────────────────────────────
  const svgEl = document.getElementById('chart');
  const clone = svgEl.cloneNode(true);

  // Fixed dimensions, no viewBox — content rendered 1:1
  clone.setAttribute('width',  canvasW);
  clone.setAttribute('height', canvasH);
  clone.setAttribute('xmlns',  'http://www.w3.org/2000/svg');
  clone.removeAttribute('viewBox');

  // Reset the zoom/pan transform so the full tree is visible at natural scale
  const rootG = clone.querySelector('g.root');
  if (rootG) {
    rootG.setAttribute('transform',
      `translate(${PADDING - minX}, ${PADDING - minY})`);
  }

  // ── 2. Prepare elements ──────────────────────────────────────────────────

  // Set rx/ry as SVG attributes (CSS property form may not survive serialisation)
  clone.querySelectorAll('.node rect').forEach(r => {
    r.setAttribute('rx', '14');
    r.setAttribute('ry', '14');
  });

  // Strip interaction-only elements
  REMOVE_SELECTORS.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Strip link types that the user has hidden via the link-types menu
  const visible = state.visibleLinkTypes; // Set<string>
  if (visible) {
    // Parent links: .parent-link.father / .parent-link.mother / .parent-link.default
    ['father', 'mother', 'default'].forEach(type => {
      if (!visible.has(type)) {
        clone.querySelectorAll(`.parent-link.${type}`).forEach(el => el.remove());
      }
    });
    // Married links
    if (!visible.has('married')) {
      clone.querySelectorAll('.married-link').forEach(el => el.remove());
    }
  }

  // ── 3. Inject resolved styles ────────────────────────────────────────────
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = EXPORT_STYLES;
  clone.insertBefore(styleEl, clone.firstChild);

  // Solid background rect
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width',  canvasW);
  bg.setAttribute('height', canvasH);
  bg.setAttribute('fill',   BG_COLOR);
  clone.insertBefore(bg, clone.firstChild);

  // ── 4. Serialize ─────────────────────────────────────────────────────────
  const svgStr  = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl  = URL.createObjectURL(svgBlob);

  // ── 5. Draw onto an off-screen canvas ────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width  = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasW, canvasH);

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); };
    img.onerror = reject;
    img.src = svgUrl;
  });

  URL.revokeObjectURL(svgUrl);

  // ── 6. Trigger download ───────────────────────────────────────────────────
  const treeName = (state.currentTreeName || 'family-tree')
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();

  const link = document.createElement('a');
  link.download = `${treeName}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
