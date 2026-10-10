// Run only against a disposable cloned local database with the GB-M34
// migration already applied. Never point this script at canonical Development
// or Production: its synthetic clock records intentionally commit.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';

const database = process.env.GB_M34_RACE_DATABASE;
assert.equal(database, 'gb_m34_qa', 'Disposable GB-M34 database required');
const args = ['--context', 'colima-gbi', 'exec', '-i', 'supabase_db_gan-batuach-integration',
  'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', database];
const id = (suffix) => `00000000-0000-4000-8000-000000000${suffix}`;
const gardenA = id('601');
const gardenB = id('602');
const staffA = id('301');
const staffB = id('302');
const staffAB = id('303');
const managerB = id('202');

function asActor(actor, statement) {
  return `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${actor}',true); ${statement} COMMIT;`;
}
function call(actor, statement) {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { error += data.toString(); });
    child.on('error', (cause) => resolve({ code: -1, output, error: cause.message }));
    child.on('close', (code) => resolve({ code, output, error }));
    child.stdin.end(asActor(actor, statement));
  });
}
function read(statement) {
  const result = spawnSync('docker', args, { input: statement, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const start = (garden) => `SELECT id FROM public.staff_attendance_transition('${garden}','check_in');`;
const end = (garden) => `SELECT id FROM public.staff_attendance_transition('${garden}','check_out');`;

let race = await Promise.all([call(staffAB, start(gardenA)), call(staffAB, start(gardenB))]);
assert.equal(race.filter((result) => result.code === 0).length, 1, JSON.stringify(race));
assert.equal(race.filter((result) => result.code !== 0).length, 1, JSON.stringify(race));
let state = read(`SELECT garden_id::text FROM public.staff_shifts WHERE staff_profile_id='${staffAB}' AND status='started';`);
assert.ok([gardenA, gardenB].includes(state));
assert.equal((await call(staffAB, end(state))).code, 0);

race = await Promise.all([call(staffA, start(gardenA)), call(staffA, start(gardenA))]);
assert.equal(race.filter((result) => result.code === 0).length, 2, JSON.stringify(race));
assert.equal(new Set(race.map((result) => result.output.trim().split('\n').at(-1))).size, 1);
assert.equal(read(`SELECT count(*) FROM public.staff_shifts WHERE staff_profile_id='${staffA}' AND status='started';`), '1');
race = await Promise.all([call(staffA, end(gardenA)), call(staffA, end(gardenA))]);
assert.equal(race.filter((result) => result.code === 0).length, 2, JSON.stringify(race));
assert.equal(read(`SELECT count(*) FROM public.staff_shifts WHERE staff_profile_id='${staffA}' AND actual_end IS NOT NULL;`), '1');

assert.equal((await call(staffB, start(gardenB))).code, 0);
const shiftB = read(`SELECT id::text FROM public.staff_shifts WHERE staff_profile_id='${staffB}' AND status='started';`);
race = await Promise.all([
  call(staffB, end(gardenB)),
  call(managerB, `SELECT id FROM public.management_correct_staff_shift('${shiftB}',now()-interval '3 hours',now()-interval '1 hour','Synthetic manager correction race');`)
]);
assert.equal(race.filter((result) => result.code === 0).length, 2, JSON.stringify(race));
state = read(`SELECT status||':'||(actual_end IS NOT NULL)::text||':'||(total_minutes>=0)::text FROM public.staff_shifts WHERE id='${shiftB}';`);
assert.equal(state, 'completed:true:true');
assert.equal(read(`SELECT count(*) FROM public.staff_time_corrections WHERE shift_id='${shiftB}' AND action='correct';`), '1');
console.log('GB-M34 separate-connection races PASS: A/B clock, duplicate in/out, correction/out');
