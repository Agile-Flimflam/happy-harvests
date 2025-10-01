## Plantings Lifecycle (Event-Sourced) — Living Spec

Status: Draft (living)

## Implementation status

- Schema updated, migrations run.
- Types regenerated; app switched to new tables.
- Plantings create flows implemented: nursery sow and direct seed (UI + server actions) using new RPCs.
- Nurseries management page added under Setup (`/nurseries`) with list and create/update.

### Purpose
- Define a clean, long-term, event-sourced model for plantings.
- Support optional nursery phase, transplant to field, and a single terminal harvest per planting (no multiple harvests).
- Provide accurate durations for nursery and field phases.
- Track harvest metrics (quantity and weight) per planting.
- Model nursery areas separately from field beds/plots.

### Scope & Assumptions
- Single harvest per planting. Harvest is terminal and ends the planting lifecycle.
- Transplants can start in nursery and later move to a bed (field). Direct seeding skips nursery.
- Movement between beds may be needed; included as a non-terminal event.
- Status is derived from events, not set directly. No generic "status updated" event.

---

## Domain Model

### Key Entities
- plantings: Cohort record with denormalized current pointers and dates for fast queries.
- planting_events: Append-only history of lifecycle actions.
 - nurseries: Named nurseries (e.g., greenhouse, propagation room), linked to farm `locations`.

### Event Types (minimal, non-redundant)
- `nursery_seeded`: Seeds sown in nursery (starts nursery phase). References a `nursery`.
- `direct_seeded`: Seeds sown directly in field (starts field phase). References a `bed`.
- `transplanted`: Moved from nursery to a specific `bed` (starts field phase if coming from nursery).
- `moved`: Moved between beds while in field (non-terminal).
- `harvested`: Single, terminal harvest event for the planting. Records qty and/or weight.
- `removed`: Single, terminal removal (intentional or failed outcome). No harvest.

Notes:
- No STATUS_UPDATED event. Status is always inferred from the latest terminal or non-terminal event in the lifecycle.
- Single HARVESTED event per planting by design; harvesting marks lifecycle end.

### Derived Statuses
- `nursery`: Latest relevant event is `nursery_seeded` and no `transplanted`/`direct_seeded`/`harvested`/`removed` occurred afterward.
- `planted`: Latest relevant event is `direct_seeded` or `transplanted` (and not yet terminal).
- `harvested`: Latest terminal event is `harvested`.
- `removed`: Latest terminal event is `removed`.

### Lifecycle State Machine
- Transplant path: nursery_seeded → transplanted → harvested | removed
- Direct seed path: direct_seeded → harvested | removed
- moved is a self-loop while in planted state.

Constraints:
- Exactly one terminal event maximum (HARVESTED or REMOVED). Once terminal, no further events allowed.
- HARVESTED must include at least one of: `qty_harvested`, `weight_grams`.

---

## Tables (Overview)

- Tables: `nurseries`, `plantings`, `planting_events`.
- Enums: `planting_event_type`, `planting_status`.
- See DDL (consolidated sketch) below for exact SQL definitions.

Status updates (one transaction per action):
- For every lifecycle action, the application starts a transaction, inserts the event into `planting_events`, and updates these `plantings` fields as listed below, then commits.

Per-event field updates
- nursery_seeded
  - status → 'nursery'
  - nursery_started_date → event_date (only if empty)
  - nursery_id → nursery_id
  - bed_id → NULL
- direct_seeded
  - status → 'planted'
  - planted_date → event_date (field start)
  - bed_id → bed_id
  - nursery_id → NULL
- transplanted
  - status → 'planted'
  - planted_date → first non-null (keep existing if already set; else event_date)
  - bed_id → bed_id
  - nursery_id → NULL
- moved
  - bed_id → bed_id
- harvested (terminal)
  - status → 'harvested'
  - ended_date → event_date
- removed (terminal)
  - status → 'removed'
  - ended_date → event_date

### planting_events
```sql
CREATE TABLE planting_events (
  id bigserial PRIMARY KEY,
  planting_id bigint NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  event_type planting_event_type NOT NULL,
  event_date date NOT NULL,
  bed_id int NULL REFERENCES beds(id),
  nursery_id uuid NULL REFERENCES nurseries(id),

  -- Harvest metrics (single harvest per planting)
  qty_harvested int NULL CHECK (qty_harvested IS NULL OR qty_harvested >= 0),
  weight_grams int NULL CHECK (weight_grams IS NULL OR weight_grams >= 0),
  quantity_unit text NULL, -- optional display unit for quantity: 'count', 'bunch', etc.

  payload jsonb NULL,      -- extensible metadata (tray label, reasons, notes)
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Ensure HARVESTED carries at least one measure
  CONSTRAINT harvested_has_metrics CHECK (
    event_type <> 'HARVESTED' OR (COALESCE(qty_harvested, 0) > 0 OR COALESCE(weight_grams, 0) > 0)
  )
);

CREATE INDEX planting_events_pid_idx ON planting_events(planting_id);
CREATE INDEX planting_events_type_date_idx ON planting_events(event_type, event_date);
```

---

## Constraints & Indexes (Guardrails)

- One initial event per planting (nursery_seeded or direct_seeded): partial unique index on `planting_events(planting_id)` WHERE `event_type IN ('nursery_seeded','direct_seeded')`.
- One terminal event per planting (harvested or removed): partial unique index on `planting_events(planting_id)` WHERE `event_type IN ('harvested','removed')`.
- Simple CHECKs on `plantings`:
  - status IN ('nursery','planted','harvested','removed')
  - status='nursery' → bed_id IS NULL
  - status='planted' → bed_id IS NOT NULL
  - status IN ('harvested','removed') → ended_date IS NOT NULL

- Removal context (disambiguation):
  - removed in nursery: status='removed' AND planted_date IS NULL (removed event carries nursery_id, bed_id NULL)
  - removed after planting: status='removed' AND planted_date IS NOT NULL (removed event carries bed_id, nursery_id NULL)
  - DB CHECK on planting_events: event_type <> 'removed' OR ((bed_id IS NULL) <> (nursery_id IS NULL))

No database triggers. The application performs an atomic transaction per action (insert event + update fields).

---

## Durations & Filtering

Definitions:
- Nursery start date: nursery_started_date.
- Field start date: planted_date.
- Terminal date: ended_date (harvested or removed).

Computed durations (app-level):
- nursery_days = max(0, (planted_date or today) − nursery_started_date) if nursery_started_date exists, else 0.
- field_days = max(0, (ended_date or today) − planted_date).
- total_days = max(0, (ended_date or today) − (nursery_started_date or planted_date)).

Filtering examples:
- Current: WHERE status IN ('nursery','planted')
- History: WHERE status IN ('harvested','removed')

---

## Units Policy
- Weight canonical unit: grams (integer). UI can convert to lb/kg.
- Quantity unit: free-text `quantity_unit` for now (e.g., 'count', 'bunch'). Can be enumerated later without breaking stored data.
- HARVESTED requires at least one: `qty_harvested` or `weight_grams`.

---

## UI & Server Actions (Outline)

UI
- Lists segmented: Nursery | Planted | History, default to Nursery+Planted.
- Nursery rows show `nurseries.name` and allow "Transplant" action.
- Planted rows show bed; actions: "Move" and "Record Harvest".
- History shows terminal status, durations, and harvest metrics.

Server actions
- createNurseryPlanting(input: crop_variety_id, qty_initial, nursery_id, event_date, notes?)
  - Tx: insert plantings(status='nursery', nursery_started_date=event_date, planted_date=NULL until transplant, ended_date=NULL, nursery_id, bed_id=NULL, ...); insert `nursery_seeded`
- createDirectSeedPlanting(input: crop_variety_id, qty_initial, bed_id, event_date, notes?)
  - Tx: insert plantings(status='planted', planted_date=event_date, ended_date=NULL, bed_id, nursery_id=NULL, ...); insert `direct_seeded`
- transplantPlanting(input: planting_id, bed_id, event_date)
  - Tx: insert `transplanted`; update plantings(status='planted', planted_date=COALESCE(planted_date, event_date), bed_id, nursery_id=NULL)
- movePlanting(input: planting_id, bed_id, event_date)
  - Tx: insert `moved`; update plantings(bed_id)
- harvestPlanting(input: planting_id, event_date, qty_harvested?, weight_grams?, quantity_unit?)
  - Tx: insert `harvested`; update plantings(status='harvested', ended_date=event_date)
- removePlanting(input: planting_id, event_date, reason?)
  - Tx: insert `removed` (payload.reason optional); update plantings(status='removed', ended_date=event_date)

Validation
- Nursery creation requires `nursery_id`; must not set `bed_id`.
- Direct seed requires `bed_id` and date.
- Transplant requires `bed_id` and date.
- Harvest requires at least one metric.
- No events after terminal.

---

## Pending work

- Transplant, Move, Harvest, and Remove UI dialogs (forms + wiring to RPCs).
- Replace any residual legacy references; ensure Plantings list fully reflects new fields/statuses everywhere.

## DDL (consolidated sketch)

```sql
-- Enums
CREATE TYPE planting_event_type AS ENUM (
  'nursery_seeded', 'direct_seeded', 'transplanted', 'moved', 'harvested', 'removed'
);

CREATE TYPE planting_status AS ENUM (
  'nursery', 'planted', 'harvested', 'removed'
);

-- Nurseries
CREATE TABLE nurseries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL REFERENCES locations(id),
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Plantings (current state + pointers)
CREATE TABLE plantings (
  id bigserial PRIMARY KEY,
  crop_variety_id int NOT NULL REFERENCES crop_varieties(id),
  propagation_method text NOT NULL CHECK (propagation_method IN ('Direct Seed','Transplant')),
  qty_initial int NOT NULL CHECK (qty_initial > 0),

  status planting_status NOT NULL,
  nursery_started_date date NULL,
  planted_date date NOT NULL,
  ended_date date NULL,
  bed_id int NULL REFERENCES beds(id),
  nursery_id uuid NULL REFERENCES nurseries(id),

  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plantings_status_idx ON plantings(status);
CREATE INDEX plantings_bed_idx ON plantings(bed_id);
CREATE INDEX plantings_nursery_idx ON plantings(nursery_id);

-- Events (append-only)
CREATE TABLE planting_events (
  id bigserial PRIMARY KEY,
  planting_id bigint NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  event_type planting_event_type NOT NULL,
  event_date date NOT NULL,
  bed_id int NULL REFERENCES beds(id),
  nursery_id uuid NULL REFERENCES nurseries(id),

  qty_harvested int NULL CHECK (qty_harvested IS NULL OR qty_harvested >= 0),
  weight_grams int NULL CHECK (weight_grams IS NULL OR weight_grams >= 0),
  quantity_unit text NULL,

  payload jsonb NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT harvested_has_metrics CHECK (
    event_type <> 'harvested' OR (COALESCE(qty_harvested, 0) > 0 OR COALESCE(weight_grams, 0) > 0)
  )
);

CREATE INDEX planting_events_pid_idx ON planting_events(planting_id);
CREATE INDEX planting_events_type_date_idx ON planting_events(event_type, event_date);

-- Guardrails
CREATE UNIQUE INDEX one_initial_event_per_planting
  ON planting_events(planting_id)
  WHERE event_type IN ('nursery_seeded','direct_seeded');

CREATE UNIQUE INDEX one_terminal_event_per_planting
  ON planting_events(planting_id)
  WHERE event_type IN ('harvested','removed');

ALTER TABLE plantings ADD CONSTRAINT plantings_status_check
  CHECK (status IN ('nursery','planted','harvested','removed'));

ALTER TABLE plantings ADD CONSTRAINT plantings_bed_consistency
  CHECK ((status = 'nursery' AND bed_id IS NULL) OR (status IN ('planted','harvested','removed') AND bed_id IS NOT NULL));

ALTER TABLE plantings ADD CONSTRAINT plantings_terminal_has_end
  CHECK ((status IN ('harvested','removed') AND ended_date IS NOT NULL) OR (status IN ('nursery','planted')));
```