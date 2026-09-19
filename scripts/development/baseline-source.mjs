import {createHash} from 'node:crypto';
export const sha256 = value => createHash('sha256').update(value).digest('hex');

// Split top-level PostgreSQL statements, retaining function/DO bodies intact.
// Fail closed on unterminated quoted strings/comments rather than guessing.
export function splitSql(sql) {
  const result=[];let start=0,quote=null,dollar=null,comment=0,line=false;
  for(let i=0;i<sql.length;i++) {
    const c=sql[i],n=sql[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(comment){if(c==='/'&&n==='*'){comment++;i++;}else if(c==='*'&&n==='/'){comment--;i++;}continue;}
    if(dollar){if(sql.startsWith(dollar,i)){i+=dollar.length-1;dollar=null;}continue;}
    if(quote){if(c===quote){if(n===quote)i++;else quote=null;}else if(c==='\\'&&quote==="'")i++;continue;}
    if(c==='-'&&n==='-'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){comment=1;i++;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}
    if(c==='$'){const match=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/);if(match){dollar=match[0];i+=dollar.length-1;continue;}}
    if(c===';'){result.push(sql.slice(start,i+1));start=i+1;}
  }
  if(quote||dollar||comment)throw Error('Unterminated SQL lexical structure');
  if(sql.slice(start).trim())result.push(sql.slice(start));
  return result;
}

export function leadingCode(sql) {
  return sql.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/,'').trim();
}

export function deriveSchemaStatements(file, source) {
  return splitSql(source).map((original,index)=>{
    const code=leadingCode(original),kind=code.match(/^[a-z]+/i)?.[0]?.toUpperCase()||'COMMENT';
    let sql=original,action='INCLUDE_SCHEMA',reason='Preserved source schema/security statement';
    if(['COMMENT'].includes(kind)&&!code){action='OMIT_COMMENT';reason='No executable SQL';}
    else if(['BEGIN','COMMIT','END','ROLLBACK','SAVEPOINT','RELEASE'].includes(kind)){action='OMIT_TRANSACTION';reason='Builder commits DDL statements independently; enum addition must commit before use. Baseline dump later contains final enum.';}
    else if(['INSERT','UPDATE','DELETE','WITH','SELECT','TRUNCATE'].includes(kind)){action='OMIT_HISTORICAL_DATA';reason='No historical fixture/customer/backfill/activation data enters clean schema baseline. Required synthetic/reference seeds are separate reviewed contracts.';}
    else if(kind==='DO'&&file.startsWith('20260902043000_')){action='OMIT_PRODUCTION_ACTIVATION';reason='Site-specific channel activation and live-consent checks are not development schema; no fabricated authorization.';}
    else if(kind==='DO'&&file.startsWith('20260902033000_')&&code.includes('Authorized camera scope is incomplete or unhealthy')){action='OMIT_PRODUCTION_ACTIVATION';reason='Live camera precondition only; retain schema functions, trigger and command guards unchanged.';}
    else if(kind==='DO'&&file.startsWith('20260901010500_')&&code.includes('immutable_audit_pgcrypto_self_test_failed')){action='OMIT_HISTORICAL_DATA';reason='Historical transactional fixture assertion excluded with its rolled-back fixture rows; audit hash function unchanged and must be separately QA tested.';}
    else if(kind==='DO'&&file.startsWith('20260612015700_')&&/insert into public\.(security_pipeline_controls|security_pipeline_findings|security_readiness_checks|audit_event_catalog)/i.test(code)){action='OMIT_HISTORICAL_DATA';reason='Optional historical security-readiness fixture rows are not current verification evidence.';}
    else if(kind==='DO'&&file.startsWith('20260820000100_')&&code.includes('update public.database_storage_bucket_audit')){action='OMIT_HISTORICAL_DATA';reason='Historical audit row update excluded; actual storage policies retained and tested.';}
    else if(kind==='DO'&&file.startsWith('20260612016500_')&&/update public\.skeleton_observer_events/i.test(code)){action='OMIT_HISTORICAL_DATA';reason='Historical shadow-event backfill has no rows in clean development schema; constraints and authorization functions remain unchanged.';}
    else if(!['CREATE','ALTER','DROP','GRANT','REVOKE','COMMENT','DO','SET','NOTIFY'].includes(kind)){throw Error(`Unclassified statement ${file} #${index+1} ${kind}`);}
    if(action==='INCLUDE_SCHEMA'&&file==='20260523012000_qa_action_persistence.sql'&&sql.includes('alter typeש')){sql=sql.replace('alter typeש','alter type');reason='Explicit baseline-only syntax normalization of historical typo; source file preserved';}
    return {ordinal:index+1,kind,action,reason,sourceSha256:sha256(original),derivedSha256:action==='INCLUDE_SCHEMA'?sha256(sql):null,sql:action==='INCLUDE_SCHEMA'?sql:null};
  });
}
