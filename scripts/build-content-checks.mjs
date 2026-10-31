// Content IDs contain lowercase letters, digits and hyphens. A heading such as
// section-the-ai-algorithm is a different ID from the unpublished ai-algorithm.
export const containsPrivateId=(output,id)=>new RegExp(`(?<![a-z0-9-])${id}(?![a-z0-9-])`).test(output);
