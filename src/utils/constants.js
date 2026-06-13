// Layout constants
export const NODE_W = 220;
export const NODE_H = 58;
export const SPOUSE_PAD = 5;
export const SIBLING_PAD = 10;
export const GROUP_PAD = 42;
export const X_GAP = 630;
export const TOP_MARGIN = 120;
export const LEFT_MARGIN = 190;

// Colors - Using ColorBrewer Set3 for nodes/axes (50% transparency) and Dark2 for links (50% transparency)
export const generationColors = [
  "rgba(141, 211, 199, 0.5)", "rgba(255, 255, 179, 0.5)", "rgba(190, 186, 218, 0.5)",
  "rgba(251, 128, 114, 0.5)", "rgba(128, 177, 211, 0.5)", "rgba(253, 180, 98, 0.5)",
  "rgba(179, 222, 105, 0.5)", "rgba(252, 205, 229, 0.5)", "rgba(217, 217, 217, 0.5)",
  "rgba(188, 128, 189, 0.5)", "rgba(204, 235, 197, 0.5)", "rgba(255, 237, 111, 0.5)"
];

export const linkTypeColorPalette = [
  "rgba(27, 158, 119, 0.5)", "rgba(217, 95, 2, 0.5)", "rgba(117, 112, 179, 0.5)",
  "rgba(231, 41, 138, 0.5)", "rgba(102, 166, 30, 0.5)", "rgba(230, 171, 2, 0.5)",
  "rgba(166, 118, 29, 0.5)", "rgba(102, 102, 102, 0.5)"
];

// Default link types - using Dark2 colors with 50% transparency
export const defaultLinkTypes = [
  { type: "default", label: "default", color: "rgba(102, 102, 102, 0.5)" },
  { type: "father", label: "father", color: "rgba(27, 158, 119, 0.5)" },
  { type: "mother", label: "mother", color: "rgba(231, 41, 138, 0.5)" },
  { type: "married", label: "married", color: "rgba(117, 112, 179, 0.5)" }
];
