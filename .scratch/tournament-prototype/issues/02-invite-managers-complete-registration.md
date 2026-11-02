# 02: Invite Team Managers and complete registration

**What to build:** An Event Owner can delegate selected Teams to Team Managers, who authenticate and manage only those rosters while registration is open; the Owner can validate entrants and close registration for tournament generation.

**Blocked by:** 01 — Run the seeded Summer Cup prototype.

**Status:** done

- [x] An Owner can create email invitations bound to a recipient and selected Teams, and create Team-scoped reusable share links.
- [x] Invitation and link tokens are opaque and cryptographically random, only hashes are persisted, and raw tokens never appear in audit records or application logs.
- [x] Both invitation kinds expire after seven days by default and can be revoked and replaced.
- [x] Email acceptance requires magic-link authentication as the invited recipient and preserves the invitation destination through sign-in.
- [x] Reusable-link acceptance requires authentication and adds the accepting User as a Manager of the selected Teams.
- [x] Repeated acceptance is idempotent; expired or revoked credentials cannot be accepted.
- [x] Revoking a reusable link prevents future acceptance without removing existing Managers, and removing a Manager is a separate Owner action.
- [x] A Team can have multiple Managers, and Managers can edit only their assigned Team rosters.
- [x] Participants do not require accounts, and Participant uniqueness, allowed birth dates, and roster-size rules are enforced within each Competition.
- [x] Tennis singles entrants are represented as one-Participant Teams.
- [x] Registration supports Owner-controlled open/closed states and an optional Event-time-zone deadline; elapsed deadlines close registration until extended.
- [x] Closed registration blocks entrant additions/removals and roster edits, and manual reopening is possible only before tournament generation.
- [x] An Owner can view invitation creation, acceptance, revocation, expiry, accepting Users, and Team assignments in access history.
- [x] Pending-invitation and Mailpit shortcuts are available only in the protected demo UI.
