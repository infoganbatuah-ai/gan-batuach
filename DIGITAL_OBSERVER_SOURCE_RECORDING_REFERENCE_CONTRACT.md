# DIGITAL OBSERVER — SOURCE RECORDING REFERENCE CONTRACT

Date: 2026-09-10
Contract: `observer-source-recording-reference-v1`

A source recording reference identifies authorized media that remains in a DVR, NVR, VMS, NAS or customer archive. It is not an Event and is not Digital Observer Evidence unless a separate Evidence policy selects and stores media.

Required fields are stable reference ID, tenant, Site, Camera Source, source system, provider recording ID, original time range, retrieval capability, known retention availability and authorization requirement. The contract records whether media was copied into Digital Observer storage. It rejects passwords, raw URLs and embedded credentials.

Investigation may later use this reference to request authorized source media even when no Event Evidence was proactively retained. Actual DVR/NVR/VMS retrieval adapters, customer network access and enterprise legal policy remain owned by their later canonical PUSHES; PUSH 34 supplies the provider-neutral boundary only.
