// Read the quoted algorithm from the manuscript so the standalone page
// and the full theses always use the same authorial text.
export function aiThesesExcerpt(chapter,lang) {
  const body=chapter?.[`body_${lang}`]||'';
  const point=body.match(/(?:^|\n\n)12\\\.[^\n]*\n\n([\s\S]*?)(?=\n\n13\\\.|$)/)?.[1]?.trim();
  const [open,close]=lang==='ru'?['«','»']:['“','”'];
  if(!point?.startsWith(open)||!point.endsWith(close))throw new Error(`Missing quoted AI algorithm in point 12 (${lang})`);
  return point.slice(1,-1);
}
