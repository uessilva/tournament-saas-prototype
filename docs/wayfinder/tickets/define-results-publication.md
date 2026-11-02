---
labels:
  - wayfinder:grilling
parent: ../map.md
assignee:
blocked_by:
  - investigate-pdf-extraction.md
  - specify-competition-rules.md
status: closed
---

# Define result review and publication behavior

## Question

What states should a Match and uploaded Scoresheet pass through before results become public, who may review and correct them, and how should standings and sport-specific statistic leaders recalculate after confirmation or correction?

## Resolution

A Match moves through `awaiting_result → in_review → published`. Its Scoresheet separately moves through `uploaded → processing → needs_review → confirmed`, with explicit `extraction_failed` and `rejected` outcomes returning the Match to `awaiting_result`. Team Managers upload only for their own Matches. Only the Event Owner reviews and corrects extracted values, confirms or rejects Scoresheets, or enters results manually.

Confirming a valid Scoresheet publishes the Match immediately and atomically. Extraction failure or rejection enables either a replacement upload or Event Owner manual entry. Retain previous uploads, allow only one active Scoresheet, and record manual results with `manual` as their source and explicit owner confirmation.

Published corrections require a reason, create a new confirmed result version, retain prior versions and reviewer edits, and immediately update public results. Correction reasons appear in the owner’s audit history but not publicly. Every confirmation or correction recalculates the affected Competition from all current confirmed result versions in the same database transaction.

Public statistic leaders cover football goals and assists, and tennis aces and double faults. Walkovers contribute none of these statistics.
