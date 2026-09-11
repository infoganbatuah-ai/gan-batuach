# DIGITAL OBSERVER — WORKER CAPACITY MODEL

Contract: `observer-inference-worker-pool-v1`

Capacity is described by active worker count, capability/model classes, capacity class, observed jobs/second, queue depth and age, inference latency, utilization, failures/retries and tenant/source service distribution. No fixed camera-per-worker number is asserted.

Scale-out is allowed only for authenticated, non-revoked workers that match PUSH 32 capability/privacy/tenant policy. Unhealthy workers stop receiving work. Capacity addition is runtime registration, not camera rewiring. Removal lets current lease expire or complete; another eligible worker can recover it.

Operational decisions must use measured queue age and throughput together. More workers can increase cost and eventually encounter queue, storage, model-load or network bottlenecks. PUSH 33 usage hooks remain unchanged; cost does not override quality or privacy.

Evidence classifications are: `LOCAL_MULTI_WORKER_PROOF`, `LOCAL_MULTI_PROCESS_PROOF`, `SYNTHETIC_SCALE_TEST`, `MULTI_HOST_PROOF`, and `PRODUCTION_SCALE_PROOF`. PUSH 36 reaches the first three only.
