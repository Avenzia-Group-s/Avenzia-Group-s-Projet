import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublication, verifyPublicApi } from './publish-configured.mjs';
const api='https://api.avenzia.fr';
const config=url=>JSON.stringify({apiUrl:url});
test('normalise une origine HTTPS et accepte un fichier avec BOM',()=>{
  assert.equal(parsePublication('\uFEFF'+config(api+'/')),api);
});
test('refuse les placeholders, localhost, chemins et identifiants intégrés',()=>{
  for(const url of ['https://REMPLACER-ADRESSE-API.invalid','http://localhost:3000','https://127.0.0.1','https://api.exemple.fr',api+'/health',api+'?token=secret','https://user:secret@api.avenzia.fr']){
    assert.throws(()=>parsePublication(config(url)));
  }
});
test('refuse les champs supplémentaires pour éviter de publier des secrets',()=>{
  assert.throws(()=>parsePublication(JSON.stringify({apiUrl:api,token:'secret'})));
});
function requestWithCallback(callback){return async (url,options)=>{
  if(url===api+'/health')return Response.json({ok:true});
  assert.equal(url,api+'/auth/discord/start');
  assert.equal(options.method,'POST');
  assert.match(JSON.parse(options.body).codeChallenge,/^[A-Za-z0-9_-]{43}$/);
  const auth=new URL('https://discord.com/oauth2/authorize');auth.searchParams.set('redirect_uri',callback);
  return Response.json({url:auth.href});
};}
test('vérifie la santé et le callback réellement fourni par le serveur',async()=>{
  assert.equal(await verifyPublicApi(api,requestWithCallback(api+'/auth/discord/callback')),api+'/auth/discord/callback');
});
test('bloque la publication si le serveur renvoie encore son callback local',async()=>{
  await assert.rejects(()=>verifyPublicApi(api,requestWithCallback('http://localhost:19133/auth/discord/callback')),/API_PUBLIC_URL/);
});
test('bloque une API en erreur avant de démarrer une connexion Discord',async()=>{
  let calls=0;await assert.rejects(()=>verifyPublicApi(api,async()=>{calls++;return Response.json({ok:false},{status:503});}),/API doit répondre/);assert.equal(calls,1);
});
