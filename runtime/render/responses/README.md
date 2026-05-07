# Render Responses

This folder stores sanitized responses for Render diagnostic requests.

Rules:
- responses must contain only safe Render telemetry;
- no env values;
- env variables may be reported only as SET or MISSING;
- logs must be sanitized before writing;
- responses must link back to the request id;
- failures must be written as safe error summaries.

V1 response targets:
- logs response;
- deploys response;
- latest deploy logs response;
- env summary response;
- status response.
