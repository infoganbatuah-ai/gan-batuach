# DIGITAL OBSERVER — RTO / RPO CONTRACT

RTO is measured from detected failure to an eligible replacement accepting service. RPO is measured as acknowledged canonical records lost; duplicate accepted Product effects are reported separately.

| Failure class | Recovery boundary | RPO expectation |
|---|---|---|
| Stateless API instance | remove from healthy pool and select peer | zero shared canonical-state loss |
| AI worker | lease expiry/release and peer claim | zero acknowledged job/result loss |
| Queue process | durable backend reopen/reconnect | zero acknowledged job loss within backend durability boundary |
| Database dependency | bounded retry/circuit recovery | no competing cache writes; failed requests remain failed/retryable |
| Storage backend | authorized alternate or pending upload | no false availability; last valid copy retained |
| Device control owner | lease expiry, higher epoch takeover | zero duplicate authoritative effects |

No commercial SLA is declared. PUSH 37 records local observations only. Provider RTO/RPO, zone loss and sustained qualification require actual provider/multi-host evidence and PUSH 38.
