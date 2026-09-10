# Digital Observer Offline Storage Policy

Default bounded policy:

| Control | Default |
|---|---:|
| Records | 10,000 |
| Encrypted payload bytes | 512 MiB |
| Retention | 7 days |
| Delivery batch | 20 (Journal uses 2 concurrent lanes) |
| Retry backoff | 5 seconds to 5 minutes |

Metadata and incident continuity receive higher priority than optional work. Evidence media may consume the byte budget only as an explicitly typed bounded item; raw continuous frames are excluded. At 80% bytes the queue reports `HIGH`; at the record/byte limit it reports `LIMIT_REACHED`.

Capacity pressure is never silent. Optional low-priority input may be rejected with an audited degradation record. Critical evidence/event input is not silently evicted; capacity exhaustion becomes an explicit `NEEDS_ATTENTION` condition. Retention expiry must record `EXPIRED` before cleanup. Customer history already accepted by cloud is unaffected.

Metrics expose depth, encrypted bytes, oldest age, retries, failures, delivery count, state and disk pressure without payload content. These are PUSH 27-compatible operational signals, not a commercial SLA.
