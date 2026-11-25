"""Offline by default. See --help. Live mode requires separate authorization for
an existing disposable q669_pair_rehearsal, reviewed file digests, the installed
#669 writer/owner policies and exclusive use of the fixture. The parent owns its
lifecycle. This runner leaves the successful synthetic records as rollback evidence.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time
from uuid import UUID, uuid4


HERE = Path(__file__).resolve().parent
DB = "q669_pair_rehearsal"
CALLER = "observer_site_save_caller"
EXECUTOR = "observer_site_save_executor"
PRIVATE = "observer_site_save_private"
PIN = PRIVATE + ".pair_pin"
HISTORY = PRIVATE + ".pair_receipts"
SOURCE = "public.digital_observer_camera_sources"
RPC = "public.submit_qa_site_source_pair"
PAIR = RPC + "(uuid,uuid,bigint,uuid,text)"
WRITER = "public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)"
REGISTRY = "16129e70cc63f12a8ee3e90db2cca53875596398d418d76ed1631db05cb51a37"
DOCKER_ROOT = "/Volumes/DIGITAL_OBSERVER/q669.4RKaJO"
CLIENT = ["docker", "--config", DOCKER_ROOT + "/d", "--host",
          "unix://" + DOCKER_ROOT + "/c/q669/docker.sock", "exec", "-i", "q669-db",
          "psql", "-X", "-qAtw", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
          "-h", "/var/run/postgresql", "-p", "5432", "-U", "supabase_admin", "-d", DB]
GUARDS = {"forward": "isolated pair qualification required",
          "rollback": "confirm isolated pair rollback target"}
SESSION_MIGRATION = "20261023161928_digital_observer_push44_session_validity.sql"
SESSION_FILE_SHA = "0bf048622b6ba39c0412bfbd4bf410a3b2955b8fba292621f32592acaa309249"

# Executed by every psql connection before any supplied statement, including cleanup.
BOUNDARY = f"""
do $target$ begin
  if current_database() <> '{DB}' or session_user <> 'supabase_admin'
     or inet_server_addr() is not null or current_setting('session_replication_role') <> 'origin'
     or (select count(*) <> 276 or encode(sha256(convert_to(
         string_agg(ordinal||'|'||version||'|'||sha,E'\\n' order by ordinal),'UTF8')),'hex')
         is distinct from '{REGISTRY}' from q669_evidence.registry)
  then raise exception using errcode='Q6600',message='WRONG_FIXTURE'; end if;
end $target$;
set statement_timeout='30s';
set idle_in_transaction_session_timeout='45s';
set timezone='UTC';
"""


class Failure(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Failure(reason)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def package(kind, expected):
    path = HERE / f"pair-{kind}.sql"
    require(not path.is_symlink(), f"{kind} artifact is a symlink")
    raw = path.read_bytes()
    if expected is not None:
        require(digest(raw) == expected, f"{kind} reviewed digest mismatch")
    src = raw.decode("utf-8")
    stop = f"do $$ begin raise exception 'REVIEW ONLY: {GUARDS[kind]}'; end $$;"
    header = f"begin;\n{stop}\n-- BEGIN PAIR {kind.upper()}\n"
    prefix, found, body = src.partition(header)
    require(found and all(line.startswith("--") or not line.strip() for line in prefix.splitlines())
            and src.count(stop) == 1 and src.count("-- BEGIN PAIR ") == 1
            and body.rstrip().endswith("\ncommit;"), f"{kind} transaction or guard changed")
    require("\\" not in src and not re.search(
        r"(?im)^\s*(?:begin;|commit;|rollback;|(?:create|alter|drop)\s+(?:role|user|database|tablespace)\b"
        r"|alter\s+system\b|copy\b|(?:grant|revoke)\s+\w+\s+(?:to|from)\b)", body.rstrip()[:-7]),
        f"{kind} contains unexpected client, transaction or cluster control")
    return src, "begin;\n" + body, digest(raw)


def checked_result(step, proc, expected=(), marker=None):
    if proc.returncode == 0:
        require(not expected, step + " unexpectedly succeeded")
        return proc.stdout.strip()
    match = re.search(r"ERROR:\s+([0-9A-Z]{5}):\s*([^\n]*)", proc.stderr)
    state, message = match.groups() if match else ("unknown", "")
    if state in expected and (marker is None or message == marker):
        return ""
    # Never echo arbitrary exception text, SQL, row details, UUIDs, or claim values.
    safe = re.fullmatch(r"(?:[A-Z][A-Z_0-9]{3,75}|permission denied for (?:table|schema|function) [a-z_]{1,64})", message)
    raise Failure(f"{step} failed (SQLSTATE {state}" + (", " + message if safe else "") + ")")


def sql(step, statement, expected=(), marker=None):
    try:
        proc = subprocess.run(CLIENT, input=BOUNDARY + statement + "\n", text=True,
                              capture_output=True, timeout=45, check=False)
    except subprocess.TimeoutExpired:
        raise Failure(step + " timed out") from None
    return checked_result(step, proc, expected, marker)


def truth(step, expression):
    require(sql(step, "select " + expression) == "t", step)


def uuid_value(raw):
    try:
        return str(UUID(raw))
    except (TypeError, ValueError, AttributeError):
        raise Failure("expected a fixture UUID") from None


def tx(body, commit=False):
    return "begin;\n" + body + ("\ncommit;" if commit else "\nrollback;")


def role(name, claims):
    return f"set local role {name}; set local request.jwt.claims='{json.dumps(claims)}';\n"


def records(tables):
    # Keep row values inside Postgres. Preserve multiplicity, including rows with no PK.
    selects = [f"select '{t}', encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex') from {t} r"
               for t in tables]
    rows = sql("fingerprint durable records", " union all ".join(selects))
    return Counter(rows.splitlines())


DATA = ["public." + t for t in (
    "observer_sites", "digital_observer_camera_sources", "observer_site_memberships",
    "observer_site_onboarding_drafts", "observer_monitoring_schedules", "observer_site_subscriptions",
    "digital_observer_entitlement_grants", "digital_observer_financial_audit",
    "digital_observer_checkout_intents", "digital_observer_payment_events",
    "digital_observer_billing_accounts", "digital_observer_refunds", "digital_observer_provider_callbacks",
    "digital_observer_accounts", "profiles", "observer_monitoring_packages", "camera_streams",
    "digital_observer_camera_automation_policies",
)] + [PRIVATE + ".receipts", "auth.users", "auth.sessions"]


def catalog():
    # Only the named retained history relation and its own indexes/attributes,
    # constraints and internal FK triggers may remain as new objects after withdrawal.
    scope = "n.nspname in ('auth','public','observer_site_save_private','q669_evidence')"
    retained = f"coalesce(to_regclass('{HISTORY}')::oid,0)"
    tables = (f"from pg_class c join pg_namespace n on n.oid=c.relnamespace where {scope} "
              f"and c.oid <> {retained} and not exists(select from pg_index i "
              f"where i.indexrelid=c.oid and i.indrelid={retained})")
    queries = {
        "relations": "select c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity " + tables,
        "attributes": "select c.oid,a.attnum,a.attname,a.atttypid,a.attnotnull,coalesce(a.attacl,'{}') "
                      + tables.replace(" where ", " join pg_attribute a on a.attrelid=c.oid where ", 1)
                      + " and a.attnum>0 and not a.attisdropped",
        "functions": f"select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where {scope}",
        "schemas": f"select n.* from pg_namespace n where {scope}",
        "policies": "select * from pg_policies",
        "roles": "select oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles",
        "memberships": "select * from pg_auth_members",
        "default grants": "select * from pg_default_acl",
        "constraints": f"select oid,conrelid,conname,pg_get_constraintdef(oid) from pg_constraint "
                       f"where conrelid <> {retained} or conrelid=0",
        "triggers": f"select t.oid,t.tgenabled,pg_get_triggerdef(t.oid) from pg_trigger t "
                    f"where not exists(select from pg_constraint k where k.oid=t.tgconstraint "
                    f"and k.conrelid={retained})",
    }
    parts = [f"select '{name}',encode(sha256(convert_to(coalesce(string_agg(v,E'\\n' order by v),''),'UTF8')),'hex') "
             f"from (select row_to_json(r)::text v from ({query}) r) rows" for name, query in queries.items()]
    return sql("fingerprint catalog", " union all ".join(parts))


def preflight():
    truth("pair objects absent and #669 caller present",
          f"to_regprocedure('{PAIR}') is null and to_regclass('{PIN}') is null "
          f"and to_regclass('{HISTORY}') is null and has_function_privilege('{CALLER}','{WRITER}','execute')")
    truth("canonical writer policies", """(select count(*)=8 from pg_policies where schemaname='public'
        and (tablename,policyname) in (('observer_sites','observer_standalone_insert_requires_writer'),
        ('digital_observer_accounts','observer_writer_lock_account'),('observer_monitoring_packages','observer_writer_lock_package'),
        ('observer_site_subscriptions','observer_writer_read_subscription'),('observer_site_subscriptions','observer_writer_lock_subscription'),
        ('observer_site_subscriptions','observer_writer_start_trial'),('digital_observer_entitlement_grants','observer_writer_trial_grant'),
        ('digital_observer_financial_audit','observer_writer_trial_audit')))""")
    truth("isolated synthetic identity inventory",
          "not exists(select from auth.users where email is null or email !~ '^q669-[a-zA-Z0-9-]+@qa[.]invalid$') "
          "and not exists(select from auth.sessions)")
    raw = (HERE.parents[1] / "supabase/migrations" / SESSION_MIGRATION).read_bytes()
    require(digest(raw) == SESSION_FILE_SHA, "canonical session migration changed")
    body = raw.decode().split("as $$", 1)[1].split("$$;", 1)[0]
    truth("canonical live Auth predicate definition", f"""(select prosecdef and provolatile='s'
        and encode(sha256(convert_to(prosrc,'UTF8')),'hex')='{digest(body.encode())}'
        from pg_proc where oid='public.digital_observer_current_session_active()'::regprocedure)""")
    truth("enabled canonical source triggers", f"""(select array_agg(tgname::text order by tgname)=array[
        'digital_observer_camera_engine_boundary','sync_authorized_siren_policy_to_crossing_line']
        and bool_and(tgenabled in ('O','A')) from pg_trigger where tgrelid='{SOURCE}'::regclass and not tgisinternal)""")


class Fixture:
    def __init__(self, package_id):
        self.actor, self.session, self.submission, self.source = (str(uuid4()) for _ in range(4))
        self.label = "QA Pair " + uuid4().hex[:12]
        self.package = package_id

    def seed(self):
        sql("seed confirmed synthetic Auth user and session", tx(f"""
            insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
            values('{self.actor}','authenticated','authenticated','q669-pair-{self.actor}@qa.invalid',now(),
              '{{}}','{{"product":"digital_observer","account_type":"home","full_name":"Synthetic pair"}}',now(),now());
            insert into auth.sessions(id,user_id,created_at,updated_at,not_after,aal)
            values('{self.session}','{self.actor}',now(),now(),now()+interval '30 minutes','aal1');""", True))
        truth("Auth triggers created eligible owner with empty scope", f"""exists(
            select from public.profiles p join public.digital_observer_accounts a on a.profile_id=p.id
            where p.id='{self.actor}' and p.active and a.account_type='home' and a.status='onboarding')
            and not exists(select from public.observer_sites where owner_profile_id='{self.actor}')""")
        self.live(True)

    def live(self, active, session=None):
        claims = {"role": "authenticated", "sub": self.actor, "session_id": session or self.session}
        result = sql("evaluate real Auth session predicate", tx(role("authenticated", claims) +
                     "select public.digital_observer_current_session_active();"))
        require(result == ("t" if active else "f"), "unexpected live session predicate")

    def stage(self):
        sql("stage singleton operator pin", tx(f"""insert into {PIN}
            (singleton,actor,session_id,submission,source_id,package_id,fixture_label,expires_at)
            values(true,'{self.actor}','{self.session}','{self.submission}','{self.source}',
            '{self.package}','{self.label}',clock_timestamp()+interval '240 seconds');""", True))

    def call(self, actor=None, session=None, submission=None, label=None, expired=False, claim_role=CALLER):
        exp = "0" if expired else "floor(extract(epoch from clock_timestamp()))::bigint+600"
        return role(CALLER, {"role": claim_role}) + (
            f"select {RPC}('{actor or self.actor}','{session or self.session}',{exp},"
            f"'{submission or self.submission}','{label or self.label}');")


def wait_for(step, condition):
    end = time.monotonic() + 12
    while time.monotonic() < end:
        if sql(step, "select " + condition) == "t":
            return
        time.sleep(.08)
    raise Failure(step + " timed out")


@contextmanager
def held_transaction(tag, statement):
    # Keep the first real backend idle in its open transaction until the second
    # is observed in pg_blocking_pids. No timing assumption about RPC duration.
    proc = subprocess.Popen(CLIENT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        proc.stdin.write(BOUNDARY + f"begin; set local application_name='{tag}';\n" + statement +
                         "\nselect 'q669_held';\n")
        proc.stdin.flush()
        wait_for("first backend holds open transaction", f"""exists(select from pg_stat_activity
            where datname=current_database() and application_name='{tag}' and state='idle in transaction'
            and query like '%q669_held%')""")
        yield proc
    finally:
        if proc.poll() is None:
            # EOF rolls back any still-open transaction.
            proc.communicate(timeout=45)


def raced(fixture):
    tag = "q669_pair_" + uuid4().hex[:12]
    with ThreadPoolExecutor(max_workers=1) as pool, held_transaction(tag, fixture.call()) as first:
        sql("pair holds the actor lock", tx(f"select profile_id from public.digital_observer_accounts "
            f"where profile_id='{fixture.actor}' for update nowait;"), ("55P03",))
        sql("pair holds the bound session pin", tx(f"select singleton from {PIN} "
            f"where session_id='{fixture.session}' for update nowait;"), ("55P03",))
        second = pool.submit(sql, "second racing caller", tx(f"set local application_name='{tag}_b';\n" + fixture.call(), True))
        wait_for("two independent RPC backends contend", f"""exists(select from pg_stat_activity a
            join pg_stat_activity b on a.pid=any(pg_blocking_pids(b.pid)) and b.pid<>a.pid
            where a.datname=current_database() and b.datname=current_database() and a.application_name='{tag}'
            and b.application_name='{tag}_b' and b.wait_event_type='Lock')""")
        out, err = first.communicate("commit;\n", timeout=45)
        result = checked_result("first racing caller", subprocess.CompletedProcess([], first.returncode, out, err))
        lines = result.splitlines()
        require(len(lines) == 2 and lines[1] == "q669_held", "first caller output shape")
        require(lines[0] == second.result(), "racing callers returned different results")
        return lines[0]


def access(owner, other):
    truth("RPC signature and restricted owner", f"""(select count(*)=1 and bool_and(
        oid='{PAIR}'::regprocedure and prosecdef and proowner='{EXECUTOR}'::regrole
        and proargnames=array['verified_actor','verified_session','token_exp','submission','fixture_label']
        and pronargs=5 and pronargdefaults=0 and prorettype='jsonb'::regtype)
        from pg_proc where pronamespace='public'::regnamespace and proname='submit_qa_site_source_pair')""")
    truth("only dedicated caller admitted", f"""has_function_privilege('{CALLER}','{PAIR}','execute')
        and not has_function_privilege('{CALLER}','{WRITER}','execute')
        and not exists(select from unnest(array['anon','authenticated','service_role']) r
          where has_function_privilege(r,'{PAIR}','execute') or pg_has_role(r,'{CALLER}','member'))
        and not exists(select from unnest(array['{CALLER}','{EXECUTOR}','anon','authenticated','service_role']) r
          where has_any_column_privilege(r,'{PIN}','select,insert,update,references')
          or has_table_privilege(r,'{PIN}','delete,truncate,trigger'))""")
    for table in (PIN, HISTORY, SOURCE):
        sql("caller direct insert denied on " + table,
            tx(role(CALLER, {"role": CALLER}) + f"insert into {table} default values;"), ("42501",))
    for name in ("anon", "authenticated"):
        claims = {"role": name, "sub": owner.actor, "session_id": owner.session}
        sql(name + " RPC execute denied",
            tx(role(name, claims) + owner.call().split("\n", 1)[1]), ("42501",))
    for step, changed, states in (
        ("wrong caller claim", {"claim_role": "authenticated"}, ("42501",)),
        ("expired token", {"expired": True}, ("42501",)),
        ("mismatched label", {"label": owner.label + "x"}, ("P0002", "42501")),
        ("mismatched submission", {"submission": str(uuid4())}, ("P0002", "42501")),
        ("foreign actor and session", {"actor": other.actor, "session": other.session}, ("P0002", "42501")),
        ("foreign session", {"session": other.session}, ("P0002", "42501")),
    ):
        sql(step, tx(owner.call(**changed)), states)
    # Pin a real but incorrectly bound Auth row. A pin comparison alone would pass.
    sql("live foreign session cannot authenticate owner", tx(
        f"update {PIN} set session_id='{other.session}';" + owner.call(session=other.session)), ("42501",))
    sql("expired Auth session under matching pin", tx(
        f"update auth.sessions set not_after=now()-interval '1 second' where id='{owner.session}';" +
        owner.call()), ("42501",))
    sql("expired operator pin", tx(
        f"update {PIN} set expires_at=clock_timestamp()-interval '1 second';" + owner.call()), ("42501", "P0002"))
    sql("singleton rejects second operator pin", tx(f"insert into {PIN} select * from {PIN};"), ("23505",))
    sql("singleton must be true", tx(f"update {PIN} set singleton=false;"), ("23514",))
    sql("pin cannot exceed 300 seconds", tx(
        f"update {PIN} set expires_at=clock_timestamp()+interval '301 seconds';"), ("23514",))


def faults(owner, baseline):
    # The trigger and its function are transaction local to each probe. A unique
    # source exception proves the source insert was reached. Suppressed mandatory
    # inserts must raise the writer's own named error, not an unrelated failure.
    for table, trigger_body, state, marker in (
        (SOURCE, "raise exception using errcode='Q6601',message='SOURCE_INSERT_FAULT';", "Q6601", "SOURCE_INSERT_FAULT"),
        ("public.digital_observer_entitlement_grants", "return null;", "P0001", "GRANT_NOT_SAVED"),
        ("public.digital_observer_financial_audit", "return null;", "P0001", "AUDIT_NOT_SAVED"),
    ):
        setup = f"""create function {PRIVATE}.q669_pair_fault() returns trigger language plpgsql as $fault$
            begin {trigger_body} end $fault$;
            create trigger q669_pair_fault before insert on {table} for each row execute function {PRIVATE}.q669_pair_fault();"""
        sql("mandatory write fault at " + table, tx(setup + owner.call()), (state,), marker)
        require(records(DATA + [HISTORY, PIN]) == baseline, "partial records after fault at " + table)


def verify_success(owner, raw):
    try:
        pair = json.loads(raw)
    except ValueError:
        raise Failure("RPC response was not JSON") from None
    require(isinstance(pair, dict) and set(pair) == {"site_id", "source_id"}
            and pair["source_id"] == owner.source, "pair result shape or pinned source mismatch")
    site = uuid_value(pair["site_id"])
    truth("linked owner, inert source and server-side receipts", f"""(select count(*)=1 from {SOURCE} c
        join public.observer_sites s on s.id=c.observer_site_id
        join {HISTORY} h on h.source_id=c.id and h.site_id=s.id
        join {PRIVATE}.receipts r on (r.actor,r.submission,r.site_id)=(h.actor,h.submission,h.site_id)
        where s.id='{site}' and s.owner_profile_id='{owner.actor}' and s.garden_id is null and s.site_type='home'
        and s.name='{owner.label}' and s.active and not s.monitoring_enabled and s.camera_limit=1
        and c.id='{owner.source}' and c.created_by=s.owner_profile_id and c.display_name=s.name
        and c.connector_type='demo' and c.source_mode='sandbox' and c.status='disabled'
        and c.connector_provider='generic' and c.health_status='unknown' and c.engine_mode=s.engine_mode
        and c.camera_stream_id is null and c.secret_reference is null and c.stream_protocol is null
        and c.gateway_provider is null and c.preview_scene is null and c.last_seen_at is null
        and c.capabilities='{{}}' and c.metadata='{{}}' and c.monitoring_targets='[]'
        and h.actor='{owner.actor}' and h.submission='{owner.submission}' and h.session_id='{owner.session}'
        and h.package_id='{owner.package}' and h.fixture_label=s.name
        and r.result=jsonb_build_object('site_id',s.id,'source_id',c.id))""")
    truth("trial, disabled provider, mandatory audit and ten entitlements", f"""(select count(*)=1
        from public.observer_site_subscriptions b join public.digital_observer_financial_audit a
        on a.entity_id=b.id::text and a.observer_site_id=b.observer_site_id
        where b.observer_site_id='{site}' and b.package_id='{owner.package}' and b.commercial_state='trial'
        and b.payment_provider='disabled' and b.payment_provider_mode='disabled' and b.provider_outcome='none'
        and b.trial_end-b.trial_start=interval '336 hours' and b.last_provider_event_id is null
        and a.operation='trial_activated' and a.entity_type='subscription' and a.actor_profile_id='{owner.actor}'
        and (select count(*)=10 and count(distinct g.entitlement_key)=10 and bool_and(g.source_payment_event_id is null)
             from public.digital_observer_entitlement_grants g where g.subscription_id=b.id and g.observer_site_id=b.observer_site_id))""")
    truth("owner membership, activated draft and inactive schedule", f"""exists(select from public.observer_site_memberships
        where observer_site_id='{site}' and profile_id='{owner.actor}' and active and member_role='owner')
        and exists(select from public.observer_site_onboarding_drafts where activated_observer_site_id='{site}'
          and profile_id='{owner.actor}' and status='activated')
        and exists(select from public.observer_monitoring_schedules where observer_site_id='{site}'
          and status='draft' and schedule_mode='event_only')""")
    return site


def verify_delta(before, after):
    require(not (before - after), "an existing durable record changed or disappeared")
    counts = Counter()
    for row, count in (after - before).items():
        counts[row.split("|", 1)[0]] += count
    expected = {t: 1 for t in (SOURCE, HISTORY, PRIVATE + ".receipts", "public.observer_sites",
                "public.observer_site_memberships", "public.observer_site_onboarding_drafts",
                "public.observer_monitoring_schedules", "public.observer_site_subscriptions",
                "public.digital_observer_financial_audit")}
    expected["public.digital_observer_entitlement_grants"] = 10
    require(counts == expected, "unexpected committed row delta in " +
            ", ".join(sorted(k for k in counts.keys() | expected.keys() if counts[k] != expected.get(k, 0))))


def replay_probes(owner, other, site, raw):
    require(sql("committed repeat", tx(owner.call(), True)) == raw, "repeat result changed")
    for fixture, expected in ((owner, "1|1"), (other, "0|0")):
        claims = {"role": "authenticated", "sub": fixture.actor, "session_id": fixture.session}
        require(sql("owner-scoped access", tx(role("authenticated", claims) +
            f"select (select count(*) from public.observer_sites where id='{site}'),"
            f"(select count(*) from {SOURCE} where id='{owner.source}');")) == expected, "owner scope mismatch")
    sql("changed pinned source conflicts with receipt", tx(
        f"update {PIN} set source_id='{uuid4()}';" + owner.call()), ("P0001",), "PAIR_RECEIPT_CONFLICT")
    sql("changed pinned label conflicts with receipt", tx(
        f"update {PIN} set fixture_label='{owner.label}x';" + owner.call(label=owner.label + "x")),
        ("P0001",), "PAIR_RECEIPT_CONFLICT")
    sql("missing source cannot replay", tx(
        f"delete from {SOURCE} where id='{owner.source}';" + owner.call()),
        ("P0001",), "PAIR_SOURCE_MISSING_OR_CHANGED")
    sql("changed source cannot replay", tx(
        f"update {SOURCE} set status='draft' where id='{owner.source}';" + owner.call()),
        ("P0001",), "PAIR_SOURCE_MISSING_OR_CHANGED")
    sql("revoked real session cannot replay", tx(
        f"delete from auth.sessions where id='{owner.session}';" + owner.call()), ("42501",))
    sql("invalid source status", tx(f"update {SOURCE} set status='invalid' where id='{owner.source}';"), ("23514",))
    sql("live source requires secret", tx(f"update {SOURCE} set source_mode='live' where id='{owner.source}';"), ("23514",))
    sql("cross-engine trigger rejects update", tx(
        f"update {SOURCE} set engine_mode='kindergarten_skeleton' where id='{owner.source}';"),
        ("P0001",), "OBSERVER_ENGINE_BOUNDARY_VIOLATION")
    result = sql("engine trigger inherits site mode", tx(f"""update {SOURCE} set engine_mode=null
        where id='{owner.source}' returning engine_mode;"""))
    require(result == "standard_biometric", "canonical engine inheritance failed")


def exercise(forward, rollback):
    preflight()
    base_catalog = catalog()
    before = records(DATA)
    for kind, artifact in (("forward", forward), ("rollback", rollback)):
        sql("original " + kind + " guard", artifact[0], ("P0001",), "REVIEW ONLY: " + GUARDS[kind])
    require(catalog() == base_catalog and records(DATA) == before, "guard changed baseline")
    sql("install reviewed pair transaction", forward[1])
    fixtures = []
    try:
        pkg = uuid_value(sql("eligible canonical package", """select id from public.observer_monitoring_packages
            where active and package_type='home' order by id limit 1"""))
        owner, other = Fixture(pkg), Fixture(pkg)
        for fixture in (owner, other):
            fixtures.append(fixture)
            fixture.seed()
        sql("absent operator pin", tx(owner.call()), ("42501", "P0002"))
        owner.stage()
        baseline = records(DATA + [HISTORY, PIN])
        access(owner, other)
        faults(owner, baseline)
        raw = raced(owner)
        site = verify_success(owner, raw)
        committed = records(DATA + [HISTORY, PIN])
        verify_delta(baseline, committed)
        replay_probes(owner, other, site, raw)
        require(records(DATA + [HISTORY, PIN]) == committed, "repeat or denial changed durable rows")
    finally:
        # Only these fresh fixture sessions are closed. Operational rollback must
        # preserve both receipts and the successful records, including prior owners.
        ids = ",".join(f"'{f.session}'" for f in fixtures)
        try:
            if ids:
                sql("close synthetic fixture sessions", f"delete from auth.sessions where id in ({ids});")
            durable = records(DATA + [HISTORY])
        finally:
            sql("withdraw reviewed pair transaction", rollback[1])
        require(catalog() == base_catalog, "baseline catalog, ACL, trigger, constraint or policy drift")
        truth("pair removed, history operator-only, generic caller restored", f"""to_regclass('{PIN}') is null
            and to_regprocedure('{PAIR}') is null and has_function_privilege('{CALLER}','{WRITER}','execute')
            and (select relrowsecurity from pg_class where oid='{HISTORY}'::regclass)
            and not exists(select from unnest(array['anon','authenticated','service_role','{CALLER}','{EXECUTOR}']) r
                where has_any_column_privilege(r,'{HISTORY}','SELECT,INSERT,UPDATE,REFERENCES')
                or has_table_privilege(r,'{HISTORY}','DELETE,TRUNCATE,TRIGGER'))""")
        require(records(DATA + [HISTORY]) == durable, "withdrawal changed retained records")
        require(not (before - durable), "original fixture records changed")
    print("PASS live rehearsal: two blocked/overlapping callers returned one pair; replays and denials verified; "
          "mandatory writes atomic; provider disabled; catalog restored and durable records retained.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--authorized-disposable", choices=[DB],
                        help="live execution only after separate authorization for this existing fixture")
    parser.add_argument("--forward-sha256", help="independently reviewed forward file digest for live mode")
    parser.add_argument("--rollback-sha256", help="independently reviewed rollback file digest for live mode")
    args = parser.parse_args()
    if args.authorized_disposable:
        require(all(re.fullmatch("[0-9a-f]{64}", s or "") for s in (args.forward_sha256, args.rollback_sha256)),
                "live mode requires both independently reviewed SQL digests")
    forward = package("forward", args.forward_sha256)
    rollback = package("rollback", args.rollback_sha256)
    if args.authorized_disposable:
        exercise(forward, rollback)
    else:
        print("PASS offline guard and transaction checks only")
        for kind, artifact in (("forward", forward), ("rollback", rollback)):
            print(kind + " sha256 " + artifact[2])


if __name__ == "__main__":
    try:
        main()
    except (Failure, OSError, subprocess.TimeoutExpired) as error:
        print("FAIL " + (str(error) if isinstance(error, Failure) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
