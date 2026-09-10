import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AI_PRIORITY_WEIGHT, validateAiJob, assertWorkerIdentity, AI_RESULT_CONTRACT } from "./ai-job-contract.mjs";

const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.floor(Number(value)))) : fallback;
const safeReason = value => String(value ?? "ai_job_failed").replace(/[^A-Z0-9_-]/gi, "_").slice(0, 96);

export function createDurableAiJobQueue({ databasePath, now = Date.now, policy = {}, workerAuthorizer }) {
  if (typeof databasePath !== "string" || !databasePath) throw new Error("ai_queue_database_required");
  if (typeof workerAuthorizer !== "function") throw new Error("ai_queue_worker_authorizer_required");
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  const limits = Object.freeze({ maxJobs: bounded(policy.maxJobs, 20_000, 10, 1_000_000), maxPayloadBytes: bounded(policy.maxPayloadBytes, 64 * 1024 * 1024, 1024, 2 * 1024 * 1024 * 1024),
    leaseMs: bounded(policy.leaseMs, 30_000, 100, 10 * 60_000), candidatePool: bounded(policy.candidatePool, 128, 8, 2_000), agingMs: bounded(policy.agingMs, 30_000, 1_000, 3_600_000) });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS ai_jobs(job_id TEXT PRIMARY KEY,idempotency_key TEXT NOT NULL UNIQUE,tenant_id TEXT NOT NULL,site_id TEXT NOT NULL,source_id TEXT NOT NULL,ordering_key TEXT NOT NULL,priority TEXT NOT NULL,purpose TEXT NOT NULL,capability TEXT NOT NULL,model_class TEXT NOT NULL,observed_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,payload TEXT NOT NULL,payload_bytes INTEGER NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL DEFAULT 0,lease_owner TEXT,lease_expires_at INTEGER,last_error TEXT,completed_at INTEGER);
    CREATE INDEX IF NOT EXISTS ai_jobs_ready ON ai_jobs(state,next_attempt_at,expires_at,priority,created_at);
    CREATE INDEX IF NOT EXISTS ai_jobs_scope ON ai_jobs(tenant_id,site_id,source_id,state);
    CREATE TABLE IF NOT EXISTS ai_results(result_id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,created_at INTEGER NOT NULL,consumed_at INTEGER);
    CREATE TABLE IF NOT EXISTS ai_queue_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER NOT NULL,category TEXT NOT NULL,job_id TEXT,detail TEXT);
    CREATE TABLE IF NOT EXISTS ai_queue_fairness(scope_key TEXT PRIMARY KEY,last_served_at INTEGER NOT NULL,served INTEGER NOT NULL DEFAULT 0);`);
  try { chmodSync(databasePath, 0o600); } catch {}
  let closed = false;
  const startedAt=now();
  const audit = (category, jobId = null, detail = null) => db.prepare("INSERT INTO ai_queue_audit(at,category,job_id,detail) VALUES(?,?,?,?)").run(now(), category, jobId, detail);
  const authorize = (worker, job) => {
    assertWorkerIdentity(worker.identity, job);
    if (workerAuthorizer(worker, job) !== true) throw new Error("ai_worker_registration_denied");
    return true;
  };
  function expireAndRecover() {
    db.prepare("UPDATE ai_jobs SET state='PENDING',lease_owner=NULL,lease_expires_at=NULL WHERE state='CLAIMED' AND lease_expires_at<=?").run(now());
    const expired = db.prepare("SELECT job_id FROM ai_jobs WHERE state IN ('PENDING','RETRY_WAIT','CLAIMED') AND expires_at<=? LIMIT 1000").all(now());
    for (const row of expired) { db.prepare("UPDATE ai_jobs SET state='EXPIRED',lease_owner=NULL,lease_expires_at=NULL,last_error='JOB_EXPIRED' WHERE job_id=?").run(row.job_id); audit("JOB_EXPIRED", row.job_id); }
  }
  function enqueue(value) {
    if (closed) throw new Error("ai_queue_closed");
    const job = validateAiJob(value); const payload = JSON.stringify(job);
    const duplicate = db.prepare("SELECT payload FROM ai_jobs WHERE idempotency_key=?").get(job.idempotency_key);
    if (duplicate) return { inserted: false, job: JSON.parse(duplicate.payload) };
    const total = db.prepare("SELECT count(*) jobs,COALESCE(sum(payload_bytes),0) bytes FROM ai_jobs WHERE state IN ('PENDING','RETRY_WAIT','CLAIMED')").get();
    if (Number(total.jobs) >= limits.maxJobs || Number(total.bytes) + Buffer.byteLength(payload) > limits.maxPayloadBytes) throw new Error("ai_queue_backpressure_capacity_reached");
    db.prepare(`INSERT OR IGNORE INTO ai_jobs(job_id,idempotency_key,tenant_id,site_id,source_id,ordering_key,priority,purpose,capability,model_class,observed_at,expires_at,created_at,payload,payload_bytes,state)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING')`).run(job.job_id,job.idempotency_key,job.tenant_id,job.site_id,job.source_id,job.ordering_key,job.priority,job.purpose,job.requested_capability,job.model_class,Date.parse(job.observation_timestamp),Date.parse(job.expires_at),Date.parse(job.created_at),payload,Buffer.byteLength(payload));
    const inserted = Number(db.prepare("SELECT changes() n").get().n) === 1;
    if (inserted) audit("JOB_ENQUEUED", job.job_id, job.priority);
    const existing = inserted ? job : JSON.parse(db.prepare("SELECT payload FROM ai_jobs WHERE idempotency_key=?").get(job.idempotency_key).payload);
    return { inserted, job: existing };
  }
  function claim(worker, options = {}) {
    if (closed) throw new Error("ai_queue_closed"); expireAndRecover();
    const capabilities = new Set(worker.capabilities ?? []), modelClasses = new Set(worker.model_classes ?? []), jobFilter = options.jobId ? " AND j.job_id=?" : "", parameters = options.jobId ? [now(), now(), options.jobId, limits.candidatePool] : [now(), now(), limits.candidatePool], rows = db.prepare(`SELECT * FROM ai_jobs j WHERE j.state IN ('PENDING','RETRY_WAIT') AND j.next_attempt_at<=? AND j.expires_at>?
      ${jobFilter}
      AND NOT EXISTS(SELECT 1 FROM ai_jobs prior WHERE prior.ordering_key=j.ordering_key AND prior.observed_at<j.observed_at AND prior.state IN ('PENDING','RETRY_WAIT','CLAIMED'))
      ORDER BY j.created_at LIMIT ?`).all(...parameters).filter(row => capabilities.has(row.capability) && modelClasses.has(row.model_class));
    const authorized = rows.filter(row => { try { authorize(worker, JSON.parse(row.payload)); return true; } catch { return false; } });
    if (!authorized.length) return null;
    const served = new Map(db.prepare("SELECT scope_key,last_served_at,served FROM ai_queue_fairness").all().map(row => [row.scope_key, { at:Number(row.last_served_at), count:Number(row.served) }]));
    authorized.sort((a,b) => {
      const ageA=Math.floor((now()-a.created_at)/limits.agingMs), ageB=Math.floor((now()-b.created_at)/limits.agingMs);
      const scoreA=AI_PRIORITY_WEIGHT[a.priority]+Math.min(350,ageA*10), scoreB=AI_PRIORITY_WEIGHT[b.priority]+Math.min(350,ageB*10);
      if (scoreA!==scoreB) return scoreB-scoreA;
      const scopeA=`${a.tenant_id}:${a.site_id}`, scopeB=`${b.tenant_id}:${b.site_id}`, sourceA=`${scopeA}:${a.source_id}`, sourceB=`${scopeB}:${b.source_id}`;
      return (served.get(scopeA)?.count??0)-(served.get(scopeB)?.count??0) || (served.get(sourceA)?.count??0)-(served.get(sourceB)?.count??0)
        || (served.get(scopeA)?.at??0)-(served.get(scopeB)?.at??0) || (served.get(sourceA)?.at??0)-(served.get(sourceB)?.at??0) || a.created_at-b.created_at;
    });
    const row=authorized[0], leaseMs=bounded(options.leaseMs,limits.leaseMs,100,10*60_000);
    const changed=db.prepare("UPDATE ai_jobs SET state='CLAIMED',lease_owner=?,lease_expires_at=?,attempts=attempts+1 WHERE job_id=? AND state IN ('PENDING','RETRY_WAIT')").run(worker.worker_id,now()+leaseMs,row.job_id);
    if (!changed.changes) return null;
    for(const scope of [`${row.tenant_id}:${row.site_id}`,`${row.tenant_id}:${row.site_id}:${row.source_id}`]) db.prepare("INSERT INTO ai_queue_fairness(scope_key,last_served_at,served) VALUES(?,?,1) ON CONFLICT(scope_key) DO UPDATE SET last_served_at=excluded.last_served_at,served=served+1").run(scope,now());
    audit("JOB_CLAIMED",row.job_id,worker.environment); return { job:JSON.parse(row.payload),attempt:Number(row.attempts)+1,leased_at:new Date(now()).toISOString(),lease_expires_at:new Date(now()+leaseMs).toISOString(),queue_wait_ms:Math.max(0,now()-Number(row.created_at)) };
  }
  function acknowledge(worker, jobId, result) {
    if (result?.contract!==AI_RESULT_CONTRACT || result.job_id!==jobId) throw new Error("ai_queue_result_invalid");
    const row=db.prepare("SELECT * FROM ai_jobs WHERE job_id=?").get(jobId); if(!row) throw new Error("ai_queue_job_missing");
    authorize(worker,JSON.parse(row.payload));
    if(row.state==="COMPLETED") return { acknowledged:true,duplicate:true };
    if(row.state!=="CLAIMED"||row.lease_owner!==worker.worker_id||Number(row.lease_expires_at)<=now()) throw new Error("ai_queue_lease_invalid");
    if(Number(row.expires_at)<=now()){db.prepare("UPDATE ai_jobs SET state='EXPIRED',lease_owner=NULL,lease_expires_at=NULL,last_error='JOB_EXPIRED_DURING_INFERENCE' WHERE job_id=?").run(jobId);audit("JOB_EXPIRED",jobId,"during_inference");return {acknowledged:false,state:"EXPIRED"};}
    db.exec("BEGIN IMMEDIATE");
    try { db.prepare("INSERT OR IGNORE INTO ai_results(result_id,job_id,payload,created_at) VALUES(?,?,?,?)").run(result.result_id,jobId,JSON.stringify(result),now()); db.prepare("UPDATE ai_jobs SET state='COMPLETED',completed_at=?,lease_owner=NULL,lease_expires_at=NULL WHERE job_id=?").run(now(),jobId); db.exec("COMMIT"); }
    catch(error){db.exec("ROLLBACK");throw error;}
    audit("JOB_ACKNOWLEDGED",jobId); return { acknowledged:true,duplicate:false };
  }
  function fail(worker, jobId, classification="RETRYABLE", reason="AI_JOB_FAILED") {
    const row=db.prepare("SELECT payload,attempts,lease_owner FROM ai_jobs WHERE job_id=?").get(jobId); if(!row||row.lease_owner!==worker.worker_id) throw new Error("ai_queue_lease_invalid"); authorize(worker,JSON.parse(row.payload));
    const job=JSON.parse(row.payload), retryable=classification==="RETRYABLE", exhausted=Number(row.attempts)>=job.retry_policy.max_attempts;
    if(!retryable||exhausted){db.prepare("UPDATE ai_jobs SET state='DEAD_LETTER',lease_owner=NULL,lease_expires_at=NULL,last_error=? WHERE job_id=?").run(safeReason(reason),jobId);audit("JOB_DEAD_LETTER",jobId,safeReason(reason));return {state:"DEAD_LETTER"};}
    const wait=job.retry_policy.base_backoff_ms*2**Math.min(8,Math.max(0,Number(row.attempts)-1)); db.prepare("UPDATE ai_jobs SET state='RETRY_WAIT',next_attempt_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error=? WHERE job_id=?").run(now()+wait,safeReason(reason),jobId);audit("JOB_RETRY_SCHEDULED",jobId,safeReason(reason));return {state:"RETRY_WAIT",retry_at:new Date(now()+wait).toISOString()};
  }
  function releaseForFailover(worker, jobId, reason="RETRYABLE_TARGET_FAILURE") {
    const row=db.prepare("SELECT payload,attempts,lease_owner FROM ai_jobs WHERE job_id=?").get(jobId);
    if(!row||row.lease_owner!==worker.worker_id)throw new Error("ai_queue_lease_invalid");
    authorize(worker,JSON.parse(row.payload));
    const job=JSON.parse(row.payload);
    if(Number(row.attempts)>=job.retry_policy.max_attempts){db.prepare("UPDATE ai_jobs SET state='DEAD_LETTER',lease_owner=NULL,lease_expires_at=NULL,last_error=? WHERE job_id=?").run(safeReason(reason),jobId);audit("JOB_DEAD_LETTER",jobId,safeReason(reason));return{state:"DEAD_LETTER"};}
    db.prepare("UPDATE ai_jobs SET state='PENDING',next_attempt_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error=? WHERE job_id=?").run(now(),safeReason(reason),jobId);
    audit("JOB_FAILOVER_RELEASED",jobId,safeReason(reason));return{state:"PENDING"};
  }
  function result(jobId,{consume=false}={}){if(!consume){const row=db.prepare("SELECT payload FROM ai_results WHERE job_id=?").get(jobId);return row?JSON.parse(row.payload):null;}db.exec("BEGIN IMMEDIATE");try{const row=db.prepare("SELECT payload,consumed_at FROM ai_results WHERE job_id=?").get(jobId);if(!row||row.consumed_at!=null){db.exec("COMMIT");return null;}const changed=db.prepare("UPDATE ai_results SET consumed_at=? WHERE job_id=? AND consumed_at IS NULL").run(now(),jobId);db.exec("COMMIT");return changed.changes?JSON.parse(row.payload):null;}catch(error){db.exec("ROLLBACK");throw error;}}
  function snapshot(){expireAndRecover();const states=Object.fromEntries(db.prepare("SELECT state,count(*) n FROM ai_jobs GROUP BY state").all().map(r=>[r.state,Number(r.n)]));const age=db.prepare("SELECT MIN(created_at) oldest FROM ai_jobs WHERE state IN ('PENDING','RETRY_WAIT','CLAIMED')").get();const priority_backlog=Object.fromEntries(db.prepare("SELECT priority,count(*) n FROM ai_jobs WHERE state IN ('PENDING','RETRY_WAIT','CLAIMED') GROUP BY priority").all().map(r=>[r.priority,Number(r.n)]));const audits=Object.fromEntries(db.prepare("SELECT category,count(*) n FROM ai_queue_audit GROUP BY category").all().map(r=>[r.category,Number(r.n)]));const completed=states.COMPLETED??0,elapsed=Math.max(1,now()-startedAt);return{contract:"observer-ai-queue-v1",queue_depth:(states.PENDING??0)+(states.RETRY_WAIT??0)+(states.CLAIMED??0),oldest_job_age_ms:age.oldest==null?null:Math.max(0,now()-Number(age.oldest)),priority_backlog,states,completed_jobs:completed,jobs_per_second:Number((completed/(elapsed/1000)).toFixed(3)),retry_count:audits.JOB_RETRY_SCHEDULED??0,lease_claim_count:audits.JOB_CLAIMED??0,dead_letter_count:states.DEAD_LETTER??0,...limits};}
  function close(){closed=true;db.close();}
  expireAndRecover(); return {enqueue,claim,acknowledge,fail,releaseForFailover,result,snapshot,recover:expireAndRecover,close};
}
