---
labels:
  - wayfinder:grilling
parent: ../map.md
assignee:
blocked_by: []
status: closed
---

# Define invitation and access behavior

## Question

How should email invitations and reusable share links be issued, accepted, expired, revoked, and audited in the prototype, and what authorization boundaries apply to Event Owners, Team Managers, Participants, and public visitors?

## Resolution

Use single-use Team Manager email invitations bound to the recipient email and selected Teams. Require magic-link authentication as that email and preserve the invitation destination through sign-in. Also provide Event Owner-created, Team-scoped reusable share links whose authenticated recipients become Team Managers. Use seven-day expiry by default, early revocation, and replacement invitations or links after expiry.

A Team may have multiple Team Managers, each managing its roster and uploading Scoresheets for its Matches. Revoking a link prevents future acceptance but does not remove existing access; removing a Team Manager is a separate owner action. Repeated acceptance is idempotent. Event Owners can view creation, acceptance, revocation, and expiry history, including accepting Users and Team assignments.

Use cryptographically random opaque URL tokens, store only their hashes in PostgreSQL, and keep raw tokens out of audit records and application logs. Event Owners fully administer their Events; Team Managers edit only assigned Teams and upload only their own Match Scoresheets; Participants remain non-account roster records; public visitors see only published Event information, fixtures, results, standings, and statistic leaders.
