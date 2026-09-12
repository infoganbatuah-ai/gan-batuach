# GB-M19 automatic attendance correction

The initial atomic transition stamped automatic check-in/out at the 30-minute detection time, displacing the displayed arrival/departure boundary. Migration `20260913010000` uses the first server-received geofence observation in a continuous 30-minute interval, requires a recent confirming sample, and rejects an opposite observation in the interval. A database trigger stamps receipt time and preserves it on update, so device-supplied capture time cannot determine the threshold. The attendance API now finds open shifts across midnight and uses the database transition for both automatic edges.

The correction does not rewrite existing attendance history or change Garden/Staff employment authority. No controlled QA Staff identity was available for a live GPS timing probe.

DIGITAL OBSERVER CORE DIFF: 0
