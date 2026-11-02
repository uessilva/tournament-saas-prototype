# 02: Invite Team Managers and complete registration

**What to build:** An Event Owner can delegate selected Teams to Team Managers, who authenticate and manage only those rosters while registration is open; the Owner can validate entrants and close registration for tournament generation.

**Blocked by:** 01 — Run the seeded Summer Cup prototype.

**Status:** ready-for-agent

- [ ] An Owner can create email invitations bound to a recipient and selected Teams, and create Team-scoped reusable share links.
- [ ] Invitation and link tokens are opaque and cryptographically random, only hashes are persisted, and raw tokens never appear in audit records or application logs.
- [ ] Both invitation kinds expire after seven days by default and can be revoked and replaced.
- [ ] Email acceptance requires magic-link authentication as the invited recipient and preserves the invitation destination through sign-in.
- [ ] Reusable-link acceptance requires authentication and adds the accepting User as a Manager of the selected Teams.
- [ ] Repeated acceptance is idempotent; expired or revoked credentials cannot be accepted.
- [ ] Revoking a reusable link prevents future acceptance without removing existing Managers, and removing a Manager is a separate Owner action.
- [ ] A Team can have multiple Managers, and Managers can edit only their assigned Team rosters.
- [ ] Participants do not require accounts, and Participant uniqueness, allowed birth dates, and roster-size rules are enforced within each Competition.
- [ ] Tennis singles entrants are represented as one-Participant Teams.
- [ ] Registration supports Owner-controlled open/closed states and an optional Event-time-zone deadline; elapsed deadlines close registration until extended.
- [ ] Closed registration blocks entrant additions/removals and roster edits, and manual reopening is possible only before tournament generation.
- [ ] An Owner can view invitation creation, acceptance, revocation, expiry, accepting Users, and Team assignments in access history.
- [ ] Pending-invitation and Mailpit shortcuts are available only in the protected demo UI.
