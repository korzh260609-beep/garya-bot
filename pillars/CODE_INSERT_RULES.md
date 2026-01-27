# CODE_INSERT — Rules & Constraints (B8)

Purpose:
CODE_INSERT is a safe helper for MANUAL code insertion by the Monarch.
SG never writes to the repository directly.

Rules:
- Anchor must be UNIQUE (exact string, 1 occurrence).
- Anchor must NOT be near env/secrets/exec/eval.
- mode ∈ before | after | replace.
- content length ≤ 2000 chars.
- SG may REFUSE with explicit reason.
- REFUSE is correct behavior, not an error.

Principle:
Safer refusal > unsafe insertion.

Status:
B8 — validated via runtime refusals.

