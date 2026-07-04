# Database

**Engine**: PostgreSQL 16  
**ORM**: Drizzle ORM  
**Schema location**: `lib/db/src/schema/`  
**Migrations**: `lib/db/migrations/`  
**Config**: `lib/db/drizzle.config.ts`  

Push schema changes (dev): `pnpm --filter @workspace/db run push`  
Generate migration file: `pnpm --filter @workspace/db run generate`

---

## Migration History

| Migration | Description |
|---|---|
| `0000_amused_shen` | Initial schema — all core tables |
| `0001_add_guest_rate` | Added `guest_rate` column to `currency_daily_rates` |
| `0002_hotel_invoices` | Created `hotel_invoices` table |
| `0003_dn_invoice_sequence` | DN counter/sequence adjustments |
| `0004_group_tickets` | Created `group_tickets` table |
| `0005_whatsapp_groups` | Created `whatsapp_monitored_groups` and `whatsapp_group_names` |
| `0006_whatsapp_inbox` | Created `whatsapp_messages` and `whatsapp_group_links` |
| `0007_media_library` | Created `media_library` table |
| `0008_bot_recipient_mode` | Added `recipient_mode` and media support to `bot_campaigns` |
| *(inline push)* | Added `client_id` nullable integer to `portal_users` |

---

## Tables

### `users`
ERP staff accounts.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `name` | text | NOT NULL |
| `email` | text | UNIQUE, NOT NULL |
| `password_hash` | text | NOT NULL |
| `role` | text | DEFAULT 'sales'; CHECK (management, sales, accounts, operations) |
| `phone` | text | |
| `is_active` | boolean | DEFAULT true |
| `can_issue_tickets` | boolean | DEFAULT false |
| `ticketing_pin` | text | Hashed PIN for ticket issuance |
| `session_token` | text | Current active ERP session |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | |

---

### `clients`
CRM client records (travel agencies, direct customers).

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `name` | text | NOT NULL |
| `email` | text | |
| `phone` | text | |
| `whatsapp` | text | |
| `country` | text | |
| `city` | text | |
| `lead_status` | text | DEFAULT 'new' |
| `assigned_to` | integer | FK → users.id |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `client_notes`
Free-text notes attached to a client.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `client_id` | integer | FK → clients.id |
| `content` | text | NOT NULL |
| `created_by` | integer | FK → users.id |
| `created_at` | timestamp | |

---

### `follow_ups`
Scheduled follow-up tasks for CRM clients.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `client_id` | integer | FK → clients.id |
| `due_date` | timestamp | NOT NULL |
| `type` | text | DEFAULT 'call' |
| `status` | text | DEFAULT 'pending' |
| `notes` | text | |
| `assigned_to` | integer | FK → users.id |
| `created_at` | timestamp | |

---

### `hotels`
Hotel master database.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `name` | text | NOT NULL |
| `city` | text | |
| `stars` | integer | DEFAULT 3 |
| `distance_from_haram` | text | |
| `room_types` | text[] | |
| `meal_plans` | text[] | |
| `notes` | text | |
| `description` | text | |
| `category` | text | |
| `default_vendor_id` | integer | FK → vendors.id |
| `image_url` | text | |
| `google_image_url` | text | |
| `vendor_whatsapp` | text | |
| `vendor_whatsapp_group_id` | text | |
| `is_active` | boolean | DEFAULT true |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `vendors`
Supplier/vendor directory (hotel vendors, transport, etc.).

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `name` | text | NOT NULL |
| `type` | text | |
| `contact_name` | text | |
| `email` | text | |
| `phone` | text | |
| `country` | text | |
| `rating` | integer | |
| `total_deals` | integer | DEFAULT 0 |
| `is_active` | boolean | DEFAULT true |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `hotel_vendors`
Join table linking hotels to their vendors with priority and WhatsApp contact.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `hotel_id` | integer | FK → hotels.id |
| `vendor_id` | integer | FK → vendors.id |
| `priority` | integer | |
| `vendor_whatsapp` | text | |
| `vendor_whatsapp_group_id` | text | |

---

### `hotel_requests`
Hotel booking procurement requests.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `client_id` | integer | FK → clients.id |
| `hotel_name` | text | |
| `city` | text | |
| `check_in` | date | |
| `check_out` | date | |
| `rooms` | integer | |
| `no_of_pax` | integer | |
| `room_type` | text | |
| `meal_plan` | text | |
| `special_notes` | text | |
| `reference_number` | text | UNIQUE, format: HR-XXXX |
| `hotel_id` | integer | FK → hotels.id |
| `invoice_id` | integer | FK → hotel_invoices.id |
| `notified_at` | timestamp | |
| `created_by_user_id` | integer | FK → users.id |
| `status` | text | DEFAULT 'pending' |
| `selected_quote_id` | integer | FK → vendor_quotes.id |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `vendor_quotes`
Vendor price quotes received in response to hotel requests.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `request_id` | integer | FK → hotel_requests.id |
| `vendor_id` | integer | FK → vendors.id |
| `price_per_room` | integer | |
| `total_price` | integer | |
| `currency` | text | DEFAULT 'SAR' |
| `meal_plan` | text | |
| `room_type` | text | |
| `distance` | text | |
| `availability` | text | |
| `cancellation_policy` | text | |
| `received_by` | integer | FK → users.id |
| `status` | text | DEFAULT 'received' |
| `vendor_whatsapp` | text | |
| `notes` | text | |
| `is_selected` | boolean | DEFAULT false |
| `responded_at` | timestamp | |

---

### `hotel_invoices`
Financial records for completed hotel bookings. Tracks both receivable (client) and payable (vendor) amounts in dual currency.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `dn_number` | text | UNIQUE, format: DN-XXXX |
| `hotel_request_id` | integer | FK → hotel_requests.id |
| `client_id` | integer | FK → clients.id |
| `vendor_id` | integer | FK → vendors.id |
| `hotel_id` | integer | FK → hotels.id |
| `check_in` | date | |
| `check_out` | date | |
| `rooms` | integer | |
| `pax` | integer | |
| `client_amount_sar` | numeric | Receivable in SAR |
| `client_amount_pkr` | numeric | Receivable in PKR |
| `vendor_amount_sar` | numeric | Payable in SAR |
| `vendor_amount_pkr` | numeric | Payable in PKR |
| `status` | text | DEFAULT 'draft' |
| `notes` | text | |
| `created_by` | integer | FK → users.id |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `invoices`
Customer invoices for Umrah packages.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `invoice_number` | text | UNIQUE |
| `type` | text | DEFAULT 'customer' |
| `client_id` | integer | FK → clients.id |
| `vendor_id` | integer | FK → vendors.id |
| `quotation_id` | integer | FK → quotations.id |
| `amount` | numeric | |
| `paid_amount` | numeric | DEFAULT 0 |
| `currency` | text | DEFAULT 'USD' |
| `status` | text | DEFAULT 'draft' |
| `due_date` | date | |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `payments`
Payment records against invoices.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `invoice_id` | integer | FK → invoices.id |
| `amount` | numeric | |
| `currency` | text | |
| `method` | text | |
| `reference` | text | |
| `paid_at` | timestamp | |

---

### `expenses`
Operational expense records.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `title` | text | |
| `category` | text | |
| `amount` | numeric | |
| `currency` | text | |
| `vendor_id` | integer | FK → vendors.id |
| `date` | date | |
| `notes` | text | |

---

### `chart_of_accounts`
Chart of Accounts — seeded with 8 core accounts.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `code` | text | UNIQUE |
| `name` | text | |
| `type` | text | asset / liability / revenue / expense / equity |
| `description` | text | |
| `is_active` | boolean | DEFAULT true |

**Seeded accounts**: `VENDOR` (Liability), `PARTY` (Asset), `UMRA` (Revenue), `AIR` (Revenue), `HOTEL` (Revenue), `MSFR` (Asset — cash/bank), `FOREX` (Revenue), `PROFIT` (Equity)

---

### `general_journal`
The source-of-truth double-entry ledger.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `entry_number` | text | UNIQUE |
| `date` | date | |
| `description` | text | |
| `debit_account_id` | integer | FK → chart_of_accounts.id |
| `credit_account_id` | integer | FK → chart_of_accounts.id |
| `amount` | numeric | |
| `currency` | text | DEFAULT 'SAR' |
| `source_type` | text | invoice / payment / hotel_invoice / flight / voucher |
| `source_id` | integer | |

---

### `vouchers`
Accounting voucher drafts before posting to the general journal.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `voucher_number` | text | UNIQUE |
| `type` | text | RV / PV / JV / CV |
| `date` | date | |
| `narration` | text | |
| `status` | text | draft / approved / posted / cancelled |
| `party_id` | integer | FK → clients.id |
| `vendor_id` | integer | FK → vendors.id |
| `hotel_invoice_id` | integer | FK → hotel_invoices.id |
| `created_by` | integer | FK → users.id |
| `approved_by` | integer | FK → users.id |
| `approved_at` | timestamp | |
| `posted_by` | integer | FK → users.id |
| `posted_at` | timestamp | |
| `created_at` | timestamp | |

---

### `voucher_lines`
Individual debit/credit lines within a voucher.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `voucher_id` | integer | FK → vouchers.id |
| `account_id` | integer | FK → chart_of_accounts.id |
| `description` | text | |
| `debit_amount` | numeric | |
| `credit_amount` | numeric | |
| `currency` | text | DEFAULT 'PKR' |
| `sort_order` | integer | |

---

### `financial_years`
Accounting periods.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `name` | text | |
| `start_date` | date | |
| `end_date` | date | |
| `status` | text | open / closed |

---

### `opening_balances`
Per-account opening balances for a financial year.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `financial_year_id` | integer | FK → financial_years.id |
| `account_id` | integer | FK → chart_of_accounts.id |
| `debit_amount` | numeric | |
| `credit_amount` | numeric | |

---

### `flight_quotations`
Issued flight tickets and in-progress quotations.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `client_id` | integer | FK → clients.id |
| `trip_type` | text | one_way / return |
| `origin` | text | IATA code |
| `destination` | text | IATA code |
| `departure_date` | date | |
| `return_date` | date | |
| `legs` | jsonb | Multi-leg itinerary |
| `passengers` | jsonb | Passenger list |
| `cabin_class` | text | |
| `airline` | text | |
| `flight_number` | text | |
| `pnr` | text | |
| `status` | text | draft / confirmed / issued / cancelled / refunded |
| `amount` | numeric | |
| `currency` | text | |
| `ticket_number` | text | format: TKT-... |
| `issued_by` | integer | FK → users.id |
| `issued_at` | timestamp | |
| `airline_commission` | numeric | |
| `commission_rate` | numeric | |
| `refund_amount` | numeric | |

---

### `flight_ticket_events`
Audit trail for flight quotation status changes.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `quotation_id` | integer | FK → flight_quotations.id |
| `event_type` | text | |
| `description` | text | |
| `created_by` | integer | FK → users.id |
| `created_at` | timestamp | |

---

### `group_tickets`
Pre-purchased group flight inventory scraped from WhatsApp.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `airline_code` | text | |
| `flight_number` | text | |
| `flight_date` | date | |
| `origin` | text | IATA |
| `destination` | text | IATA |
| `seats` | integer | |
| `departure_time` | text | |
| `arrival_time` | text | |
| `fare_amount` | numeric | |
| `fare_currency` | text | DEFAULT 'PKR' |
| `group_name` | text | |
| `raw_message` | text | |
| `external_ticket_id` | text | |

Unique index on: `(airline_code, flight_number, flight_date, origin, destination)`

---

### `flight_requests`
Public booking inquiries from the website (GDS or group ticket).

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `request_number` | text | UNIQUE, format: FR-YYYYMMDD-XXXX |
| `request_type` | text | DEFAULT 'direct' |
| `source` | text | DEFAULT 'website' |
| `client_name` | text | |
| `client_phone` | text | |
| `client_email` | text | |
| `trip_type` | text | |
| `origin` | text | |
| `destination` | text | |
| `departure_date` | date | |
| `return_date` | date | |
| `passenger_count` | integer | |
| `actual_fare` | numeric | |
| `booking_fare` | numeric | |
| `flight_data_json` | jsonb | |
| `hold_expires_at` | timestamp | |
| `payment_deadline_at` | timestamp | |
| `status` | text | pending / on_hold / expired / payment_pending / ready_to_issue / issued / cancelled |
| `assigned_to` | integer | FK → users.id |

---

### `flight_request_events`
Audit trail for flight request status changes.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `request_id` | integer | FK → flight_requests.id |
| `event_type` | text | |
| `description` | text | |
| `created_by` | integer | FK → users.id |
| `created_at` | timestamp | |

---

### `transport_bookings`
Ground transport arrangements.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `client_id` | integer | FK → clients.id |
| `pickup_location` | text | |
| `dropoff_location` | text | |
| `pickup_datetime` | timestamp | |
| `vehicle_type` | text | |
| `driver_name` | text | |
| `driver_phone` | text | |
| `pax_count` | integer | |
| `status` | text | |
| `notes` | text | |
| `created_at` | timestamp | |

---

### `visa_applications`
Visa application tracking.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `client_id` | integer | FK → clients.id |
| `applicant_name` | text | |
| `passport_number` | text | |
| `visa_type` | text | |
| `country` | text | |
| `applied_date` | date | |
| `expected_date` | date | |
| `status` | text | pending / submitted / approved / rejected |
| `notes` | text | |
| `assigned_to` | integer | FK → users.id |
| `created_at` | timestamp | |

---

### `passenger_documents`
Passport and CNIC images with OCR results.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `flight_request_id` | integer | FK → flight_requests.id |
| `flight_quotation_id` | integer | FK → flight_quotations.id |
| `passenger_name` | text | |
| `document_type` | text | passport / cnic |
| `passport_number` | text | |
| `cnic_number` | text | |
| `expiry_date` | date | |
| `nationality` | text | |
| `storage_key` | text | Object storage key |
| `scan_status` | text | pending / scanning / done / failed |
| `ocr_first_name` | text | |
| `ocr_last_name` | text | |
| `ocr_passport_number` | text | |
| `ocr_expiry` | text | |
| `ocr_nationality` | text | |
| `ocr_confidence` | numeric | |
| `ocr_corrected` | boolean | |
| `is_verified` | boolean | |
| `created_at` | timestamp | |

---

### `whatsapp_monitored_groups`
WhatsApp groups configured for group ticket scraping.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `jid` | text | UNIQUE |
| `name` | text | |
| `enabled` | boolean | DEFAULT true |

---

### `whatsapp_group_names`
Cached WhatsApp group display names.

| Column | Type | Constraints |
|---|---|---|
| `jid` | text | PK |
| `subject` | text | |
| `synced_at` | timestamp | |

---

### `whatsapp_messages`
Incoming WhatsApp messages stored for the inbox.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `group_jid` | text | |
| `sender_jid` | text | |
| `sender_name` | text | |
| `text` | text | |
| `wa_message_id` | text | |
| `timestamp` | timestamp | |
| `is_read` | boolean | DEFAULT false |
| `is_sent` | boolean | DEFAULT false |
| `quoted_wa_id` | text | |
| `media_library_id` | integer | FK → media_library.id |

---

### `whatsapp_group_links`
Links between WhatsApp groups and ERP entities (quotations, clients, etc.).

| Column | Type | Constraints |
|---|---|---|
| `group_jid` | text | |
| `entity_type` | text | |
| `entity_id` | integer | |

Unique on: `(group_jid, entity_type, entity_id)`

---

### `bot_campaigns`
WhatsApp bot message campaigns.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `message` | text | |
| `contacts` | jsonb | Array of phone numbers |
| `current_index` | integer | DEFAULT 0 |
| `status` | text | idle / running / paused / done |
| `next_send_at` | timestamp | |
| `delay_seconds` | integer | |
| `media_library_id` | integer | FK → media_library.id |
| `recipient_mode` | text | all / selected |
| `created_at` | timestamp | |

---

### `bot_campaign_sends`
Individual send log for each campaign message.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `campaign_id` | integer | FK → bot_campaigns.id |
| `contact` | text | |
| `sent_at` | timestamp | |
| `status` | text | sent / failed |

---

### `media_library`
File asset registry for WhatsApp media, documents, and uploads.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `storage_key` | text | UNIQUE |
| `original_filename` | text | |
| `media_type` | text | image / video / audio / document |
| `mime_type` | text | |
| `size_bytes` | integer | |
| `created_at` | timestamp | |

---

### `portal_users`
Customer portal accounts.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `type` | text | party / dc |
| `status` | text | DEFAULT 'pending_approval' |
| `full_name` | text | |
| `email` | text | UNIQUE |
| `phone` | text | |
| `whatsapp` | text | |
| `company_name` | text | For party accounts |
| `client_id` | integer | NULLABLE — FK → clients.id (ERP link) |
| `password_hash` | text | bcrypt hash |
| `portal_session_token` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `public_booking_inquiries`
Website flight booking requests submitted via the portal.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `reference_number` | text | UNIQUE |
| `ticket_id` | integer | FK → group_tickets.id |
| `portal_user_id` | integer | FK → portal_users.id |
| `status` | text | |
| `created_at` | timestamp | |

---

### `public_booking_passengers`
Passengers listed on a booking inquiry, with OCR scan results.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `inquiry_id` | integer | FK → public_booking_inquiries.id |
| `name` | text | |
| `document_type` | text | passport / cnic |
| `document_key` | text | Storage key |
| `scan_status` | text | pending / done / failed |
| `scan_first_name` | text | |
| `scan_last_name` | text | |
| `scan_passport_number` | text | |
| `scan_expiry` | text | |
| `scan_nationality` | text | |

---

### `payment_receipts`
Payment proof uploads for flight booking inquiries.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `inquiry_id` | integer | FK → public_booking_inquiries.id |
| `portal_user_id` | integer | FK → portal_users.id (ownership check on upload) |
| `object_key` | text | Storage key of uploaded receipt image |
| `payment_status` | text | pending / receipt_uploaded / verified / rejected / expired |
| `deadline_at` | timestamp | Calculated by deadline-calculator.ts |
| `deadline_tier` | text | 1h / 3h / 12h / 24h |
| `uploaded_at` | timestamp | |
| `verified_at` | timestamp | |
| `verified_by` | integer | FK → users.id |

---

### `package_inquiries`
Custom Umrah package inquiries from the website.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `reference_number` | text | UNIQUE |
| `departure_date` | date | |
| `return_date` | date | |
| `hotel_id` | integer | FK → hotels.id |
| `adults` | integer | |
| `children` | integer | |
| `contact_name` | text | |
| `contact_phone` | text | |
| `contact_email` | text | |
| `special_requests` | text | |
| `status` | text | pending / contacted / converted / cancelled |
| `linked_quotation_id` | integer | FK → quotations.id |
| `created_at` | timestamp | |

---

### `quotations`
Sales proposals / itinerary quotations.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `reference_number` | text | UNIQUE |
| `client_id` | integer | FK → clients.id |
| `created_by` | integer | FK → users.id |
| `status` | text | |
| `total_amount` | numeric | |
| `currency` | text | |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `automation_configs`
Per-automation type configuration.

| Column | Type | Constraints |
|---|---|---|
| `type` | text | PK |
| `enabled` | boolean | DEFAULT false |
| `cron_expression` | text | |
| `last_run_at` | timestamp | |
| `last_status` | text | |
| `success_count` | integer | |
| `failure_count` | integer | |

---

### `automation_logs`
Individual automation run log entries.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `type` | text | |
| `status` | text | |
| `message` | text | |
| `recipients_count` | integer | |
| `created_at` | timestamp | |

---

### `currency_daily_rates`
Daily foreign exchange rates used for pricing.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `currency` | text | |
| `date` | date | |
| `vendor_rate` | numeric | |
| `guest_rate` | numeric | |
| `client_rate` | numeric | |

---

### `currency_transactions`
Logged currency exchange transactions.

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PK |
| `from_currency` | text | |
| `to_currency` | text | |
| `amount` | numeric | |
| `rate` | numeric | |
| `profit` | numeric | |
| `date` | date | |
| `notes` | text | |

---

### `gds_settings`
GDS provider credentials and configuration.

| Column | Type | Constraints |
|---|---|---|
| `provider` | text | PK (amadeus / sabre / galileo) |
| `client_id` | text | |
| `client_secret` | text | |
| `environment` | text | test / production |
| `pcc` | text | Pseudo City Code |
| `is_enabled` | boolean | |

---

### `local_airline_settings`
Local / LCC carrier configuration (PIA, Airblue, etc.).

| Column | Type | Constraints |
|---|---|---|
| `code` | text | PK |
| `name` | text | |
| `is_enabled` | boolean | |
| `credentials` | jsonb | Masked for non-admin users |

---

### `ocr_settings`
Global OCR configuration (single row, id=1).

| Column | Type | Constraints |
|---|---|---|
| `id` | integer | PK (always 1) |
| `provider` | text | local / ai / both |
| `confidence_threshold` | numeric | |
| `ai_model` | text | |

---

### `website_config`
Company branding, contact info, and WhatsApp automation message templates (single row).

| Column | Type | Constraints |
|---|---|---|
| `id` | integer | PK (always 1) |
| `company_name` | text | |
| `company_phone` | text | |
| `company_email` | text | |
| `company_address` | text | |
| `logo_url` | text | |
| `primary_color` | text | |
| `wa_templates` | jsonb | Message templates for all automations |
| `management_wa_number` | text | WhatsApp for management summaries |
| `announcement` | text | Banner text on public site |

---

### `journal_counters`
Crash-safe atomic counter for journal entry numbers.

| Column | Type | Constraints |
|---|---|---|
| `id` | integer | PK (always 1) |
| `next_value` | integer | Incremented on each JE |

---

## Relations Summary

```
clients ─────────── client_notes
        ─────────── follow_ups
        ─────────── hotel_requests ─── vendor_quotes
        ─────────── hotel_invoices
        ─────────── flight_quotations ── flight_ticket_events
        ─────────── invoices ──────────── payments
        ─────────── visa_applications
        ─────────── transport_bookings
        ─────────── portal_users (via client_id)

portal_users ─────── public_booking_inquiries ─── public_booking_passengers
                                               ─── payment_receipts

hotels ──────────── hotel_vendors ─── vendors
       ──────────── hotel_requests
       ──────────── hotel_invoices

general_journal ──── chart_of_accounts
vouchers ──────────── voucher_lines ─── chart_of_accounts
financial_years ────── opening_balances ─── chart_of_accounts

bot_campaigns ──────── bot_campaign_sends
whatsapp_messages ─── media_library
whatsapp_group_links (group_jid → any entity)
```
