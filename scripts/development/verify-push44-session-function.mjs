import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sql} from './local-database.mjs';

// Explicit, isolated LOCAL_SUPABASE only. Every schema/data change rolls back.
// Does not access real device credentials, remote databases or live services.
const migration=readFileSync(new URL('../../supabase/migrations/20261023161928_digital_observer_push44_session_validity.sql',import.meta.url),'utf8');
const user='00000000-0000-4000-8000-000000000f44';
const session='00000000-0000-4000-8000-00000000f444';
const claims=(sub,sid)=>JSON.stringify({sub,session_id:sid,role:'authenticated'});
const query=`BEGIN;
${migration}
INSERT INTO auth.sessions(id,user_id,created_at,updated_at,not_after)
VALUES ('${session}','${user}',now(),now(),now()+interval '1 minute');
SELECT set_config('request.jwt.claims','${claims(user,session)}',true);
SET LOCAL ROLE authenticated;
SELECT public.digital_observer_current_session_active();
SELECT set_config('request.jwt.claims','${claims('00000000-0000-4000-8000-000000000e01',session)}',true);
SELECT public.digital_observer_current_session_active();
SELECT set_config('request.jwt.claims','${claims(user,'malformed')}',true);
SELECT public.digital_observer_current_session_active();
SELECT set_config('request.jwt.claims','${claims(user,session)}',true);
RESET ROLE;
UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id='${session}' AND user_id='${user}';
SET LOCAL ROLE authenticated;
SELECT public.digital_observer_current_session_active();
RESET ROLE;
DELETE FROM auth.sessions WHERE id='${session}' AND user_id='${user}';
SET LOCAL ROLE authenticated;
SELECT public.digital_observer_current_session_active();
RESET ROLE;
SELECT has_function_privilege('anon','public.digital_observer_current_session_active()','EXECUTE');
SELECT has_table_privilege('authenticated','auth.sessions','SELECT');
SELECT provolatile='s' AND prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid='public.digital_observer_current_session_active()'::regprocedure;
ROLLBACK;`;
const values=sql(query).trim().split('\n').filter(line=>line==='t'||line==='f');
assert.deepEqual(values,['t','f','f','f','f','f','f','t']);
console.log(JSON.stringify({status:'PASS',checks:values.length,scope:'isolated Development rollback transaction',productionAccess:false,secretDisclosure:false,permanentMutation:false}));
