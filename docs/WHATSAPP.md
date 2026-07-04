# WhatsApp

**Purpose**: Core communications layer — group inbox, outbound messaging, bot campaigns, group ticket scraping, and the messaging backbone for all automated notifications.  
**Library**: `@whiskeysockets/baileys` (unofficial WhatsApp Web protocol implementation)  
**Service**: `artifacts/api-server/src/services/whatsapp.ts`  
**Routes**: `routes/whatsapp.ts`, `routes/whatsapp-groups.ts`, `routes/whatsapp-inbox.ts`, `routes/bot.ts`  
**ERP pages**: `/whatsapp-inbox`, `/bot-campaigns`, `/media-library`, `/gds-settings` (QR code panel)  

---

## Architecture

```
WhatsApp Web (phone linked via QR)
       │ Baileys socket
       ▼
  whatsapp.ts service (singleton)
  ├── Message handler → whatsapp_messages (DB)
  ├── Group name sync → whatsapp_group_names (DB)
  ├── Contact list → in-memory from group participants
  └── Message sender → outbound to any JID

  scheduler.ts (daily 13:00)
  └── Scrape group messages → group_tickets (DB)

  bot-scheduler.ts (every 5s)
  └── Campaign sender → bot_campaign_sends (DB)

  automation services
  └── All use wa-helper.ts → whatsapp.ts.sendMessage()
```

---

## Session Management

WhatsApp uses a persistent session stored in `artifacts/api-server/whatsapp-session/`.

### Linking Flow
1. ERP staff navigates to GDS Settings page or Groups page
2. `GET /api/group-tickets/qr` returns base64 QR code string
3. ERP page renders QR image
4. Staff opens WhatsApp on their phone → Linked Devices → Scan QR
5. Session files written to `whatsapp-session/` (creds.json, identity keys, app-state)
6. Service emits `WhatsApp session connected` log
7. Session persists across server restarts (unless `POST /api/whatsapp/disconnect` is called)

### Session Files
The `whatsapp-session/` directory contains:
- `creds.json` — authentication credentials
- `app-state-sync-*` — state sync keys for various message categories
- `identity-key-*` — per-contact encryption keys (thousands of files after use)
- `device-list-*` — multi-device registration

### Connection Status
`GET /api/whatsapp/status` → `{ status: "connected" | "connecting" | "disconnected" }`

### Disconnect
`POST /api/whatsapp/disconnect` — sends logout to WhatsApp, clears session files, resets connection state.

---

## Group Monitoring

### Monitored Groups
Groups can be flagged for **group ticket scraping** (the automated daily inventory pull).

`GET /api/whatsapp-groups/live` — fetches all groups the linked phone is currently in, filtered to those with business-relevant keywords in the group name.

`PUT /api/whatsapp-groups/:jid { enabled: true/false }` — adds/updates a group in `whatsapp_monitored_groups`.

`DELETE /api/whatsapp-groups/:jid` — removes from monitoring.

### Group Names Sync
`POST /api/whatsapp-inbox/sync-group-names` — pulls current group names from WhatsApp and upserts `whatsapp_group_names`. Run after linking a new phone or when group names change.

---

## WhatsApp Inbox

The inbox stores incoming group messages in the database and provides a structured interface for staff to read and reply.

### Message Storage
The Baileys socket event handler captures all incoming messages and:
1. Writes to `whatsapp_messages` table with `sender_jid`, `text`, `timestamp`, `is_read = false`
2. If the message contains media, stores the media in `media_library` and links via `media_library_id`
3. Maintains a local JSON store as a fallback

`POST /api/whatsapp-inbox/backfill` — imports messages from the local JSON store into the database (used after reconnection or data loss).

### Inbox API

| Endpoint | Description |
|---|---|
| `GET /api/whatsapp-inbox/groups` | Groups with unread counts and last message preview |
| `GET /api/whatsapp-inbox/messages/:jid` | Paginated message thread for a group |
| `POST /api/whatsapp-inbox/mark-read` | Mark all messages in group as read |
| `GET /api/whatsapp-inbox/unread-count` | Total unread badge count |

### Sending Messages
`POST /api/whatsapp-inbox/send { jid, text?, mediaLibraryId? }` — sends a text message or media file to any JID (group or individual).

### Entity Links
Groups can be linked to ERP entities (quotations, clients, hotel requests) for contextual access from the inbox.

| Endpoint | Description |
|---|---|
| `GET /api/whatsapp-inbox/links/:jid` | All entity links for a group |
| `POST /api/whatsapp-inbox/links { groupJid, entityType, entityId }` | Link group to entity |
| `DELETE /api/whatsapp-inbox/links/:id` | Remove link |

ERP inbox page shows linked entity context alongside messages (e.g., "Linked to Hotel Request HR-0042").

---

## Group Ticket Scraper

`artifacts/api-server/src/services/scheduler.ts` — fires daily at **13:00**.

### Algorithm
1. Load all `whatsapp_monitored_groups` where `enabled = true`
2. For each group, fetch messages from the last 24 hours
3. Pass each message text through `groupTicketParser.ts`
4. Parse: airline code, flight number, date, origin, destination, seats, fare, times
5. Upsert into `group_tickets` (unique on airline + flight + date + route)
6. Log `Backfilled WhatsApp JSON store → DB` with count

### Parser (`groupTicketParser.ts`)
Regex-based extraction from raw WhatsApp/GDS message text:
- Airline codes: 2-letter IATA (PK, PA, FZ, EK, QR, SV, etc.)
- Flight numbers: numeric with optional letter suffix
- Dates: DD-MM-YYYY, YYYY-MM-DD, and natural language variants
- Fares: numeric with PKR/SAR currency markers
- IATA city codes: 3-letter (KHI, LHE, ISB, JED, MED, DXB, etc.)

Manual trigger: `POST /api/group-tickets/sync`

---

## Bot Campaigns

The bot campaign system sends bulk WhatsApp messages to contacts extracted from group participant lists.

### Contact Extraction
`GET /api/bot/contacts` — reads all group participants from WhatsApp, deduplicates, and returns a contact list (individual numbers only, no group JIDs).

### Campaign Types
- **Text campaign**: plain message text
- **Media campaign**: image/video from media library + optional caption

### Recipient Modes
- `all` — all extracted contacts
- `selected` — a specified subset of contacts

### Campaign Lifecycle

```
POST /api/bot/campaign { message, contacts, mediaLibraryId?, recipientMode }
       ↓ (status: idle)
POST /api/bot/campaign/:id/start
       ↓ (status: running; calculates delay)
  bot-scheduler.ts (every 5s)
    → picks up campaign where next_send_at ≤ now()
    → sends message to contacts[current_index]
    → logs to bot_campaign_sends
    → increments current_index + next_send_at
       ↓
POST /api/bot/campaign/:id/pause  (status: paused)
POST /api/bot/campaign/:id/resume (status: running)
POST /api/bot/campaign/:id/stop   (status: done)
```

### Dynamic Delay Calculation
The start endpoint calculates `delay_seconds` based on total contacts to spread messages over the campaign window (typically 1-2 seconds per contact, respecting WhatsApp rate limits).

### Progress Tracking
`GET /api/bot/campaign/active` → `{ id, status, totalContacts, sentCount, failedCount, nextSendAt }`

---

## Automation Messaging

All 8 automations use `wa-helper.ts` as an error-safe wrapper around `whatsapp.ts.sendMessage()`.

```typescript
// wa-helper.ts
async function sendWaMessage(jid: string, message: string): Promise<boolean>
```

The helper:
- Catches and logs errors without crashing the automation
- Returns `true` on success, `false` on failure
- Automation engine counts successes/failures for logging

Message templates are stored in `website_config.wa_templates` (JSONB) and can be customised per automation from the ERP Automation Settings page.

---

## Media Library Integration

Files can be stored in the media library and sent via WhatsApp:
- Upload a file → `POST /api/media-library` registers it
- `POST /api/whatsapp-inbox/send { jid, mediaLibraryId }` — server fetches from storage and sends via Baileys

Supported WhatsApp media types: image (jpg/png), video (mp4), audio (mp3/ogg), document (pdf, docx).

---

## Database Tables

| Table | Purpose |
|---|---|
| `whatsapp_monitored_groups` | Groups configured for ticket scraping |
| `whatsapp_group_names` | Cached group display names |
| `whatsapp_messages` | Inbox message storage |
| `whatsapp_group_links` | ERP entity links for groups |
| `bot_campaigns` | Campaign records |
| `bot_campaign_sends` | Individual send log per campaign |
| `media_library` | File assets usable in messages |

---

## Permissions

| Action | Required Role |
|---|---|
| View inbox | Management, Admin |
| Send messages | Management, Admin |
| Create bot campaigns | Management, Admin |
| Manage monitored groups | Operations, Management, Admin |
| WhatsApp disconnect | Admin |
| Sync group names | Operations, Management, Admin |

---

## Known Limitations

- Baileys is an **unofficial** WhatsApp Web implementation. WhatsApp can block sessions without notice; session files may become invalid after WhatsApp updates.
- The `whatsapp-session/` directory accumulates thousands of `identity-key-*` files over time; no automatic cleanup is implemented.
- Message delivery receipts (read receipts) from WhatsApp are not stored.
- Media messages received from WhatsApp are stored in the local JSON store but media binary download is not guaranteed for all message types.
- Bot campaigns have no built-in unsubscribe mechanism; recipients cannot opt out.
- The contact extraction relies on group participant lists — contacts not in any monitored group will not appear.
- Reconnection after a server restart re-uses session files automatically; if session files are corrupted, a re-scan is required.

---

## Future Extension Points

- Incoming message parsing for automated quote extraction from vendor replies
- WhatsApp Business API (official) migration to avoid unofficial library risks
- Two-way conversation threading linking messages to specific bookings
- Auto-reply bot for common customer queries (status checks, pricing)
- Opt-out / unsubscribe mechanism for bot campaigns
- Message delivery status tracking (sent / delivered / read)
