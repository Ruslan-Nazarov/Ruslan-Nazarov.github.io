import { validateAll } from '../src/lib/content.mjs';
import { getPublicGraph, readOverrides } from '../src/lib/graph.mjs';
const content=validateAll();
getPublicGraph();readOverrides();
console.log(`Content validated: ${Object.values(content).flat().length} records; bilingual publication gate and graph boundary OK.`);
