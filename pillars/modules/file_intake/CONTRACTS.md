# File-Intake Module — CONTRACTS

Purpose:
- Define the public contract expectations of the File-Intake module.
- Fix the file/media intake and extraction-routing boundary.
- Keep file processing aligned with source-first SG behavior.

Status: CANONICAL
Scope: File-Intake logical interfaces

---

## 0) Contract philosophy

File-Intake contracts define how incoming files/media become bounded extracted payloads.

File-Intake is not SG itself and not SG brain.
It is a modality intake and extraction boundary.

Canonical rule:

```text
file/media -> detection -> extraction -> bounded effective input -> analysis
```

Reasoning may analyze extracted content.
Reasoning must not pretend failed/weak extraction is reliable source evidence.

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
- expose extraction confidence/limitations where relevant
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
- user/project/scope context where relevant

Preconditions:
- input reference is valid enough to process
- file/media origin is known enough for bounded handling
- access to the file is allowed for the current scope

Postconditions:
- file/media enters explicit processing path or controlled failure occurs
- no hidden business logic starts here

Must NOT do:
- assume modality-specific meaning before detection
- skip bounded validation of file/media reference
- leak files across user/project scope

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
- extraction limitations/confidence are visible where they affect trust

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
- weak extraction remains marked as weak if relevant

Must NOT do:
- blur extraction uncertainty
- silently erase critical extraction limitations
- present guessed content as extracted content

---

## 3) Caller obligations

Any caller using File-Intake must:

- provide explicit file/media references
- respect detection and routing steps
- distinguish extracted payload from raw media
- handle extraction failure honestly
- preserve user/project/file scope boundaries

Caller must NOT:
- bypass the file-intake boundary with random modality-specific code
- assume every file is plain text
- treat missing extraction as permission to guess content
- ask AI to replace disciplined extraction without visible uncertainty

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
- file access violates scope/policy

Preferred behavior:
- explicit failure/unknown result
- bounded degradation
- visible extraction limitation

Forbidden behavior:
- fabricated content sold as extracted truth
- hidden modality misclassification
- silent fallback into uncontrolled reasoning
- confident answer from failed extraction

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- skipping type detection where modality matters
- scattering OCR/STT/PDF parsing logic across unrelated handlers
- treating raw media payload as already-interpreted text
- hiding extraction failure behind confident output
- using reasoning AI as a casual replacement for disciplined extraction routing
- treating File-Intake as SG itself or as final factual authority

---

## 7) Future contract expansion

Future additions may include contracts for:

- richer MIME/type classification
- OCR confidence handling
- STT confidence handling
- document structure extraction
- file lifecycle/retention integration
- multimodal extraction bundles
- source lineage for file-derived results

These additions must preserve the same principles:
- explicit
- modality-aware
- bounded
- extraction-first
- failure-visible

---

## 8) Final rule

File-Intake contracts exist so SG can process files/media through clear modality boundaries.

If extraction boundaries become vague,
downstream reasoning becomes unreliable.

File-Intake extracts inputs for SG; it does not become SG.