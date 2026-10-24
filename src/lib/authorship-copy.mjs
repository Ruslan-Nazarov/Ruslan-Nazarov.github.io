import ui from '../data/ui.json' with {type:'json'};
export function authorshipCopy(state,lang){return ui[lang][state==='ai'?'authorshipAI':'authorshipHuman']}
