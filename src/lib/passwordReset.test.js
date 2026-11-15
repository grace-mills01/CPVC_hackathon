import test from 'node:test';
import assert from 'node:assert/strict';
import {resetRedirect, requestPasswordReset, updatePassword} from './passwordReset.js';
test('email request uses current app URL with no old query or token',async()=>{
 let call;
 const auth={resetPasswordForEmail:async(...args)=>{call=args;return {error:null}}};
 await requestPasswordReset(auth,' person@example.com ',{href:'https://togo.example/app?old=1#access_token=secret'});
 assert.deepEqual(call,['person@example.com',{redirectTo:'https://togo.example/app?reset=1'}]);
 assert.equal(resetRedirect({href:'http://localhost:5173/'}),'http://localhost:5173/?reset=1');
});
test('mismatched and short passwords never reach Supabase',async()=>{
 let calls=0;const auth={updateUser:async()=>{calls++;return {error:null}}};
 await assert.rejects(updatePassword(auth,'abcdef','abcdeg'),/do not match/);
 await assert.rejects(updatePassword(auth,'short','short'),/at least 6/);
 assert.equal(calls,0);
});
test('matching password updates the authenticated user; errors are surfaced',async()=>{
 let payload;
 await updatePassword({updateUser:async(data)=>{payload=data;return {error:null}}},'new-password','new-password');
 assert.deepEqual(payload,{password:'new-password'});
 await assert.rejects(updatePassword({updateUser:async()=>({error:new Error('Expired session')})},'new-password','new-password'),/Expired session/);
 await assert.rejects(requestPasswordReset({resetPasswordForEmail:async()=>({error:new Error('Rate limit')})},'person@example.com',{href:'https://togo.example/'}),/Rate limit/);
});
