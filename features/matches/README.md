# Matches feature boundary

Scheduling, conflict validation, result entry/review, corrections, cancellations,
and private disputes belong here. Public fixture/result reads currently live in
`features/public` and will reuse the same persisted match/result-version model.

The schema foundation already includes `matches`, `match_entries`,
`result_versions`, `football_results`, `tennis_results`, `participant_statistics`,
and `disputes`.
