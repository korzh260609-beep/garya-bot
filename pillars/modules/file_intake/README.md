# File-Intake Module — README

Purpose:
- Define the File-Intake module as a stable responsibility domain.
- Fix what belongs to incoming file/media handling, type detection, and extraction routing.
- Prevent media/file processing from leaking into random handlers or reasoning paths.
- Keep file processing aligned with privacy, cost, source and controlled-action boundaries.

Status: CANONICAL
Scope: File-Intake logical module

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/PERMISSIONS_MAP.md`
- `pillars/modules/ai_routing/README.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Module purpose

The File-Intake module is responsible for:

- receiving incoming files/media from the chat flow
- detecting file/media type
- routing the file to the correct extraction/processing path
- producing bounded extracted text/structure/metadata
- preserving specialized-processing discipline before reasoning

This module exists so SG can work with files without turning raw media handling into chaotic ad hoc logic.

File-Intake is a component/instrument of SG. It is not SG itself and not a source of verified truth by itself.

---

## 1) In scope

File-Intake includes responsibilities such as:

- file/media intake
- type detection
- file routing
- extraction pipeline selection
- OCR/STT/PDF/DOCX/TXT parsing entry
- effective extracted text/structured payload handoff
- file-processing observability hooks
- extraction limits/failure state
- privacy/cost-aware processing boundaries

Typical related code areas may include:
- file-download helpers
- media-type detection
- OCR/STT routing helpers
- document parsing entrypoints
- extracted text/metadata shaping helpers

---

## 2) Out of scope

The File-Intake module must NOT own:

- transport parsing itself
- business feature logic built on extracted content
- permission policy itself
- memory semantics
- general AI reasoning policy
- repository indexing logic
- final strategic interpretation of extracted data
- SG philosophy, identity, governance, or accepted decisions

Also out of scope:
- using raw media as if it were already normalized text
- replacing specialized extraction with casual reasoning shortcuts
- treating extracted content as verified truth without downstream validation

---

## 3) Core idea

File-Intake must answer:

- what kind of file/media is this?
- how should it be processed?
- what can be safely extracted from it?
- what structured output should be handed forward?
- what extraction limits/failures are present?

It must not answer:
- what the extracted content ultimately means at the business/strategy layer
- whether protected actions should happen from the content

That distinction must remain hard.

---

## 4) Core responsibilities

The File-Intake module is responsible for:

1. accepting incoming file/media references
2. detecting file/media type
3. choosing the correct extraction path
4. producing bounded extracted result
5. exposing extracted payload forward in usable form
6. making file-processing failures visible
7. respecting privacy, scope and cost boundaries during extraction

---

## 5) Hard invariants

The following invariants must hold:

- file/media type must be identified explicitly enough before processing
- specialized extraction must not be casually skipped when required
- extracted output must remain bounded and reviewable
- raw media payload must not be treated as already-normalized text
- file-processing failure must remain visible
- File-Intake must remain separate from downstream interpretation logic
- file processing must not bypass permissions/private scope
- expensive processing must respect cost warning/confirmation policy where configured

---

## 6) Controlled-action rule

File processing may involve:

```text
read-only extraction
analysis-only downstream interpretation
private-data access
expensive/costly processing
state-changing storage/write
```

Rules:
- extraction output is bounded source material, not automatically verified truth;
- private files must respect user/project/scope boundaries;
- expensive OCR/STT/vision/document processing may require cost warning/confirmation where configured;
- durable storage of extracted content is a separate controlled action;
- denied processing may still allow explanation or safer alternative path.

---

## 7) Relationship to adjacent modules

File-Intake is closely related to:

- Bot
- Transport
- Logging / Diagnostics
- AI Routing
- Memory
- Sources
- Users / Access

But File-Intake does not own those modules.

It owns intake, type detection, and extraction routing boundaries.

---

## 8) Examples of what File-Intake may do

Allowed examples:

- download Telegram file metadata/content
- detect image/pdf/docx/audio/text type
- route image to OCR path
- route audio to STT path
- route PDF/DOCX to parser
- produce extracted text or structured payload
- expose extraction failure reason
- hand bounded extracted content to downstream module

These are File-Intake responsibilities.

---

## 9) Examples of what File-Intake must not do

Forbidden examples:

- directly performing deep business analysis of extracted content
- hiding extraction failure and pretending full content exists
- using raw file bytes as if they were already semantic text
- scattering file parsing across random handlers
- silently replacing specialized extraction with generic guesswork
- writing extracted private content into memory without controlled policy
- bypassing AI Routing for expensive extraction/analysis paths

These break modality discipline.

---

## 10) Ownership rule

If the question is:
- what file type this is
- how to process this modality
- what extractor/parser path should be used
- what bounded extracted content should be passed onward

it belongs here.

If the question is:
- what the extracted content means
- whether the user may do something with it
- how it should be stored long-term
- how AI should reason about it after extraction
- whether a protected action should happen because of it

then it belongs elsewhere.

---

## 11) Final rule

File-Intake exists so SG handles media and documents through explicit extraction discipline.

If file/media handling becomes ad hoc,
everything downstream becomes less reliable.

If File-Intake starts acting as analysis/governance authority,
the module boundary is broken.