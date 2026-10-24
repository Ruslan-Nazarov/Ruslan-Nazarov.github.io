import test from 'node:test';
import assert from 'node:assert/strict';
import {gigaTranslationBody,parseGigaTranslation} from '../scripts/gigachat-format.mjs';
test('GigaChat text translation uses a structured schema with a bounded response',()=>{
  const schema={type:'object',properties:{translations:{type:'array',items:{type:'string'}}},required:['translations']};
  const body=gigaTranslationBody({model:'GigaChat-3-Ultra',input:{field:'Заголовок',segments:['Привет']},instructions:'Translate the supplied segments.',schema,maxTokens:24000});
  assert.equal(body.model,'GigaChat-3-Ultra');assert.equal(body.max_tokens,16000);assert.equal(body.stream,false);assert.equal(body.response_format.strict,true);
  assert.deepEqual(JSON.parse(body.messages[1].content),{field:'Заголовок',segments:['Привет']});assert.ok(!('attachments' in body.messages[1]));assert.ok(!('Authorization' in body));
  assert.throws(()=>gigaTranslationBody({model:'unapproved/endpoint',input:{},instructions:'',schema}));
});
test('truncated, filtered and malformed answers cannot become saved translations',()=>{
  const data={choices:[{finish_reason:'stop',message:{content:'{"translations":["Hello"]}'}}]};
  assert.deepEqual(parseGigaTranslation(data),{translations:['Hello']});
  for(const reason of ['length','blacklist','content_filter',undefined])assert.throws(()=>parseGigaTranslation({choices:[{finish_reason:reason,message:{content:'{"translations":["Partial"]}'}}]}));
  assert.throws(()=>parseGigaTranslation({choices:[{finish_reason:'stop',message:{content:'not JSON'}}]}));
});
