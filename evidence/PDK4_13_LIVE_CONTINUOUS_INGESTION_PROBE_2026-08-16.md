# PDK4.13 Live Continuous Ingestion Probe

Purpose: production live acceptance probe for continuous GitHub ingestion.

Created: 2026-08-16T09:01:00+03:00
Branch: dev/sg2.1-semantic
Expected behavior: the already-running production SG instance detects this commit through PDK4 continuous ingestion without a redeploy, processes the source at most once, keeps PDK4 healthy/current, and makes the verified source available to guarded Project Memory retrieval.

This file contains no secrets, credentials, authority grants, or executable instructions.
