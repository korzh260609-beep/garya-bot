# documents — SG 2.0 Documents Module

> AGENT NOTE:
> This file defines the SG 2.0 documents/file-intake module boundary.
> Read it before adding PDF parsing, DOCX parsing, image/OCR extraction, voice-to-text, or file ingestion.
> Do not pass untrusted file content directly into AI or memory without validation and policy checks.

Статус: FUTURE SKELETON

---

## Purpose

`documents` handles file intake and text/data extraction.

---

## Owns

- file type detection;
- document parsing boundary;
- extracted text normalization;
- file metadata;
- future OCR/voice-to-text handoff;
- safety limits for file processing.

---

## Must not own

- final AI reasoning;
- memory write decisions;
- permission policy ownership;
- transport-specific upload logic;
- task scheduling.

---

## Hard rule

Files are sources, not automatically trusted truth.
