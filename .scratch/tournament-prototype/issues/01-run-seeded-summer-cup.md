# 01: Run the seeded Summer Cup prototype

**What to build:** A presenter can start the application locally, sign in through Mailpit, switch between seeded demo accounts, reset Summer Cup 2026, and open a basic public Event hub without authentication.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The documented local setup starts Next.js, PostgreSQL, Mailpit, and the local job worker or synchronous fallback.
- [x] Drizzle migrations and a repeatable one-command seed/reset create Summer Cup 2026 with fictitious people and contact details.
- [x] Under-12 Football and Tennis Open exist as seeded Competitions with realistic starting data.
- [x] Auth.js email magic links work through Mailpit, and a development-only account switcher selects seeded Owner and Team Manager accounts.
- [x] Owner administration requires authentication and demo reset controls are protected.
- [x] A public visitor can open the Summer Cup Event hub and navigate to a basic Competition overview without signing in.
- [x] The Event hub establishes the approved Event-hub navigation and initial Summer Cup visual direction without dead controls on its implemented path.
