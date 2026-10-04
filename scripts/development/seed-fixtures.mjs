import {readFileSync} from 'node:fs';
import {sql} from './local-database.mjs';
if(sql("select count(*) from development_metadata.migrations where version='20260919170000' and schema_fingerprint is not null;").trim()!=='1')throw Error('Validated classroom trigger fix must first be integrated/applied');
if(sql("select count(*) from public.gardens where id in ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000602');").trim()!=='0')throw Error('Fixtures already exist; verify them, do not overwrite');
const fixtures=readFileSync('development/database/qa-fixtures.sql','utf8');
sql(`BEGIN;\n${fixtures}\nCOMMIT;`);
console.log('Synthetic development fixtures created with all security triggers enabled.');
