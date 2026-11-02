---
labels:
  - wayfinder:grilling
parent: ../map.md
assignee: opencode
blocked_by: []
status: closed
---

# Define additional competition lifecycle controls

## Question

Which registration closing, cancellation, and dispute controls are necessary for the guided prototype, and how should they affect generated fixtures, published results, and public pages?

## Resolution

Competition registration has Owner-controlled open and closed states plus an optional deadline expressed in the Event time zone. An elapsed deadline closes registration until the Owner extends it. Closing prevents entrant additions or removals and roster edits; the Owner may manually close or reopen registration only before tournament generation.

Owners may cancel an unplayed Match with an internal reason. A cancelled Match remains visible on schedules and public pages, is excluded from standings and results, and retains its Scoresheet history. Owners may also cancel an entire Competition with a required public note, making its fixtures and published results read-only, blocking further changes, and displaying a prominent cancelled status. Both cancellation types are reversible by the Owner when no conflicting activity must first be corrected, with restoration preserving the audit trail.

Team Managers may open one active dispute per published Match with a required explanation. Owners resolve or dismiss disputes with a required response; an open dispute does not unpublish or change the result. Resolving an upheld dispute may link to a separate reasoned result-correction version. Disputes, explanations, and responses remain visible only to the Owner and Managers of the Teams involved, with no public dispute labels or explanations.
