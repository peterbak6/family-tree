# Family Tree Editor

A modern, interactive family tree visualization tool built with vanilla JavaScript and D3.js.

## Features

✨ **Interactive Visualization**
- Drag-and-drop node positioning
- Zoom and pan canvas
- Click-to-edit inline editing
- Beautiful, color-coded generations

🔗 **Flexible Relationships**
- Father/mother parent-child links
- Marriage connections
- Custom relationship types
- Visual link type filtering

💾 **Data Persistence**
- Auto-save to localStorage
- Import/export JSON files
- Resume where you left off

🎨 **Modern UI**
- Clean, gradient background
- Smooth animations
- Responsive toolbar
- Keyboard shortcuts

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Usage

1. **Start Fresh**: The app opens with an empty tree or your last session
2. **Import Data**: Click "Import" to load a JSON file
3. **Add Nodes**: Click the "+" on generation axes to add people
4. **Create Links**: Drag from the connector dot on one node to another
5. **Edit Content**: Click a node twice or use the edit button
6. **Auto-save**: Your work is automatically saved to localStorage

## Deployment

### Cloudflare Pages (Automatic)

Push to `main` branch triggers automatic deployment via GitHub Actions.

**Setup**:
1. Create Cloudflare Pages project named `family-tree-editor`
2. Add secrets to GitHub repository settings:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Push to main branch

The site will be automatically built and deployed.

## Architecture

Built with modern vanilla JavaScript and modular design:
- **Core**: Data models, layout algorithm, state management
- **Rendering**: D3.js-based SVG visualization
- **Interactions**: Drag, edit, link creation handlers
- **UI**: Toolbar and menu components
- **I/O**: JSON import/export and localStorage
- **Styles**: Modular CSS with modern design

## License

MIT
a new way of creating family trees
