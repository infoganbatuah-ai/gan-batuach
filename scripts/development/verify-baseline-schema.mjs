import {sql,docker,config} from './local-database.mjs';
import {sha256,splitSql,leadingCode} from './baseline-source.mjs';
export function schemaStatements(database) {
  // Realtime creates and retires date partitions as an operational service
  // concern. They are not repository migration state and would otherwise make
  // the Product schema fingerprint change merely because the calendar moved.
  const dump=docker(['exec',config.container,'pg_dump','-U','supabase_admin','-d',database,'--schema-only','--no-owner','--exclude-schema=development_metadata','--exclude-schema=realtime']).replace(/^\\(?:un)?restrict .+\n/gm,'');
  return splitSql(dump).map(leadingCode).filter(Boolean);
}
export function schemaFingerprint(database) { return sha256(schemaStatements(database).sort().join('\n')); }
// PostgreSQL may flatten nested AND trees while restoring a CHECK expression.
// Validate only those differences through the server's own expression planner;
// permissions, policies, functions and every other statement must match exactly.
export function verifyBaselineSchema() {
  const a=schemaStatements('postgres'),b=schemaStatements(config.builderDatabase);
  const aa=new Set(a),bb=new Set(b),extra=a.filter(s=>!bb.has(s)),missing=b.filter(s=>!aa.has(s));
  if(extra.length!==missing.length)throw Error(`Schema drift: ${extra.length} extra / ${missing.length} missing statements`);
  let checksVerified=0;
  for(const original of missing){
    const table=original.match(/^CREATE TABLE (public\.[A-Za-z_0-9]+) \(/)?.[1];
    const current=extra.find(s=>table&&s.startsWith(`CREATE TABLE ${table} (`));
    if(!table||!current)throw Error(`Non-CHECK schema drift: ${original.split('\n')[0]}`);
    const get=database=>JSON.parse(sql(`SELECT coalesce(json_agg(json_build_object('name',conname,'definition',pg_get_constraintdef(oid),'expression',pg_get_expr(conbin,conrelid)) ORDER BY conname),'[]') FROM pg_constraint WHERE conrelid='${table}'::regclass AND contype='c';`,{database}));
    const before=get(config.builderDatabase),after=get('postgres');
    if(JSON.stringify(before.map(c=>c.name))!==JSON.stringify(after.map(c=>c.name)))throw Error(`CHECK inventory differs: ${table}`);
    let left=original,right=current;
    for(let i=0;i<before.length;i++){
      const x=before[i],y=after[i];
      const explain=(database,expression)=>JSON.parse(sql(`EXPLAIN (VERBOSE,FORMAT JSON,COSTS OFF) SELECT (${expression}) AS checked_value FROM ${table};`,{database}))[0].Plan.Output;
      if(JSON.stringify(explain(config.builderDatabase,x.expression))!==JSON.stringify(explain('postgres',y.expression)))throw Error(`CHECK semantics differ: ${table}.${x.name}`);
      left=left.replace(x.definition,`CHECK_VERIFIED_${x.name}`);right=right.replace(y.definition,`CHECK_VERIFIED_${y.name}`);checksVerified++;
    }
    if(left!==right)throw Error(`Table definition differs outside CHECK expressions: ${table}`);
  }
  return {status:'PASS',exactMatchingStatements:a.length-extra.length,restoredCheckTables:extra.length,checksVerified,canonicalFingerprint:schemaFingerprint('postgres'),builderFingerprint:schemaFingerprint(config.builderDatabase)};
}
