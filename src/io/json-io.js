import { normalizeProject } from '../core/data-model.js';

/**
 * Import JSON file
 */
export function importJSON(file, onSuccess, onError) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const normalized = normalizeProject(data);
      onSuccess(normalized);
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      onError?.(error);
    }
  };

  reader.onerror = () => {
    console.error('Failed to read file');
    onError?.(new Error('Failed to read file'));
  };

  reader.readAsText(file);
}

/**
 * Export project as JSON file
 */
export function exportJSON(project, filename = 'family-tree.json') {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
