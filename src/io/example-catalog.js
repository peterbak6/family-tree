const EXAMPLE_PROJECTS = [
  'confucius-kong.json',
  'habsburgs.json',
  'maria-theresa.json',
  'queen-victoria.json'
];

export async function loadExampleTrees() {
  const projects = await Promise.all(EXAMPLE_PROJECTS.map(async filename => {
    const response = await fetch(`${import.meta.env.BASE_URL}examples/${filename}`);
    if (!response.ok) {
      throw new Error(`Could not load ${filename}`);
    }
    return response.json();
  }));

  return Object.assign({}, ...projects);
}