# Path A Architecture - Modules, Boundaries, and Phases

## Objective

Establish a browser-grade auth/account architecture where provider-sensitive flows
(especially Google-family) are deterministic, auditable, and policy-driven.

## Core Design Principles

1. **Deterministic flow lifecycle**: each auth flow has explicit state and reason codes.
2. **Provider-agnostic orchestration**: auth orchestration is isolated behind an `AuthBroker`.
3. **Policy before heuristic**: provider behavior is managed by compatibility policies.
4. **First-class telemetry**: each redirect, popup decision, and completion path is traceable.
5. **Incremental migration**: existing runtime can dual-run until Path A ownership is complete.

## Module Boundaries

### 1) Auth Domain (`src/auth`)

- Owns flow lifecycle, transition validity, and completion semantics.
- Exposes provider-neutral contract (`AuthBroker`) for runtime adapters.
- Does not directly depend on Electron `BrowserWindow` or `BrowserView`.

### 2) Compatibility Domain (`src/compatibility`)

- Maps URLs/providers to compatibility policies.
- Decides embedded allow/deny and orchestration strategy intent.
- Does not perform side effects (no popup creation, no URL loading).

### 3) Telemetry Domain (`src/telemetry`)

- Defines canonical event names, categories, and required fields.
- Validates payload shape before event emission.
- Intended to be used by both legacy flow and Path A runtime adapters.

### 4) Runtime Adapters (future integration layer)

- Consumes auth + compatibility + telemetry modules.
- Handles Electron-specific side effects:
  - popup interception
  - tab creation/closure
  - external browser handoff
- Converts runtime signals into domain events and state transitions.

## Data/Control Flow (Target)

1. Runtime adapter sees auth trigger (`window.open`, redirect, explicit login start).
2. Compatibility policy resolves provider strategy.
3. Auth flow state machine starts flow and records initial intent.
4. Runtime adapter performs policy-selected orchestration.
5. Redirect/navigation updates are forwarded into state machine transitions.
6. Telemetry events are emitted for each orchestration and transition checkpoint.
7. Flow reaches terminal state with explicit reason code.

## Migration Phases

### Phase 0 - Baseline Freeze (Done)

- Preserve current behavior and traces in baseline workspaces.

### Phase 1 - Domain Scaffold (This kickoff)

- Add isolated Path A folders/docs.
- Introduce `AuthBroker`, state machine skeleton, telemetry schema, and compatibility policy.

### Phase 2 - Legacy Bridge

- Wrap current `AuthFlowManager` event points through new Path A modules in parallel mode.
- Keep existing behavior; add parity telemetry and state transition validation.

### Phase 3 - Orchestration Ownership Shift

- Move popup/open-redirect decisions from ad hoc logic to compatibility policy decisions.
- Replace direct flow bookkeeping with state machine source of truth.

### Phase 4 - Account Surface Hardening

- Introduce dedicated account/auth runtime surfaces (separate process boundaries if needed).
- Keep provider policy behavior deterministic and test-backed.

### Phase 5 - Legacy Decommission

- Remove redundant legacy auth flow logic once parity and stability are proven.

## Non-Goals for Kickoff

- No replacement of current runtime behavior yet.
- No provider spoofing changes.
- No baseline file modifications.
