# File-Intake Module — CONTRACTS

Purpose:
- Define the public contract expectations of the File-Intake module.
- Fix the file/media intake and extraction-routing boundary.
- Reduce guessing during future file-processing work.

Status: CANONICAL
Scope: File-Intake logical interfaces

---

## 0) Contract philosophy

File-Intake contracts define how incoming files/media become bounded extracted payloads.

This file does not require exact current implementation names.
It defines the contract shape that future file-intake work must preserve.

If implementation diverges, that divergence must be made explicit.

---

## 1) Canonical boundary

File/media-related processing must go through an explicit file-intake boundary.

Canonical logical capabilities may include:

- intake file/media reference
- detect type
- choose processing route
- extract text/structure
- return bounded extracted result

The exact file/function names may evolve.
The boundary itself must remain explicit.

---

## 2) Contract set

### 2.1 `intake(fileRef, ...)`
Purpose:
- accept one incoming file/media reference into the processing boundary

Expected input:
- explicit file/media reference
- minimal metadata if available
- origin context if needed

Preconditions:
- input reference is valid enough to process
- file/media origin is known enough for bounded handling

Postconditions:
- file/media enters explicit processing path or controlled failure occurs
- no hidden business logic starts here

Must NOT do:
- assume modality-specific meaning before detection
- skip bounded validation of file/media reference

---

### 2.2 `detectType(fileRefOrMeta, ...)`
Purpose:
- determine file/media type for routing

Expected input:
- file reference and/or file metadata
- optional hints such as mime/extension/source metadata

Preconditions:
- file reference/metadata exists
- enough information is available for detection or controlled ambiguity

Postconditions:
- returns explicit type/classification or controlled unknown result
- downstream routing can proceed reviewably

Must NOT do:
- silently pretend unknown type is safe known text
- hide ambiguity that affects routing correctness

---

### 2.3 `routeByType(type, fileRef, ...)`
Purpose:
- choose the correct extraction path for the detected modality

Expected input:
- explicit detected type
- file reference
- optional routing context

Preconditions:
- type is explicit enough
- supported route exists or controlled failure/fallback is defined

Postconditions:
- correct extractor/parser path is chosen
- modality discipline remains visible

Must NOT do:
- use one generic path for all modalities where specialization is required
- hide unsupported-modality state

---

### 2.4 `extract(fileRef, route, ...)`
Purpose:
- produce bounded extracted text/structure/metadata from the chosen route

Expected input:
- file reference
- explicit extraction route
- optional bounded extraction settings

Preconditions:
- route is explicit
- file/media is processable enough
- extractor dependencies are available or controlled failure occurs

Postconditions:
- returns bounded extracted result or explicit extraction failure
- downstream layers receive extracted payload, not raw modality confusion

Must NOT do:
- fabricate extracted content
- hide extraction loss/failure
- turn extraction into uncontrolled reasoning

---

### 2.5 `toEffectiveInput(extractedResult, ...)`
Purpose:
- shape extracted output into bounded downstream-usable input

Expected input:
- extracted text/structured payload
- optional downstream context

Preconditions:
- extraction already completed or equivalent structured input exists

Postconditions:
- downstream module receives usable bounded payload
- extracted content remains distinguishable from original raw file/media

Must NOT do:
- blur extraction uncertainty
- silently erase critical extraction limitations

---

## 3) Caller obligations

Any caller using File-Intake must:

- provide explicit file/media references
- respect detection and routing steps
- distinguish extracted payload from raw media
- handle extraction failure honestly

Caller must NOT:
- bypass the file-intake boundary with random modality-specific code
- assume every file is plain text
- treat missing extraction as permission to guess content

---

## 4) Side effects

File-Intake operations may have side effects such as:

- file download/read
- type classification
- extraction processing
- extraction diagnostics/logging
- bounded extracted payload generation

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

File-Intake operations should fail in a controlled way when:

- file reference is invalid
- type is unknown/unsupported
- extractor dependency is unavailable
- file payload is malformed/corrupted
- extraction fails
- resulting payload exceeds bounds

Preferred behavior:
- explicit failure/unknown result
- bounded degradation
- visible extraction limitation

Forbidden behavior:
- fabricated content sold as extracted truth
- hidden modality misclassification
- silent fallback into uncontrolled reasoning

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- skipping type detection where modality matters
- scattering OCR/STT/PDF parsing logic across unrelated handlers
- treating raw media payload as already-interpreted text
- hiding extraction failure behind confident output
- using reasoning AI as a casual replacement for disciplined extraction routing

---

## 7) Future contract expansion

Future additions may include contracts for:

- richer MIME/type classification
- OCR confidence handling
- STT confidence handling
- document structure extraction
- file lifecycle/retention integration
- multimodal extraction bundles

These additions must preserve the same principles:
- explicit
- modality-aware
- bounded
- extraction-first

---

## 8) Final rule

File-Intake contracts exist so SG can process files/media through clear modality boundaries.

If extraction boundaries become vague,
downstream reasoning becomes unreliable.