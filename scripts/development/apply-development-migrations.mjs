import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {sql,config} from './local-database.mjs';
import {sha256,splitSql,leadingCode} from './baseline-source.mjs';
import {schemaFingerprint} from './verify-baseline-schema.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:'pipe',maxBuffer:8*1024*1024}).trim();
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const head=git('rev-parse','HEAD');
// A clean isolated checkout may use a different local branch while the canonical
// integration worktree has unrelated, in-progress changes. The remote commit is
// the authority; never apply from an uncommitted or stale snapshot.
if(git('status','--porcelain'))throw Error('Development migration checkout must be clean');
if(git('ls-remote','origin','refs/heads/integration/development').split(/\s/)[0]!==head)throw Error('Integration HEAD must already be remotely preserved');
const baseline=JSON.parse(sql('select row_to_json(b) from development_metadata.baselines b;'));
if(baseline.id!==config.baselineId)throw Error('Wrong development baseline');
const ledger=JSON.parse(readFileSync('DEVELOPMENT_MIGRATION_LEDGER.json','utf8'));
const requested=process.argv.slice(2);
if(!requested.length)throw Error('Explicit reviewed migration filenames required');
for(const filename of requested){
  if(!/^\d{14}_[a-z0-9_]+\.sql$/.test(filename))throw Error('Invalid canonical migration filename');
  const file=`supabase/migrations/${filename}`,blob=git('rev-parse',`HEAD:${file}`);
  const entries=ledger.migrations.filter(m=>m.file===file&&m.blob===blob);
  if(entries.length!==1||entries[0].developmentApproval!=='VALIDATED_FOR_ISOLATED_DEVELOPMENT')throw Error(`No validated development approval: ${filename}`);
  const source=execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8',maxBuffer:8*1024*1024});
  const digest=sha256(source),version=filename.split('_')[0];
  const applied=JSON.parse(sql("select coalesce(json_agg(m order by applied_at),'[]') from development_metadata.migrations m;"));
  const prior=applied.find(m=>m.version===version);
  if(prior){if(prior.source_digest!==digest||!prior.schema_fingerprint)throw Error('Applied migration checksum/receipt differs');console.log(`Already DEVELOPMENT_APPLIED: ${filename}`);continue;}
  for(const dependency of entries[0].developmentDependsOn||[])if(!applied.some(m=>m.version===dependency)&&!baseline.source_mapping.some(m=>m.version===dependency))throw Error(`Unapplied dependency ${dependency}`);
  if(schemaFingerprint('postgres')!==(applied.at(-1)?.schema_fingerprint||baseline.fingerprint))throw Error('Pre-apply schema drift; no mutation allowed');
  if(splitSql(source).some(s=>/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(leadingCode(s))))throw Error('Top-level transaction controls need explicit migration review');
  // Original, reviewed new migration, not baseline-transformed historical SQL.
  sql(`BEGIN; SELECT pg_advisory_xact_lock(19192026); SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
${source}
INSERT INTO development_metadata.migrations(version,filename,source_digest,source_commit) VALUES (${quote(version)},${quote(file)},${quote(digest)},${quote(head)}); COMMIT;`);
  const fingerprint=schemaFingerprint('postgres');
  sql(`UPDATE development_metadata.migrations SET schema_fingerprint=${quote(fingerprint)} WHERE version=${quote(version)} AND source_digest=${quote(digest)}; NOTIFY pgrst,'reload schema';`);
  console.log(JSON.stringify({filename,status:'DEVELOPMENT_APPLIED',sourceCommit:head,schemaFingerprint:fingerprint,productionAccess:false}));
}
