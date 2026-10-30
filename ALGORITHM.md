# Family Tree Layout Algorithm

## Purpose

The layout engine turns a graph of people and relationships into a readable
left-to-right family tree. Generations occupy vertical axes: earlier
generations appear on the left and later generations on the right.

The implementation is in `src/core/layout-engine.js`. Peter Bak designed and
developed the family-specific positioning process described below. The engine
uses the independently licensed Dagre library for an initial crossing-reduced
ordering and D3 for numeric utilities; Dagre and D3 are not claimed as original
parts of this algorithm.

## Inputs and invariants

Each person has a stable ID, a generation number, and display content. Links
describe parent-child, marriage, or custom relationships. Parent direction is
normalized by generation, so an earlier-generation endpoint is treated as the
parent even when an imported link is reversed.

The engine works on copies of nodes and links. Stable sorting by generation,
name, ID, relationship type, and source index prevents insertion order from
producing arbitrary layouts.

## Layout process

1. **Classify relationships.** Father, mother, and cross-generation default
   links define parent-child structure. Marriage-like links define couples.
2. **Build family indexes.** The engine records incoming parents and outgoing
   children and groups siblings that share any parent.
3. **Establish generation order.** Dagre receives only normalized parent-child
   edges and proposes a crossing-reduced order within each generation.
4. **Keep couples together.** Same-generation spouses are moved next to one
   another while preserving Dagre's ordering as far as possible.
5. **Seed compact positions.** Every generation is packed from the top using
   distinct spacing for spouses, siblings, and unrelated family groups.
6. **Bottom-up positioning.** Each couple or parent block is centered over the
   midpoint of its combined children. The generation is repacked to prevent
   overlap.
7. **Top-down positioning.** Children move toward the mean position of their
   parents. Leaf nodes move more strongly; intermediate nodes move partially
   to balance their ancestors and descendants.
8. **Iterate and normalize.** Alternating bottom-up and top-down passes converge
   toward a balanced tree. A final packing pass removes overlaps, and all
   coordinates are shifted into stable canvas bounds.

## Design goals

- Keep spouses adjacent.
- Keep siblings visually grouped.
- Center parents over their children where space permits.
- Reduce relationship crossings without surrendering family semantics.
- Produce deterministic output independent of JSON insertion order.
- Support pedigree collapse, remarriage, multiple parents, and custom links.

## Authorship and licensing

The repository's Git history records the development of the layout engine.
The current algorithm documentation and implementation are published as part
of Family Tree Editor version 1.0.0. The project is also presented on
[Visual Analytics by Peter Bak](https://visualanalytics.co.il/familiytree).

The Layout Algorithm is governed by the restrictions in `LICENSE`. It may be
used and modified as part of Family Tree Editor, but it may not be extracted,
ported, repackaged, or used as the basis of another product or standalone
component without a separate written license from Peter Bak.