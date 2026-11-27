import assert from 'node:assert/strict';
import {test} from 'node:test';
import {evaluateSnapshot} from './provision-parent-new-enrollment-fixture-20261107.mjs';

const child='00000000-0000-4000-8000-000000004905';
const parent='00000000-0000-4000-8000-000000000101';
const empty=()=>({parent_ready:true,identity_nullable:true,canonical_trigger:true,
  garden_ready:true,matching_rooms:2,file:null,link_count:0,exact_link:false,requests:0,enrollments:0});
const exact=()=>({...empty(),file:{id:child,full_name:'QA Enrollment Test Child',
  primary_parent_profile_id:parent,birth_date:'2023-03-12',identity_number:null,
  source:'qa_parent_enrollment',owner_status:'active',is_demo:true,
  demo_batch_id:'parent-new-enrollment-20261107'},link_count:1,exact_link:true});

test('empty fixed fixture admits exactly one file',()=>assert.equal(evaluateSnapshot(empty()),'CREATE_ONE_FILE'));
test('exact fixture is idempotent',()=>assert.equal(evaluateSnapshot(exact()),'EXISTING_EXACT'));
test('refuses replacement or mismatched owner',()=>{
  assert.throws(()=>evaluateSnapshot({...exact(),file:{...exact().file,full_name:'Other'}}));
  assert.throws(()=>evaluateSnapshot({...exact(),file:{...exact().file,primary_parent_profile_id:'00000000-0000-4000-8000-000000000102'}}));
});
test('refuses missing, foreign or duplicate guardian link',()=>{
  assert.throws(()=>evaluateSnapshot({...exact(),link_count:0,exact_link:false}));
  assert.throws(()=>evaluateSnapshot({...exact(),link_count:1,exact_link:false}));
  assert.throws(()=>evaluateSnapshot({...exact(),link_count:2}));
});
test('refuses requests, enrollment or an orphan link before creation',()=>{
  assert.throws(()=>evaluateSnapshot({...empty(),requests:1}));
  assert.throws(()=>evaluateSnapshot({...empty(),enrollments:1}));
  assert.throws(()=>evaluateSnapshot({...empty(),link_count:1}));
});
test('refuses absent allowlisted Parent, nullable identity, canonical trigger or ready Garden',()=>{
  for(const key of ['parent_ready','identity_nullable','canonical_trigger','garden_ready'])
    assert.throws(()=>evaluateSnapshot({...empty(),[key]:false}),key);
  assert.throws(()=>evaluateSnapshot({...empty(),matching_rooms:0}));
});
