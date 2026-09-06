# DIGITAL OBSERVER — PUSH 3 REAL CAMERA E2E REPORT

## 1. FINAL STATUS

**BLOCKED — EXTERNAL CAMERA ACCESS**

A real home DVR and real live streams were recovered and verified. The Gateway has active relays, real frames were decoded, and the local ONNX object detector processed those frames. The required physical person was not present in the sampled view: 24 real live samples returned no object/person detection. No mock, synthetic source, uploaded media, manually inserted row, or manually-triggered event was used. Therefore a legitimate normalized real-person event, evidence record, and UI event cannot be claimed.

Minimum unblock action: have a person walk through the visible field of **home DVR channel 11 / entrance** while the persistent Gateway is running, then repeat the existing Journal/API observation. No new credentials or architectural change is required.

## 2. REAL CAMERA SOURCE

| Field | Value |
|---|---|
| Camera/Source ID | `e9f8abf3-5895-494e-b1cf-ea8818602851` |
| Site | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` |
| Connection method | Existing private DVR/NVR Gateway relay |
| Vendor | `video_gateway` / custom private DVR adapter |
| Protocol | `rtsp_tcp` source registration; Gateway internal relay |
| Gateway assignment | `62df97e2-3c0b-427f-9108-bde029bc10e7` |
| Credentials resolved? | YES — only inside the active Keychain-backed persistent Gateway; values were never read or printed |
| Reachable? | YES |

The persistent LaunchAgent is running. Its Gateway health reported 10 registered streams, 10 active/progressing relays, 16 discovered channels, and 10 connected channels. The local configuration file contained a different Keychain-service reference with only a signing-secret entry; the running LaunchAgent uses `com.ganbatuach.video-gateway.runtime`, which contains the existing device and DVR credentials. No credentials were exposed.

## 3. END-TO-END TRACE

| Step | Result | Component | Evidence | Timestamp |
|---|---|---|---|---|
| Camera | PASS | Home DVR channel 11 | Existing DVR registration is `connected` / `healthy`; last known source health was current during Gateway discovery | 2026-09-04 21:21:51 UTC |
| Gateway | PASS | Persistent Gateway `127.0.0.1:18082` | 10 active and 10 progressing relays; device authorization `ready` | 2026-09-04 21:25 UTC |
| Frame | PASS | Anchored frame decoder | Authenticated live `detections` request returned a source anchor for the correct camera/site/stream, sequence 3086 | 2026-09-04 21:25:34 UTC |
| Inference | PASS | `ssd_mobilenet_v1_10` / ONNX Runtime CPU | Gateway reported `object_detection_ready`; real 300×300 RGB frame inference completed | 2026-09-04 21:25:34 UTC |
| Detection | BLOCKED | Object detector | 24 real samples, 23 HTTP-successful; no object or person was present/detected | sample window ending 2026-09-04 21:26 UTC |
| Event | NOT CREATED | Existing JournalTracker/outbox | No legitimate detection; no manual event insertion permitted | N/A |
| Evidence | NOT CREATED | Existing evidence engine | Evidence capture is event-authorized and was correctly not invoked | N/A |
| DB | NOT CREATED | Configured Supabase | No real event persistence without detector output | N/A |
| UI | NOT CREATED | Digital Observer UI | No real event exists to show | N/A |

The Journal is active and sampling real streams: latest journal status was `degraded` only because 7 of 16 configured DVR channels are offline or missing a required crossing-line rule. It sampled 9 cameras successfully and had zero pending deliveries and zero delivery failures.

## 4. REAL AI RESULT

| Field | Value |
|---|---|
| Model/provider | `ssd_mobilenet_v1_10` via `onnxruntime-node` |
| Version/provenance | ONNX Model Zoo artifact, verified checksum in the existing worker |
| Class detected | None in the sampled real frames |
| Confidence | Not applicable — no detections |
| Inference latency | 24-sample window: 69–369 ms, 112 ms average request latency; one anchored request completed in 189 ms |
| Real frame? | YES |
| Mock/synthetic? | NO |

The successful anchored sample contained `camera_source_id=e9f8abf3-5895-494e-b1cf-ea8818602851`, the expected site ID, stream ID `dvr_84e4cdf200faab18d9_11`, and a real observed timestamp. Raw image bytes were neither returned nor retained.

## 5. EVENT RESULT

No qualifying real event was created.

Historical `person_detected` rows exist in the database, but their stored metadata has no gateway, stream, source-anchor, model, confidence, or evidence provenance. They are not sufficient to claim the PUSH 3 real chain and were not used as evidence.

## 6. EVIDENCE RESULT

| Evidence type | Result |
|---|---|
| Snapshot | NOT APPLICABLE — no real event |
| Pre-event clip | NOT APPLICABLE — no real event |
| Event clip | NOT APPLICABLE — no real event |
| Post-event clip | NOT APPLICABLE — no real event |
| Signed access | NOT APPLICABLE — no real event media exists |

The existing evidence path remains protected: it requires a matching source anchor, a persisted event recording grant, correct site/gateway/camera/stream binding, and bounded segment timing. It was not bypassed.

## 7. UI RESULT

| Check | Result |
|---|---|
| Event visible in UI | NO — no qualifying real event |
| Correct camera | NOT APPLICABLE |
| Correct timestamp | NOT APPLICABLE |
| Real evidence visible | NOT APPLICABLE |

The dashboard itself remains available locally. No UI state was treated as proof of monitoring.

## 8. LATENCY

| Metric | Result |
|---|---|
| Inference | 69–369 ms per live-sample request; 112 ms average over 24 samples |
| Event persisted | Unavailable — no detector output |
| Evidence ready | Unavailable — no event |
| UI visible | Unavailable — no event |
| End-to-end | Unavailable — external physical-person test required |

These are pilot observations, not an SLA.

## 9. FAILURE/RECOVERY TEST

**NOT RUN.** The required success chain did not complete, so no relay/Gateway interruption was introduced. Deliberately disrupting the active home DVR before proving a real event would not be proportionate.

Existing truthful behavior was observed: the Journal reports offline channels as unavailable, overall coverage as degraded, and does not promote this to a protected/AI-verified claim.

## 10. MOCK BOUNDARY

### REAL PATH

- Existing home DVR Keychain-backed configuration.
- Persistent Gateway with 10 live progressing relays.
- Real HLS/relay segment decoding and anchored frame extraction.
- Existing ONNX SSD MobileNet object model running locally on actual frame pixels.
- Existing Journal polling and source/site/gateway binding.

### MOCK PATH

- Product-local `mock` / `local_shadow` observer workers identified in the repository remain separate from the tested Gateway path.
- Synthetic/demo camera sources remain present in Supabase and were not used.

### LEGACY PATH

- Historical `person_detected` database rows lack the current source-anchor/model/evidence metadata required to prove real origin.

### UNUSED PATH

- No Apple Vision detection, face recognition, biometric matching, external cloud video upload, physical controls, or notification provider delivery was used.

## 11. NEXT-PUSH READINESS

**ARE WE READY TO REPLACE THE MOCK PRODUCT OBSERVER WITH REAL AI? NO.**

The Gateway-to-real-frame-to-real-ONNX portion is verified, but the real detector-to-normalized-event-to-evidence-to-UI chain still needs one controlled physical person pass. After that pass, verify the existing Journal event persistence and evidence grant before considering any replacement of mock product paths.

No architecture redesign is justified or performed in PUSH 3.
