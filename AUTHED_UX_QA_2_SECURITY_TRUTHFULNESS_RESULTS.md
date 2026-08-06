# AUTHED UX/UI QA 2 - Security / Truthfulness Results

## Accepted Parent Runtime Check

| Item | Result |
|---|---|
| Supabase service role visible | NOT_FOUND_PARENT |
| Payment/provider secrets visible | NOT_FOUND_PARENT |
| WhatsApp/SMS tokens visible | NOT_FOUND_PARENT |
| Camera RTSP visible | NOT_FOUND_PARENT |
| Camera credentials visible | NOT_FOUND_PARENT |
| AI provider keys visible | NOT_FOUND_PARENT |
| Raw AI to parents | NOT_FOUND_PARENT |
| Fake legal/regulatory approval claim | NOT_FOUND_PARENT |
| Guaranteed safety claim | NOT_FOUND_PARENT |

## High-Risk Feature State

| Feature | Result |
|---|---|
| Live payments | No activation performed |
| Parent camera viewing | No activation performed |
| Live AI | No activation performed |
| Production WhatsApp/SMS | No activation performed |

## Not Accepted

Admin/provider/camera/AI pages were not tested logged-in in this run, so their runtime secret exposure status remains unaccepted.
