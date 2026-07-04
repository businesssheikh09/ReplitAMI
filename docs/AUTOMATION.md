# Automation

**Purpose**: Scheduled background tasks that send proactive WhatsApp notifications to customers, vendors, and management — eliminating manual follow-ups for recurring operational events.  
**Engine**: `artifacts/api-server/src/services/automation-engine.ts`  
**Scheduler**: `artifacts/api-server/src/services/automation-scheduler.ts`  
**Automation handlers**: `artifacts/api-server/src/services/automations/`  
**ERP page**: `/automation-settings`, `/automation-logs`  

---

## Architecture

```
automation-scheduler.ts (node-cron)
  ├── Checks automation_configs.enabled before each run
  ├── Calls runAutomationByType(type)
  └── Passes to automation-engine.ts

automation-engine.ts
  ├── In-memory Set prevents concurrent runs of same type
  ├── Updates automation_configs (last_run_at, status, counts)
  ├── Inserts automation_logs record
  └── Calls the specific automation handler

Automation handler
  ├── Queries database for relevant entities
  ├── Checks for duplicates (already sent today?)
  ├── Formats WhatsApp message from website_config.wa_templates
  └── Sends via wa-helper.ts → whatsapp.ts
```

---

## Automation Scheduler

`automation-scheduler.ts` registers 8 automations using `node-cron`:

| Type | Default Cron | Schedule |
|---|---|---|
| `payment_reminder` | `0 9 * * *` | Daily 09:00 |
| `hotel_checkin_reminder` | `0 8 * * *` | Daily 08:00 |
| `hotel_vendor_followup` | `0 */4 * * *` | Every 4 hours |
| `flight_reminder` | `0 * * * *` | Hourly |
| `passport_expiry` | `0 10 * * 1` | Mondays 10:00 |
| `visa_expiry` | `0 10 * * 1` | Mondays 10:00 |
| `management_summary` | `0 8 * * *` | Daily 08:00 |
| `pending_approvals` | `0 */2 * * *` | Every 2 hours |

Cron expressions can be overridden per automation via `PATCH /api/automations/:type { cronExpression }`.

---

## Automation Engine

`automation-engine.ts` provides concurrency protection and unified logging.

### Concurrency Control
An in-memory `Set<string>` tracks currently-running automation types. If a cron tick fires while the previous run is still in progress, the new tick is skipped.

### Run Lifecycle
```
Start run
  → check in-memory Set (skip if running)
  → add type to Set
  → update automation_configs.last_status = 'running'
  → call handler function
  → on success: update last_status = 'success', increment success_count
  → on partial: update last_status = 'partial'
  → on failure: update last_status = 'failure', increment failure_count
  → insert automation_logs record
  → remove from Set
```

### Duplicate Detection
Each handler checks `automation_logs` for a successful run of the same type **today** for the same recipient before sending. This prevents re-sending if the automation runs multiple times (e.g., after a cron expression change).

---

## Automation Handlers

### `payment_reminder.ts` — Daily 09:00

**Purpose**: Reminds clients about overdue invoices.

**Logic**:
1. Queries `invoices` where `status != 'paid'` and `due_date < today`
2. Calculates overdue intervals: 1, 2, 7, 14, 30 days
3. For each overdue invoice at a tracked interval:
   - Loads client WhatsApp number
   - Formats message with invoice number, amount, overdue days
   - Sends via wa-helper
4. Duplicate-checked: one message per invoice per day

**Tables read**: `invoices`, `clients`, `automation_logs`

---

### `hotel_checkin_reminder.ts` — Daily 08:00

**Purpose**: Notifies guests about tomorrow's hotel check-in.

**Logic**:
1. Queries `hotel_requests` where `check_in = tomorrow` and `status = 'confirmed'` or `'invoiced'`
2. For each request:
   - Loads client WhatsApp number
   - Formats message with hotel name, reference, check-in time, room type
   - Sends via wa-helper
3. Duplicate-checked per request per day

**Tables read**: `hotel_requests`, `hotels`, `clients`, `automation_logs`

---

### `hotel_vendor_followup.ts` — Every 4 Hours

**Purpose**: Follows up with hotel vendors who haven't responded to procurement requests.

**Logic**:
1. Queries `hotel_requests` where `status = 'notified'` (vendor contacted but no quote yet)
2. Checks `notified_at` — only follows up if at least 4 hours since notification
3. Loads vendor WhatsApp from `hotel_vendors` or `hotels.vendor_whatsapp`
4. Sends follow-up message with request details
5. Duplicate-checked: one follow-up per request per 4-hour window

**Tables read**: `hotel_requests`, `hotels`, `hotel_vendors`, `vendors`, `automation_logs`

---

### `flight_reminder.ts` — Hourly

**Purpose**: Reminds customers about confirmed flights departing tomorrow.

**Logic**:
1. Queries `flight_requests` where `status = 'issued'` or `flight_quotations` where `status = 'issued'`
2. Finds flights departing **tomorrow**
3. Formats message with PNR, flight number, route, departure time
4. Sends to client WhatsApp
5. Duplicate-checked per booking per day (despite hourly cron, only one send per day)

**Tables read**: `flight_requests`, `flight_quotations`, `clients`, `automation_logs`

---

### `passport_expiry.ts` — Mondays 10:00

**Purpose**: Alerts assigned staff about passengers with expiring passports.

**Expiry thresholds**: 90 days, 60 days, 30 days.

**Logic**:
1. Queries `passenger_documents` where `expiry_date` falls within any threshold window
2. Groups by assigned staff member (`flight_requests.assigned_to`)
3. Formats a summary message listing passenger names and days until expiry
4. Sends to the assigned staff member's phone or management WhatsApp
5. Duplicate-checked per passenger per week (Monday only)

**Tables read**: `passenger_documents`, `flight_requests`, `users`, `automation_logs`

---

### `visa_expiry.ts` — Mondays 10:00

**Purpose**: Alerts clients about upcoming visa expirations.

**Expiry thresholds**: 30 days, 15 days, 7 days.

**Logic**:
1. Queries `visa_applications` where `status = 'approved'` and expiry within thresholds
2. Loads client WhatsApp number
3. Formats message with visa type, country, and days until expiry
4. Sends to client
5. Duplicate-checked per visa application per week

**Tables read**: `visa_applications`, `clients`, `automation_logs`

---

### `management_summary.ts` — Daily 08:00

**Purpose**: Sends an operational overview to management each morning.

**Data compiled**:
- Today's hotel check-ins (count)
- Today's flight departures (count)
- Pending hotel requests awaiting vendor quotes (count)
- Overdue invoices total amount (PKR)
- Unread WhatsApp inbox messages (count)
- Draft vouchers awaiting approval (count)

**Recipient**: `website_config.management_wa_number`

**Tables read**: `hotel_requests`, `flight_requests`, `flight_quotations`, `invoices`, `whatsapp_messages`, `vouchers`

---

### `pending_approvals.ts` — Every 2 Hours

**Purpose**: Notifies management if there is pending work requiring their attention.

**Checks**:
- Draft vouchers awaiting approval (count > 0)
- Unpaid invoices older than 7 days (count > 0)
- Pending portal user registrations (count > 0)
- Unprocessed flight requests (count > 0)

**Recipient**: `website_config.management_wa_number`

**Logic**: Only sends if at least one check has a non-zero count.

**Tables read**: `vouchers`, `invoices`, `portal_users`, `flight_requests`

---

## WhatsApp Message Templates

All automation messages are templated from `website_config.wa_templates` (JSONB field). Templates support placeholders (e.g., `{{clientName}}`, `{{invoiceNumber}}`, `{{amount}}`).

Templates can be customised per-automation from the ERP Automation Settings page: `PATCH /api/automations/:type { templateOverride }`.

Default templates are defined as constants in each automation handler and used as fallback if no DB override exists.

---

## Automation API

| Endpoint | Description |
|---|---|
| `GET /api/automations` | List all automations with current config + status |
| `GET /api/automations/:type` | Single automation detail |
| `PATCH /api/automations/:type` | Update enabled/cron/template |
| `POST /api/automations/:type/run` | Trigger manual run (fire-and-forget) |
| `GET /api/automations/:type/logs` | Logs for specific automation type |
| `GET /api/automation-logs` | All logs paginated |
| `GET /api/automations-summary` | Dashboard health summary |

---

## Database Tables

| Table | Purpose |
|---|---|
| `automation_configs` | Per-type configuration (enabled, cron, status, counts) |
| `automation_logs` | Individual run records with status and recipient count |
| `website_config` | `wa_templates` JSONB field with message templates |

### `automation_configs` Schema
| Column | Description |
|---|---|
| `type` (PK) | Automation identifier |
| `enabled` | Whether the cron is active |
| `cron_expression` | Overridden cron (null = use default) |
| `last_run_at` | Timestamp of last execution |
| `last_status` | running / success / partial / failure |
| `success_count` | Total successful runs |
| `failure_count` | Total failed runs |

---

## ERP Dashboard Integration

`GET /api/automations-summary` returns:
- Total enabled automations
- Last 24h: runs, successes, failures
- Each automation's last_status and last_run_at

Displayed on the ERP Dashboard as an "Automation Health" panel.

---

## Permissions

| Action | Required Role |
|---|---|
| View automation status/logs | Management, Admin |
| Enable/disable automations | Management, Admin |
| Override cron expression | Management, Admin |
| Override message template | Management, Admin |
| Trigger manual run | Management, Admin |

---

## Known Limitations

- Automation cron expressions are global (single timezone — server timezone); no per-timezone configuration.
- `management_wa_number` in `website_config` is a single number; there is no broadcast to multiple management contacts.
- The duplicate-detection mechanism uses `automation_logs` query per run — if logs grow very large, this query may slow down.
- WhatsApp delivery failures are logged as `status = 'failure'` but the automation marks the run as `partial` — no automatic retry.
- Manual `POST /api/automations/:type/run` is fire-and-forget; the response is immediate and does not confirm completion.

---

## Future Extension Points

- Per-recipient timezone-aware scheduling
- Email fallback when WhatsApp delivery fails
- Configurable message escalation (e.g., send to manager if client doesn't respond in 24h)
- Webhook-based event triggers (in addition to cron)
- Multi-language template support (Urdu, Arabic)
- Retry logic for failed WhatsApp sends
- Automation performance metrics and alerting
