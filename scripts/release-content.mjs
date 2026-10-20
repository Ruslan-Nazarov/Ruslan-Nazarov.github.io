import { writeFileSync, renameSync } from 'node:fs';
import { validateAll, allContent } from '../src/lib/content.mjs';
validateAll();
const content=allContent();
writeFileSync('src/data/published.json.tmp',JSON.stringify(content,null,2)+'\n');
renameSync('src/data/published.json.tmp','src/data/published.json');
console.log('Saved the complete bilingual public versions. Incomplete translations retain their previous version.');
