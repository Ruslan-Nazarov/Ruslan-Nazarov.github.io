// Pure request/response formatting: no credentials, files or network access.
export function gigaTranslationBody({model,input,instructions,schema,maxTokens=4000}){
  if(!/^GigaChat-[a-zA-Z0-9-]+$/.test(model))throw new Error('Invalid GigaChat model');
  return {model,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(input)}],stream:false,max_tokens:Math.min(maxTokens,16000),temperature:0.1,response_format:{type:'json_schema',schema,strict:true}};
}
export function parseGigaTranslation(data){
  const choice=data?.choices?.[0];
  if(choice?.finish_reason!=='stop'||typeof choice.message?.content!=='string')throw new Error('Incomplete GigaChat answer');
  return JSON.parse(choice.message.content);
}
