import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {config,sql} from './local-database.mjs';
import {splitSql,leadingCode,sha256} from './baseline-source.mjs';
// Explicitly reviewed non-customer reference contracts only. Never run the
// historical seed corpus, activation/customer backfills or evidence assertions.
const selections=[
 ['20260523001000_production_engines.sql','storage.buckets'],
 ['20260602002000_security_hardening_rls_storage.sql','storage.buckets'],
 ['20260827000100_digital_observer_event_media_evidence.sql','storage.buckets'],
 ['20260913150000_editorial_articles.sql','storage.buckets'],
 ['20260820010000_digital_observer_product_runtime.sql','public.observer_monitoring_packages'],
 ['20260913040000_management_monthly_inspection_workflow.sql','public.inspection_product_settings'],
 ['20260913190000_management_platform_subscription_lifecycle.sql','public.subscription_plans'],
];
const evidence=[],queries=[];
for(const [filename,table] of selections){
 const file=`supabase/migrations/${filename}`;
 const source=execFileSync('git',['show',`${config.sourceIntegrationSha}:${file}`],{encoding:'utf8'});
 const pattern=new RegExp(`^insert into ${table.replaceAll('.','\\.')}[\\s(]`,'i');
 const selected=splitSql(source).map((s,i)=>({sql:s,ordinal:i+1})).filter(s=>pattern.test(leadingCode(s.sql)));
 if(selected.length!==1)throw Error(`Reference selection is ambiguous: ${file}`);
 queries.push(selected[0].sql);evidence.push({file,table,ordinal:selected[0].ordinal,sha256:sha256(selected[0].sql),sourceCommit:config.sourceIntegrationSha});
}
if(sql('select count(*) from development_metadata.baselines;').trim()!=='1')throw Error('Verified isolated baseline required');
sql(`BEGIN;\n${queries.join('\n')}\nNOTIFY pgrst,'reload schema'; COMMIT;`);
writeFileSync('development/database/reference-contracts-receipt.json',JSON.stringify({environment:config.environment,appliedAt:new Date().toISOString(),contracts:evidence,productionAccess:false,externalBillingOrDeliveryActivated:false},null,2)+'\n');
console.log(JSON.stringify({referenceContracts:evidence.length,productionAccess:false}));
