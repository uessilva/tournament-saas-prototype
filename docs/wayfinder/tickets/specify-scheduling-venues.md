---
labels:
  - wayfinder:grilling
parent: ../map.md
assignee: opencode
blocked_by: []
status: closed
---

# Specify scheduling and venue behavior

## Question

What scheduling, venue, and calendar behavior must the prototype support beyond generated fixtures? Decide how Event Owners assign dates, times, and venues; how changes affect Team Managers and public audiences; and which calendar or scheduling features are unnecessary for the guided demo.

## Resolution

Matches have optional start times, durations, and Event-scoped Venues; unscheduled and partially scheduled Matches remain valid. Venues are simple reusable labels without addresses, capacities, maps, or independent availability rules.

Each Event has one explicit time zone used for scheduling and fixture display, seeded to `America/Sao_Paulo` for Summer Cup 2026. Changing the Event time zone preserves each Match's local wall-clock date and time. Each Competition has a default Match duration that can be overridden per Match; duration supports end-time display and overlap validation only.

Block overlapping Matches involving the same Team or assigned to the same Venue, with no Event Owner override or administrative bypass. Team conflicts apply regardless of Venue; Venue conflicts require the same assigned Venue. Run checks whenever start times, durations, and the relevant Venue data are available. Resolve conflicts by changing the schedule, Venue, or participating Teams.

Schedule changes immediately update authenticated and public views without separate publication or notifications. Provide date-grouped fixture lists with Competition filters, labelled with the Event time zone. Exclude automated scheduling, conflict optimization, venue availability management, external calendar feeds, `.ics` exports, and personal calendar synchronization.
