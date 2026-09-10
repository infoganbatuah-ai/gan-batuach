import { validateAiJob } from "../../../services/video-gateway/ai-job-contract.mjs";

const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
try{const job=validateAiJob(JSON.parse(Buffer.concat(chunks).toString("utf8")));process.stdout.write(JSON.stringify({job_id:job.job_id,detections:[{label:"person",confidence:0.91,box:[0.1,0.2,0.6,0.7]}],model_provenance:{model:"fixture-object",expected_sha256:"fixture-v1",runtime:"isolated-node-process"}}));}
catch{process.exitCode=1;}
