export function authorshipCopy(state,lang){
  return state==='ai'
    ?(lang==='ru'?'Текст подготовлен с помощью ИИ. Автор ещё не успел лично просмотреть этот текст или считает использование написанного ИИ оправданным. Если вы не согласны или заметили ошибку, напишите автору.':'This text was prepared with AI. The author has not yet personally reviewed it or considers using AI-written text justified. If you disagree or notice an error, please contact the author.')
    :(lang==='ru'?'Автор отметил, что написал этот текст сам. Если вы заметили ошибку или хотите обсудить текст, напишите автору.':'The author marked this text as written personally. If you notice an error or would like to discuss it, please contact the author.');
}
