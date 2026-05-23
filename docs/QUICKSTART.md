# Quick Start Guide

## First Time Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/family-tree.git
cd family-tree

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000`

## Development Workflow

### Running the Dev Server

```bash
npm run dev
```

Auto-reloads on file changes. Press `q` or `Ctrl+C` to stop.

### Building for Production

```bash
npm run build
```

Output goes to `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

Tests the production build locally at `http://localhost:4173`

## Project Structure

```
family-tree/
├── src/
│   ├── core/              # Core logic (data, layout, state)
│   ├── rendering/         # D3.js visualization
│   ├── interactions/      # User interactions
│   ├── ui/                # UI components
│   ├── io/                # Import/export
│   ├── utils/             # Utilities
│   ├── styles/            # CSS modules
│   └── main.js            # App entry point
├── public/                # Static assets
├── docs/                  # Documentation
├── index.html             # HTML template
└── vite.config.js         # Build configuration
```

## Making Changes

### Adding a New Feature

1. Create necessary modules in `src/`
2. Import and integrate in `src/main.js`
3. Add styles if needed in `src/styles/`
4. Test in dev mode
5. Build and verify

### Modifying Styles

All CSS is in `src/styles/`:
- `base.css` - Variables and resets
- `layout.css` - App layout
- `toolbar.css` - Toolbar components
- `visualization.css` - SVG styles
- `animations.css` - Animations

### Updating the Layout Algorithm

The layout engine is in `src/core/layout-engine.js`. It uses a Sugiyama-inspired algorithm. Modify carefully and test thoroughly.

## Testing

### Manual Testing Checklist

- [ ] Import example JSON
- [ ] Add new nodes via axis buttons
- [ ] Drag nodes to reorder
- [ ] Create links by dragging connector dots
- [ ] Edit node content inline
- [ ] Delete nodes and links
- [ ] Toggle link type visibility
- [ ] Add custom link types
- [ ] Export modified tree
- [ ] Refresh page (localStorage should restore)
- [ ] Zoom and pan
- [ ] Fit view button

### Test with Example Data

```bash
# The example file is in public/example.json
# Click Import and select this file
```

## Common Tasks

### Change Default Colors

Edit `src/utils/constants.js`:
- `generationColors` - Node background colors
- `linkTypeColorPalette` - Link type colors

### Modify Node Size

Edit `src/utils/constants.js`:
- `NODE_W` - Node width
- `NODE_H` - Node height

### Adjust Layout Spacing

Edit `src/utils/constants.js`:
- `X_GAP` - Horizontal generation spacing
- `SPOUSE_PAD` - Spacing between married nodes
- `SIBLING_PAD` - Spacing between siblings
- `GROUP_PAD` - Spacing between family groups

### Add New Keyboard Shortcuts

Add event listeners in `src/main.js` `init()` method.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions.

Quick deploy to GitHub Pages:

```bash
npm run build
git add dist -f
git commit -m "Deploy"
git subtree push --prefix dist origin gh-pages
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### D3.js Issues

Make sure D3 v7+ is installed:
```bash
npm list d3
```

### LocalStorage Not Working

Check browser settings - localStorage must be enabled.
Clear if corrupted:
```javascript
localStorage.clear()
```

## Getting Help

- Check GitHub Issues
- Review the code comments
- D3.js docs: https://d3js.org/
- Vite docs: https://vitejs.dev/

## Tips

- Use Chrome DevTools for debugging SVG
- Console logs state changes automatically
- Auto-save happens 1 second after changes
- Hold Cmd+Click on a node to quick-edit
- Escape key closes inline editors
