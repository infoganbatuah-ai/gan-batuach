"""Disposable q669 rehearsal. Never print keys, ticket envelopes, SQL args or identity values."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sys
import time
import uuid

root = Path(os.environ["Q669_FIXTURE_ROOT"]).resolve()
here = Path(__file__).resolve().parent
assert sys.dont_write_bytecode and here.is_relative_to(root) and root.is_relative_to("/Volumes/DIGITAL_OBSERVER")
sys.path.insert(0,str(root))
from qualify import run, sql, signup, http, qa

lock = (root/"product-key-slice.lock").open("a")
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
assert run(["info","--format","{{.Name}}"]).stdout.strip()=="colima-q669"
containers={"q669-db","q669-auth","q669-rest","q669-storage"}
assert set(run(["ps","-a","--format","{{.Names}}"]).stdout.split())==containers and not run(["ps","-q"]).stdout.strip()
db=run(["inspect","-f","{{.Id}}","q669-db"]).stdout.strip()
for container in containers:
    assert run(["inspect","-f","{{.HostConfig.NetworkMode}} {{len .HostConfig.PortBindings}}",container]).stdout.strip()==("none" if container=="q669-db" else "container:"+db)+" 0"
sha=lambda b:hashlib.sha256(b).hexdigest()
def query(statement):
    result=sql("\\set VERBOSITY verbose\n"+statement,False)
    if result.returncode:
        code=re.search(r"ERROR:\s+([0-9A-Z]{5}):",result.stderr)
        raise RuntimeError("local SQL rejected, SQLSTATE "+(code[1] if code else "unknown"))
    return result.stdout.strip()
def candidate(file):
    data=(here/file).read_bytes()
    assert sha(data)==hashes[file]
    rows=data.decode().splitlines()
    guards=[v for v in rows if v.startswith("do $$ begin raise exception 'REVIEW ONLY:") and v.endswith("end $$;")]
    assert len(guards)==1
    return "\n".join(v for v in rows if v!=guards[0])
hashes={
  "forward.sql":"be2c9ecc4123ecbbb9cfd4a61da2d9ec33fbd849ca012975bb256db4206268f8",
  "rollback.sql":"d4fab2386bcecade92a9242c1ceb9fe1a70a152566b3cefba97bef59ac137433",
  "reader-forward.sql":"667afe19e16fb1979e8a2b730af2cd1b92c71a44ae72ba36c181918cdd7dafad",
  "reader-rollback.sql":"84c8f56213c2b25dceb3b32bd23a282ad4ca71f0ff38233ec488ebdf25254421"}
package={f:candidate(f) for f in hashes}
schema="observer_qa_proof_private"
label="reader-"+uuid.uuid4().hex
stage="preflight"
base=reader=issuer_file=False
def log(line): print(line,flush=True)
try:
    run(["start","q669-db"])
    for _ in range(40):
        if sql("select 1",False).stdout.strip()=="1":break
        time.sleep(.25)
    assert sha(query("select ordinal,version,sha from q669_evidence.registry order by ordinal").encode())=="16129e70cc63f12a8ee3e90db2cca53875596398d418d76ed1631db05cb51a37"
    assert query(f"select to_regnamespace('{schema}') is null and to_regrole('observer_qa_window_reader') is null and to_regprocedure('public.qa_observer_read_window()') is null and not exists(select 1 from auth.sessions)")=="t"
    assert query("select extversion from pg_extension where extname='supabase_vault'")=="0.3.1"
    vault_count=query("select count(*) from vault.secrets")
    run(["start","q669-auth","q669-rest"])
    line="GOTRUE_JWT_ISSUER=http://127.0.0.1:9999"
    run(["exec","-u","0","q669-auth","sh","-ec",'test "$(pwd)" = /; test ! -e /.env; test ! -L /.env; set -C; umask 022; printf "%s\\n" "$1" > /.env',"issuer",line])
    issuer_file=True
    run(["restart","q669-auth"]);qa.health()
    stage="base and reader install";query(package["forward.sql"]);base=True
    query("alter function public.qa_observer_pending_proof(text,text,uuid,uuid,uuid,text,text) set observer_qa_proof.issuer='http://127.0.0.1:9999'")
    query(package["reader-forward.sql"]);reader=True
    query("notify pgrst,'reload schema'")
    actor=signup(label);uid=actor["actor"]
    srv=qa.token("service_role"); rpc="/rpc/qa_observer_read_window"
    def get():
        status,data=http(3000,rpc,"POST",{},srv)
        if status!=200:
            msg=data.get("message","") if isinstance(data,dict) else ""
            reason=msg if re.fullmatch(r"permission denied for (table|function|schema|relation|view) [a-zA-Z0-9_]+",msg) else "details suppressed"
            raise RuntimeError("private reader HTTP "+str(status)+" "+str(data.get("code") if isinstance(data,dict) else "")+" "+reason)
        return data
    stage="ACL and empty window"
    for name in ["anon","authenticated","service_role","observer_qa_window_reader"]:
        assert query(f"select has_function_privilege('{name}','public.qa_observer_read_window()','EXECUTE')")==("t" if name in ["service_role","observer_qa_window_reader"] else "f")
        assert query(f"select has_function_privilege('{name}','{schema}.stage_window(uuid,uuid,uuid,uuid,text,integer)','EXECUTE') or has_function_privilege('{name}','{schema}.close_window(uuid)','EXECUTE')")=="f"
    for token in [None,actor["jwt"]]:
        assert http(3000,rpc,"POST",{},token)[0] in (401,403)
    assert query("select has_table_privilege('observer_qa_window_reader','vault.decrypted_secrets','SELECT')")=="f"
    assert query(f"select has_table_privilege('observer_qa_window_reader','{schema}.windows','UPDATE') or has_table_privilege('observer_qa_window_reader','{schema}.ticket_slots','SELECT')")=="f"
    assert query("select count(*) from pg_auth_members where member='observer_qa_window_reader'::regrole or roleid='observer_qa_window_reader'::regrole")=="0"
    for obj in ["ticket_slots","windows"]:
        assert query(f"select relrowsecurity and relforcerowsecurity from pg_class where oid='{schema}.{obj}'::regclass")=="t"
    assert get() is None
    site,source=str(uuid.uuid4()),str(uuid.uuid4())
    query(f"insert into public.observer_sites(id,name,site_type,owner_profile_id) values('{site}','reader test','home','{uid}'); insert into public.digital_observer_camera_sources(id,observer_site_id,created_by,source_mode,display_name,connector_type,status) values('{source}','{site}','{uid}','sandbox','reader test','rtsp','draft')")
    def stage_for(subject,seconds=120):
        rid=str(uuid.uuid4());digest=secrets.token_hex(32)
        query(f"select {schema}.stage_window('{rid}','{subject}','{site}','{source}','{digest}',{seconds})")
        return rid,digest
    def close(rid): query(f"select {schema}.close_window('{rid}')")
    stage="same-runtime staging"
    first,digest=stage_for(uid)
    envelope=get()
    assert isinstance(envelope,dict) and set(envelope)=={"operator","receiptSecret"}
    assert envelope["operator"]["requestId"]==first and envelope["operator"]["ownerSubject"]==uid
    assert sha(envelope["receiptSecret"].encode())==query(f"select encode(ticket_digest,'hex') from {schema}.windows where request_key='{first}'")
    second,_=stage_for(str(uuid.uuid4()))
    assert get() is None
    close(second);assert get()==envelope
    stage="authenticated caller without server witness"
    payload=dict(request_key=first,target_site=site,target_source=source,key_digest=digest,nonce_hex=secrets.token_hex(32))
    endpoint="/rpc/qa_observer_pending_proof"
    assert http(3000,endpoint,"POST",dict(payload,operation="begin",ticket=envelope["receiptSecret"]),actor["jwt"])==(200,payload["nonce_hex"])
    for absent_or_wrong in [None,secrets.token_hex(32)]:
        assert http(3000,endpoint,"POST",dict(payload,operation="consume",ticket=absent_or_wrong),actor["jwt"])==(200,None)
    assert query(f"select count(*) from {schema}.windows where proved_at is not null")=="0"
    close(first);assert get() is None
    assert http(3000,endpoint,"POST",dict(payload,operation="consume",ticket=envelope["receiptSecret"]),actor["jwt"])==(200,None)
    expired,_=stage_for(uid,1)
    time.sleep(1.2);assert get() is None
    close(expired)
    log("PASS negotiated service-only read; anon and authenticated denied; no reader membership or Vault/table write; empty, staged one, ambiguous two, revoked, expired. Same running API throughout.")
    log("PASS real user session plus known request tuple and nonce cannot consume without the server ticket; revoked ticket denied. Proof timestamps zero; no grant.")
finally:
    try:
        if reader:
            query(package["reader-rollback.sql"])
            assert query("select to_regprocedure('public.qa_observer_read_window()') is null and to_regrole('observer_qa_window_reader') is null")=="t"
            assert query("select count(*) from vault.secrets")==vault_count
        if base:
            query(package["rollback.sql"])
            query(f"alter schema {schema} rename to q669_receipts_{label.split('-')[1]}")
        if issuer_file:
            for raw in query(f"select id from auth.users where email='q669-{label}@qa.invalid'").split():
                user=str(uuid.UUID(raw))
                assert http(9999,"/admin/users/"+user,"PUT",{"ban_duration":"876000h"},qa.token("service_role"))[0]==200
                query(f"update public.profiles set active=false where id='{user}'; update public.digital_observer_camera_sources set status='disabled' where created_by='{user}' and source_mode='sandbox'; delete from auth.sessions where user_id='{user}'")
            assert query("select count(*) from auth.sessions")=="0"
            run(["exec","-u","0","q669-auth","sh","-ec",'test -f /.env; test ! -L /.env; printf "%s\\n" "$1" | cmp -s - /.env; rm /.env',"issuer",line])
    finally:
        for name in ("q669-rest","q669-auth","q669-db"):run(["stop",name])
        assert not run(["ps","-q"]).stdout.strip()
        log("CLEANUP containers stopped; last stage: "+stage)
