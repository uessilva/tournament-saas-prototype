# 05: Review a Football Scoresheet and publish its result

**What to build:** A Team Manager can upload a standardized Football Scoresheet, and an Event Owner can review or correct extracted values—or enter the result manually—to publish the Match immediately to public results.

**Blocked by:** 03 — Generate the Football tournament and publish fixtures.

**Status:** done

- [x] The Owner can generate a competition-specific fillable AcroForm PDF with stable fields and QR identity for sheet, template version, and page.
- [x] A Manager can upload a Scoresheet only for Matches involving assigned Teams.
- [x] Original uploads and review images/crops are stored locally with metadata in PostgreSQL.
- [x] The Match visibly moves through awaiting result, in review, and published states separately from Scoresheet processing states.
- [x] Digital AcroForm values are extracted directly; scans use QR identity and a small fixed-region extraction adapter.
- [x] Representative seeded extraction outcomes make the guided demo independent of OCR availability or timing.
- [x] Extraction and email work through the local job model, with leased processing, visible errors, manual Owner retry, and synchronous demo fallback.
- [x] Extracted values retain confidence, validation flags, and source-image crops.
- [x] Every hand-filled scan and flagged digital extraction requires side-by-side Owner review before publication.
- [x] The Owner can correct extracted fields, and reviewer edits remain attributable in history.
- [x] Extraction failure or rejection returns the Match to awaiting result and enables replacement upload or manual entry.
- [x] Previous uploads remain visible in history, with only one active Scoresheet.
- [x] Manual entry records manual as its source and requires explicit Owner confirmation.
- [x] Confirming a valid Football result publishes the Match and updates public results atomically.
- [x] Public visitors see only published results; private review and extraction details remain administrative.
