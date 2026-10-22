import {z} from 'zod';

// Absence means unknown; never infer authorship of existing content.
export const authorshipSchema=z.record(z.enum(['human','ai'])).optional();
export const authorshipOf=(record,field)=>record?._authorship?.[field];
export function validateAuthorship(value){
  if(!value||typeof value!=='object')return;
  if(!Array.isArray(value)&&value._authorship!==undefined)authorshipSchema.parse(value._authorship);
  for(const [key,child] of Object.entries(value))if(key!=='_authorship')validateAuthorship(child);
}
