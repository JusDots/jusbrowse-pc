# Path A Release Signoff Checklist (Strict)

This is the strict release gate for enabling Path A cutover and allowing post-signoff legacy removal work.

## A) Automated Gate (Must Pass)

- [ ] `npm run patha:auto-check` returns `Overall: PASS`
- [ ] `npm test` passes with zero failures
- [ ] `latest-report.md` is refreshed in current release window
- [ ] No missing correlation IDs (`0%`)
- [ ] No duplicate terminal summaries (`0`)
- [ ] No invalid telemetry events (`0`)

## B) Manual Parity Gate (Must Pass)

- [ ] All Google-family scenarios executed and marked `PASS`/`FAIL`
- [ ] All non-Google scenarios executed and marked `PASS`/`FAIL`
- [ ] Popup variations validated (`external-browser`, `managed-tab`)
- [ ] Domain-leave paths validated across provider cohorts
- [ ] No scenario remains `PENDING`
- [ ] Every `FAIL` has mismatch record with owner + ETA + rollback impact

Evidence file:

- `JB_C/path-a/artifacts/manual-parity/latest-manual-parity.md`

## C) Staged Rollout Gate (Must Pass)

- [ ] Checkpoint 1 (canary) completed and recorded
- [ ] Checkpoint 2 (expanded) completed and recorded
- [ ] Checkpoint 3 (near-full pre-cutover) completed and recorded
- [ ] Completion regression within `-2.0%`
- [ ] Blocked regression within `+5.0%`
- [ ] Left-auth-domain growth within `+30%`
- [ ] Correlation IDs remain complete (`0%` missing)
- [ ] Duplicate terminals remain `0`

Recommended command per checkpoint (captures diagnostics verdict + current flagship status):

- `npm run patha:rollout-checkpoint -- <checkpoint-label> <current.json> [more-current.json ...] --baseline <baseline.json> [more-baseline.json ...]`

Evidence file:

- `JB_C/path-a/artifacts/staged-rollout/latest-staged-rollout.md`

## D) Documentation and Bundle Gate (Must Pass)

- [ ] `migration-checklist.md` pending items reflect true state
- [ ] `parity-matrix-checklist.md` signoff section updated
- [ ] `cutover-readiness-criteria.md` checkpoint status aligns with evidence
- [ ] `npm run patha:bundle-readiness` generated fresh bundle
- [ ] `latest-readiness-bundle.md` verdict reviewed by runtime owner and QA lead

Evidence files:

- `JB_C/path-a/artifacts/signoff/latest-readiness-bundle.md`
- `JB_C/path-a/artifacts/signoff/latest-readiness-bundle.json`

## E) Signoff and Runtime Safety Gate (Must Pass)

- [ ] Runtime owner signoff captured
- [ ] QA lead signoff captured
- [ ] Rollback trigger conditions re-confirmed
- [ ] No legacy runtime deletion performed before all above gates pass

## F) Final Decision

- [ ] Verdict = `GO` only when sections A-E are all complete
- [ ] If any item is unchecked, verdict remains `NO_GO`
- [ ] If `NO_GO`, continue dual-run and preserve existing auth/runtime behavior
