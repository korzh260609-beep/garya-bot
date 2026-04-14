# File-Intake Module — RISKS

Purpose:
- Document the main risk surface of the File-Intake module.
- Prevent modality confusion, fake extraction confidence, and scattered parser logic.
- Keep file/media processing explicit and trustworthy.

Status: CANONICAL
Scope: File-Intake module risk model

---

## 0) Why this file matters

File/media processing fails in subtle ways:

- wrong type detected
- text extraction incomplete
- OCR/STT confidence poor
- parser unavailable
- unsupported format treated as if understood

These failures are dangerous because the system may still sound confident.

This file exists to make those risks explicit.

---

## 1) Primary risks

### R-01: Wrong modality classification
Description:
- file/media type is detected incorrectly

Consequence:
- wrong parser/extractor path
- low-quality extracted result
- misleading downstream reasoning

Signal:
- extractor receives content it was not meant to process

---

### R-02: Extraction failure is hidden
Description:
- OCR/STT/parser failure occurs but is not surfaced clearly

Consequence:
- downstream features act on missing or partial data
- user/operator trust drops
- debugging becomes harder

Signal:
- system responds confidently despite poor/failed extraction

---

### R-03: Raw media is treated like extracted text
Description:
- raw file/media payload is used as if it were already semantically processed

Consequence:
- modality confusion
- poor downstream quality
- hidden reliability loss

Signal:
- downstream modules do not know whether input is raw or extracted

---

### R-04: Parser logic is scattered
Description:
- file/media processing code appears in many unrelated places

Consequence:
- duplicated bugs
- inconsistent extraction quality
- harder upgrades/refactors

Signal:
- handlers/services own their own ad hoc OCR/STT/PDF parsing logic

---

### R-05: Missing extraction is replaced with guesswork
Description:
- system guesses what was in the file/media instead of exposing uncertainty

Consequence:
- false confidence
- misleading outputs
- trust damage

Signal:
- strong semantic conclusions from weak or failed extraction

---

### R-06: Docs drift from actual File-Intake behavior
Description:
- module behavior evolves but docs stay stale

Consequence:
- humans and AI build on false assumptions
- modality bugs become easier to introduce

Signal:
- docs describe one intake/extraction model, runtime behaves another way

---

## 2) Secondary risks

### R-07: Over-processing simple files
Consequence:
- unnecessary complexity/cost

### R-08: Under-processing rich files
Consequence:
- useful structure is lost

### R-09: Unsupported format handling is vague
Consequence:
- bad operator/user visibility

### R-10: Extracted payloads are unbounded
Consequence:
- noisy downstream behavior

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “it is probably just text”
- “OCR/STT probably got enough”
- “if parser failed, reasoning can fill the gaps”
- “one small parser shortcut is harmless”
- “users do not need to know extraction quality was weak”
- “raw file and extracted content are basically the same”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after File-Intake changes

After any meaningful File-Intake change, verify:

1. type detection still works reviewably
2. extraction failures remain visible
3. raw-vs-extracted distinction still holds
4. parsing logic did not spread across unrelated modules
5. unsupported/unknown formats remain explicit
6. docs still match actual file-intake behavior

---

## 5) Risk handling strategy

Preferred defenses:

- explicit type detection
- explicit extraction routing
- visible extraction limits/failures
- clear raw-vs-extracted distinction
- bounded extracted payloads
- stale-doc detection

Avoid fake safety:
- confident output from weak extraction
- hidden parser fallback guessing
- modality shortcuts scattered in handlers
- pretending unsupported formats are “close enough”

---

## 6) Highest-priority rule

The most dangerous File-Intake bug is not “file could not be parsed”.

The most dangerous bug is:
“file parsing was weak or wrong, but the system still speaks as if extraction was solid.”

That quietly destroys reliability.