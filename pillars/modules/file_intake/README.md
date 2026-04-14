# File-Intake Module — README

Purpose:
- Define the File-Intake module as a stable responsibility domain.
- Fix what belongs to incoming file/media handling, type detection, and extraction routing.
- Prevent media/file processing from leaking into random handlers or reasoning paths.

Status: CANONICAL
Scope: File-Intake logical module

---

## 0) Module purpose

The File-Intake module is responsible for:

- receiving incoming files/media from the chat flow
- detecting file/media type
- routing the file to the correct extraction/processing path
- producing bounded extracted text/structure/metadata
- preserving specialized-processing discipline before reasoning

This module exists so SG can work with files without turning raw media handling into chaotic ad hoc logic.

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

Also out of scope:
- using raw media as if it were already normalized text
- replacing specialized extraction with casual reasoning shortcuts

---

## 3) Core idea

File-Intake must answer:

- what kind of file/media is this?
- how should it be processed?
- what can be safely extracted from it?
- what structured output should be handed forward?

It must not answer:
- what the extracted content ultimately means at the business/strategy layer

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

---

## 5) Hard invariants

The following invariants must hold:

- file/media type must be identified explicitly enough before processing
- specialized extraction must not be casually skipped when required
- extracted output must remain bounded and reviewable
- raw media payload must not be treated as already-normalized text
- file-processing failure must remain visible
- File-Intake must remain separate from downstream interpretation logic

---

## 6) Relationship to adjacent modules

File-Intake is closely related to:

- Bot
- Transport
- Logging / Diagnostics
- AI Routing
- Memory
- Sources

But File-Intake does not own those modules.

It owns intake, type detection, and extraction routing boundaries.

---

## 7) Examples of what File-Intake may do

Allowed examples:

- download Telegram file metadata/content
- detect image/pdf/docx/audio/text type
- route image to OCR path
- route audio to STT path
- route PDF/DOCX to parser
- produce extracted text or structured payload
- expose extraction failure reason

These are File-Intake responsibilities.

---

## 8) Examples of what File-Intake must not do

Forbidden examples:

- directly performing deep business analysis of extracted content
- hiding extraction failure and pretending full content exists
- using raw file bytes as if they were already semantic text
- scattering file parsing across random handlers
- silently replacing specialized extraction with generic guesswork

These break modality discipline.

---

## 9) Ownership rule

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

then it belongs elsewhere.

---

## 10) Final rule

File-Intake exists so SG handles media and documents through explicit extraction discipline.

If file/media handling becomes ad hoc,
everything downstream becomes less reliable.