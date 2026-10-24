import {z} from 'zod';

// Unmarked text defaults to AI; explicit human authorship takes precedence.
export const authorshipSchema=z.record(z.enum(['human','ai'])).optional();
export const authorshipOf=(record,field)=>record?._authorship?.[field]??'ai';
export function validateAuthorship(value){
  if(!value||typeof value!=='object')return;
  if(!Array.isArray(value)&&value._authorship!==undefined)authorshipSchema.parse(value._authorship);
  for(const [key,child] of Object.entries(value))if(key!=='_authorship')validateAuthorship(child);
}
