## Observability (PostHog) — Flow Telemetry

Status: Draft (Phase 10)

### Event catalog (PostHog)

- `flow_step_view` / `flow_step_submit` / `flow_step_result` / `flow_drop`
  - Required props: `flowId`, `stepId`, `elapsedMs`, `correlationId`
  - `flow_step_result` adds `outcome`, optional `errorCode`; drop includes `reason`
- `inline_sheet_open` / `inline_sheet_submit` / `inline_sheet_result`
  - Props: `sheetId`, `flowId`, `correlationId`, `attempt` (submit), `durationMs`, `outcome`, `errorCode`
- `quick_action_trigger` / `quick_action_blocked`
  - Props: `actionId`, `allowed`, `blockedReason?`, `missingDependency?`, `correlationId`, `elapsedMs`
- `undo_action` / `retry_action`
  - Props: `target`, `outcome` (`attempt`|`success`|`error`), `durationMs?`, `errorCode?`, `correlationId`

### Dashboards (PostHog)

- Flow health: drop-off, time-to-complete, and error-rate per `flowId` (guided flows, inline sheets).
- Dependency-aware quick actions: blocked vs allowed per `actionId`, with missing dependency breakdown.
- Recovery paths: undo and retry outcomes per `target`, including duration.

### Alerts (suggested)

- Error-rate >5% for any `flowId` over 30m.
- Inline sheet duration p95 > 12s for `quick-*` sheets.
- Quick action blocked rate >20% for any `actionId`.

### Notes

- Correlation IDs are attached from server actions when available; avoid sending PII in props.
- PostHog dev console logging is enabled when no client key is present (see `src/lib/telemetry.ts`).
