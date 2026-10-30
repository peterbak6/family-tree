import { describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  createStarterProject,
  normalizeLinkTypeList,
  normalizeLinksDirection,
  normalizeProject,
} from './data-model.js';

describe('family tree data model', () => {
  it('creates a usable empty project', () => {
    const project = createEmptyProject();
    const tree = project['default-tree'];

    expect(tree.nodes).toEqual([]);
    expect(tree.links).toEqual([]);
    expect(tree['generation-range']).toEqual({ min: 0, max: 0 });
  });

  it('provides a clear three-generation starter tree', () => {
    const project = createStarterProject();
    const [name] = Object.keys(project);
    const tree = project[name];

    expect(name).toBe('Start here: three generations');
    expect(tree.nodes).toHaveLength(6);
    expect(new Set(tree.nodes.map(node => node.generation))).toEqual(new Set([0, 1, 2]));
    expect(tree.links.some(link => link.type === 'married')).toBe(true);
    expect(tree.links.some(link => link.type === 'father')).toBe(true);
    expect(tree.links.some(link => link.type === 'mother')).toBe(true);
  });

  it('keeps valid colors and rejects unsafe imported color values', () => {
    const types = normalizeLinkTypeList([
      { type: 'safe', color: 'rgba(1, 2, 3, 0.5)' },
      { type: 'unsafe', color: 'red\" onmouseover=\"alert(1)' },
    ]);

    expect(types.find(({ type }) => type === 'safe').color).toBe('rgba(1, 2, 3, 0.5)');
    expect(types.find(({ type }) => type === 'unsafe').color).not.toContain('"');
  });

  it('normalizes imported nodes and generation ranges', () => {
    const project = normalizeProject({
      family: {
        nodes: [{ id: 1, vertical_position: 2, content: 'Ada' }],
        links: [],
      },
    });

    expect(project.family.nodes[0].generation).toBe(2);
    expect(project.family.nodes[0]).not.toHaveProperty('vertical_position');
    expect(project.family['generation-range']).toEqual({ min: 2, max: 2 });
  });

  it('orients parent links from earlier to later generations', () => {
    const tree = {
      nodes: [
        { id: 1, generation: 0 },
        { id: 2, generation: 1 },
      ],
      links: [{ from: 2, to: 1, type: 'father' }],
    };

    normalizeLinksDirection(tree);

    expect(tree.links[0]).toMatchObject({ from: 1, to: 2 });
  });
});
