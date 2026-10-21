import { validateAll } from '../src/lib/content.mjs';
import { getPublicGraph, readOverrides } from '../src/lib/graph.mjs';
import {readLibrary} from '../src/lib/media.mjs';
const content=validateAll();
const media=readLibrary(),known=new Set([...media.items,...media.slots].map(x=>x.id));
for(const row of Object.values(content).flat())for(const lang of ['ru','en'])for(const [,id] of row[`body_${lang}`].matchAll(/\[\[media:([a-z0-9-]+)\]\]/g))if(!known.has(id))throw new Error(`Unknown media ID ${id} in ${row.id}`);
getPublicGraph();readOverrides();
console.log(`Content validated: ${Object.values(content).flat().length} records; bilingual publication gate and graph boundary OK.`);
