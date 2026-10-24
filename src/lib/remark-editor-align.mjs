// A narrow, inert Markdown annotation; arbitrary HTML remains disabled.
export default function editorAlign() {
  return tree => {
    function walk(parent) {
      if (!parent.children) return;
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i];
        const match = node.type === 'html' && /^<!-- editor-align:(left|center|right|justify) -->$/.exec(node.value.trim());
        const next = parent.children[i + 1];
        if (match && next && ['paragraph','heading','blockquote','list','table'].includes(next.type)) {
          next.data = {...next.data, hProperties: {...next.data?.hProperties, align: match[1]}};
          next.position = {...next.position, start: node.position.start};
          parent.children.splice(i--, 1);
        } else walk(node);
      }
    }
    walk(tree);
  };
}
