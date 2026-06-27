# Database Structure

All tables use PostgreSQL via Drizzle ORM. **Foreign keys are NOT enforced at the database level** — relationships are expressed by column naming convention only (e.g. `clientId` → `clients.id`). Treat column names as the relationship map.

All `id` columns are `serial` (auto-increment integer) primary keys unless noted.

---

## Auth / Staff

### `users`

Staff accounts for the ERP.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | |
| `email` | text | NOT NULL, UNIQUE | Login credential |
| `password_hash` | text | NOT NULL | bcrypt hash |
| `role` | text | NOT NULL, default `sales` | Enum: `management` / `sales` / `accounts` / `operations` |
| `phone` | text | | |
| `is_active` | boolean | NOT NULL, default true | |
| `can_issue_tickets` | boolean | NOT NULL, default false | Gates ticket issuance |
| `ticketing_pin` | text | | Hashed PIN for ticket issuance |
| `session_token` | text | | Set on login, cleared on logout |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

DB check constraint: `role IN ('management', 'sales', 'accounts', 'operations')`

---

## CRM

### `clients`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | |
| `email` | text | NOT NULL | |
| `phone` | text | NOT NULL | |
| `whatsapp` | text | | |
| `country` | text | NOT NULL | |
| `city` | text | | |
| `lead_status` | text | NOT NULL, default `new` | Pipeline status |
| `assigned_to` | integer | | → `users.id` |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `client_notes`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `client_id` | integer | NOT NULL | → `clients.id` |
| `content` | text | NOT NULL | |
| `created_by` | integer | NOT NULL | → `users.id` |
| `created_at` | timestamp | NOT NULL | |

### `follow_ups`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `client_id` | integer | NOT NULL | → `clients.id` |
| `due_date` | timestamp | NOT NULL | |
| `type` | text | NOT NULL, default `call` | `call` / `email` / `meeting` |
| `status` | text | NOT NULL, default `pending` | `pending` / `completed` / `cancelled` |
| `notes` | text | | |
| `assigned_to` | integer | NOT NULL | → `users.id` |
| `created_at` | timestamp | NOT NULL | |

---

## Quotations

### `quotations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `client_id` | integer | NOT NULL | → `clients.id` |
| `reference_no` | text | NOT NULL, UNIQUE | |
| `title` | text | | |
| `status` | text | NOT NULL, default `draft` | `draft` / `sent` / `accepted` / `rejected` |
| `total_amount` | numeric(12,2) | NOT NULL, default 0 | |
| `currency` | text | NOT NULL, default `USD` | |
| `valid_until` | timestamp | NOT NULL | |
| `terms_and_conditions` | text | | |
| `notes` | text | | |
| `created_by` | integer | NOT NULL | → `users.id` |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `quotation_items`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `quotation_id` | integer | NOT NULL | → `quotations.id` |
| `service_type` | text | NOT NULL | e.g. `flight` / `hotel` / `transport` / `visa` |
| `description` | text | NOT NULL | |
| `quantity` | integer | NOT NULL, default 1 | |
| `unit_price` | numeric(12,2) | NOT NULL | |
| `total_price` | numeric(12,2) | NOT NULL | |
| `notes` | text | | |
| `created_at` | timestamp | NOT NULL | |

---

## Hotels

### `hotels`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | |
| `city` | text | NOT NULL | e.g. `Makkah` / `Madinah` |
| `stars` | integer | NOT NULL, default 3 | |
| `distance_from_haram` | text | NOT NULL | |
| `room_types` | text[] | | Array of room type names |
| `meal_plans` | text[] | | Array of meal plan names |
| `notes` | text | | |
| `image_url` | text | | |
| `is_active` | boolean | NOT NULL, default true | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `vendors`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | |
| `type` | text | NOT NULL | `hotel` / `transport` / `airline` / etc. |
| `contact_name` | text | NOT NULL | |
| `email` | text | NOT NULL | |
| `phone` | text | NOT NULL | |
| `country` | text | NOT NULL | |
| `rating` | integer | | 1–5 |
| `total_deals` | integer | NOT NULL, default 0 | |
| `is_active` | boolean | NOT NULL, default true | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `hotel_requests`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `client_id` | integer | NOT NULL | → `clients.id` |
| `hotel_name` | text | NOT NULL | |
| `city` | text | NOT NULL | |
| `check_in` | timestamp | NOT NULL | |
| `check_out` | timestamp | NOT NULL | |
| `rooms` | integer | NOT NULL, default 1 | |
| `room_type` | text | NOT NULL | |
| `meal_plan` | text | NOT NULL | |
| `special_notes` | text | | |
| `status` | text | NOT NULL, default `pending` | `pending` / `quoted` / `confirmed` / `cancelled` |
| `selected_quote_id` | integer | | → `vendor_quotes.id` |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `vendor_quotes`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `request_id` | integer | NOT NULL | → `hotel_requests.id` |
| `vendor_id` | integer | NOT NULL | → `vendors.id` |
| `price_per_room` | integer | NOT NULL | |
| `total_price` | integer | | |
| `currency` | text | NOT NULL, default `USD` | |
| `notes` | text | | |
| `is_selected` | boolean | NOT NULL, default false | |
| `responded_at` | timestamp | NOT NULL | |

---

## Hotel Invoices

### `hotel_invoices`

DN (Delivery Note) numbered hotel invoices with dual SAR/PKR billing.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `dn_number` | text | NOT NULL, UNIQUE | Sequential DN number |
| `invoice_date` | date | NOT NULL | |
| `party_id` | integer | | → `portal_users.id` |
| `vendor_id` | integer | | → `vendors.id` |
| `passenger_name` | text | | |
| `nationality` | text | | |
| `no_of_pax` | integer | NOT NULL, default 1 | |
| `detail` | text | | |
| `voucher_type` | text | | |
| `option_date` | date | | |
| `hotel_id` | integer | | → `hotels.id` |
| `hotel_name` | text | | Denormalised |
| `hotel_view` | text | | |
| `room_type` | text | | |
| `bed_type` | text | | |
| `check_in` | date | | |
| `check_out` | date | | |
| `no_of_nights` | integer | | |
| `no_of_rooms` | integer | NOT NULL, default 1 | |
| `reference` | text | | |
| `cnf_number` | text | | Confirmation number |
| `room_number` | text | | |
| `remarks` | text | | |
| `contact_number` | text | | |
| `receivable_sar` | numeric(14,2) | | Amount to receive from client in SAR |
| `payable_sar` | numeric(14,2) | | Amount to pay vendor in SAR |
| `receivable_pkr` | numeric(14,2) | | Amount to receive in PKR |
| `payable_pkr` | numeric(14,2) | | Amount to pay in PKR |
| `income_head` | text | NOT NULL, default `Hotel Income` | |
| `salesman_id` | integer | | → `users.id` |
| `status` | text | NOT NULL, default `draft` | `draft` / `accepted` |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

---

## Transport

### `transport_bookings`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `client_id` | integer | NOT NULL | → `clients.id` |
| `type` | text | NOT NULL | `airport_transfer` / `city_tour` / `intercity` / etc. |
| `vehicle_type` | text | NOT NULL | `sedan` / `van` / `bus` / etc. |
| `pickup_location` | text | NOT NULL | |
| `dropoff_location` | text | NOT NULL | |
| `date` | timestamp | NOT NULL | |
| `passengers` | integer | NOT NULL, default 1 | |
| `driver_name` | text | | |
| `driver_phone` | text | | |
| `status` | text | NOT NULL, default `pending` | `pending` / `confirmed` / `completed` / `cancelled` |
| `amount` | numeric(12,2) | NOT NULL | |
| `currency` | text | NOT NULL, default `USD` | |
| `vendor_id` | integer | | → `vendors.id` |
| `notes` | text | | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

---

## Visa

### `visa_applications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `client_id` | integer | NOT NULL | → `clients.id` |
| `passport_number` | text | NOT NULL | |
| `nationality` | text | NOT NULL | |
| `passport_expiry` | timestamp | | |
| `status` | text | NOT NULL, default `documents_required` | `documents_required` / `submitted` / `approved` / `rejected` |
| `assigned_to` | integer | | → `users.id` |
| `submitted_at` | timestamp | | |
| `approved_at` | timestamp | | |
| `rejection_reason` | text | | |
| `notes` | text | | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

---

## Flights — Quotations

### `flight_quotations`

ERP-created flight quotations; can be issued as tickets.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `client_id` | integer | NOT NULL | → `clients.id` |
| `trip_type` | text | NOT NULL, default `one_way` | `one_way` / `round_trip` / `multi_city` |
| `origin` | text | NOT NULL | IATA code |
| `destination` | text | NOT NULL | IATA code |
| `departure_date` | timestamp | NOT NULL | |
| `return_date` | timestamp | | null for one-way |
| `legs` | text | | multi-city leg descriptions |
| `passengers` | integer | NOT NULL, default 1 | |
| `cabin_class` | text | NOT NULL, default `economy` | `economy` / `business` / `first` |
| `airline` | text | | |
| `flight_number` | text | | |
| `status` | text | NOT NULL, default `draft` | `draft` / `booked` / `ticketed` |
| `amount` | numeric(12,2) | NOT NULL | Total price |
| `currency` | text | NOT NULL, default `USD` | |
| `ticket_number` | text | | `TKT-*`; set on issuance |
| `issued_by` | integer | | → `users.id` |
| `issued_at` | timestamp | | |
| `notes` | text | | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

---

## Flights — Requests

### `flight_requests`

Public/portal flight requests reviewed and issued by ERP staff.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `request_number` | text | NOT NULL, UNIQUE | e.g. `FR-20250627-1234` |
| `request_type` | text | NOT NULL, default `direct` | `direct` / `group` |
| `source` | text | NOT NULL, default `website` | `website` / `portal` |
| `client_name` | text | NOT NULL | |
| `client_email` | text | | |
| `client_phone` | text | NOT NULL | |
| `client_whatsapp` | text | | |
| `trip_type` | text | NOT NULL, default `one_way` | `one_way` / `round_trip` |
| `origin` | text | NOT NULL | |
| `destination` | text | NOT NULL | |
| `departure_date` | text | NOT NULL | ISO date string |
| `return_date` | text | | |
| `passenger_count` | integer | NOT NULL, default 1 | |
| `cabin_class` | text | NOT NULL, default `economy` | |
| `airline` | text | | optional; from GDS search |
| `fare` | text | | raw fare string from GDS |
| `actual_fare` | numeric(12,2) | | net cost to agency in PKR |
| `booking_fare` | numeric(12,2) | | customer-facing price in PKR |
| `flight_data_json` | jsonb | | full GDS response snapshot |
| `status` | text | NOT NULL, default `pending` | `pending` / `reviewing` / `issued` / `cancelled` |
| `assigned_to` | integer | | → `users.id` |
| `admin_notes` | text | | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `flight_request_events`

Audit log for every status change or action on a flight request.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `request_id` | integer | NOT NULL | → `flight_requests.id` |
| `user_id` | integer | | → `users.id`; null for system events |
| `user_name` | text | | denormalised for display |
| `action` | text | NOT NULL | e.g. `created`, `issued`, `updated` |
| `metadata` | jsonb | | action-specific payload |
| `created_at` | timestamp | NOT NULL | |

---

## GDS Settings

### `gds_settings`

Credentials for Amadeus, Sabre, and Galileo GDS adapters.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `provider` | text | NOT NULL | `amadeus` / `sabre` / `galileo` |
| `client_id` | text | | OAuth client ID (Amadeus/Sabre) |
| `client_secret` | text | | OAuth secret |
| `username` | text | | Galileo/Travelport username |
| `password` | text | | Galileo/Travelport password |
| `pcc` | text | | Sabre PCC / Galileo XAUTH group |
| `iata_code` | text | | agency IATA code |
| `environment` | text | NOT NULL, default `test` | `test` / `production` |
| `is_active` | boolean | NOT NULL, default false | false → mock fallback used |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

---

## Group Tickets

### `group_tickets`

Unique index on `(airline_code, flight_number, flight_date, origin, destination)` — prevents duplicate flights.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `airline_code` | text | NOT NULL | e.g. `PK` |
| `flight_number` | text | NOT NULL | e.g. `PK300` |
| `flight_date` | date | NOT NULL | |
| `origin` | text | NOT NULL | IATA code |
| `destination` | text | NOT NULL | IATA code |
| `seats` | integer | NOT NULL | Available seats (not auto-decremented) |
| `departure_time` | text | | |
| `arrival_time` | text | | |
| `fare_amount` | numeric(14,2) | | |
| `fare_currency` | text | NOT NULL, default `PKR` | |
| `group_name` | text | | |
| `raw_message` | text | | Original WhatsApp message |
| `external_ticket_id` | text | | |
| `external_portal_code` | text | | |
| `scraped_at` | timestamp | NOT NULL | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

---

## Public Booking Inquiries

### `public_booking_inquiries`

Group ticket booking submissions from the public website or portal.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `reference_number` | text | NOT NULL, UNIQUE | e.g. `BK-XXXXXX` |
| `ticket_id` | integer | NOT NULL | → `group_tickets.id` |
| `portal_user_id` | integer | | → `portal_users.id`; null for guest bookings |
| `user_type` | text | NOT NULL, default `guest` | `guest` / `portal` |
| `status` | text | NOT NULL, default `new` | `new` / `confirmed` / `cancelled` |
| `notes` | text | | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `public_booking_passengers`

One row per passenger in a booking inquiry.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `inquiry_id` | integer | NOT NULL | → `public_booking_inquiries.id` |
| `title` | text | NOT NULL, default `MR` | |
| `passenger_type` | text | NOT NULL, default `adult` | `adult` / `child` / `infant` |
| `first_name` | text | NOT NULL | |
| `last_name` | text | NOT NULL | |
| `dob` | date | | |
| `nationality` | text | | |
| `doc_number` | text | | Passport number |
| `doc_expiry` | date | | |
| `remarks` | text | | |
| `document_object_key` | text | | Object storage key for uploaded passport scan |
| `scan_raw_text` | text | | Raw OCR output |
| `scan_first_name` | text | | OCR-extracted field |
| `scan_last_name` | text | | OCR-extracted field |
| `scan_dob` | text | | OCR-extracted field |
| `scan_doc_number` | text | | OCR-extracted field |
| `scan_expiry` | text | | OCR-extracted field |
| `scan_nationality` | text | | OCR-extracted field |
| `scan_status` | text | NOT NULL, default `none` | `none` / `pending` / `done` / `failed` |
| `created_at` | timestamp | NOT NULL | |

---

## Package Inquiries

### `package_inquiries`

Umrah package inquiries from the public website.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `reference_number` | text | NOT NULL, UNIQUE | |
| `departure_date` | date | NOT NULL | |
| `return_date` | date | | |
| `makkah_hotel_id` | integer | | → `hotels.id` |
| `madinah_hotel_id` | integer | | → `hotels.id` |
| `transport_type` | text | | |
| `adults` | integer | NOT NULL, default 1 | |
| `children` | integer | NOT NULL, default 0 | |
| `infants` | integer | NOT NULL, default 0 | |
| `total_pax` | integer | NOT NULL, default 1 | |
| `contact_name` | text | NOT NULL | |
| `contact_phone` | text | NOT NULL | |
| `notes` | text | | |
| `status` | text | NOT NULL, default `pending` | `pending` / `quoted` / `confirmed` / `cancelled` |
| `quotation_id` | integer | | → `quotations.id`; set when staff creates quotation |
| `portal_user_id` | integer | | → `portal_users.id` |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

---

## Portal Users

### `portal_users`

Public user accounts (travel agents, vendors, direct customers).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `type` | text | NOT NULL | `party` / `vendor` / `dc` |
| `status` | text | NOT NULL, default `pending_approval` | `pending_approval` / `approved` / `rejected` |
| `full_name` | text | NOT NULL | |
| `email` | text | | |
| `phone` | text | NOT NULL | |
| `whatsapp` | text | | |
| `company_name` | text | | |
| `owner_name` | text | | |
| `address` | text | | |
| `dts_number` | text | | Travel agent DTS registration number |
| `password_hash` | text | NOT NULL | bcrypt hash |
| `portal_session_token` | text | | Set on login; used as Bearer token |
| `rejection_reason` | text | | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `portal_user_documents`

Documents uploaded by portal users during registration.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `portal_user_id` | integer | NOT NULL | → `portal_users.id` |
| `document_type` | text | NOT NULL, default `other` | |
| `object_key` | text | NOT NULL | Object storage key |
| `original_filename` | text | | |
| `scan_raw_text` | text | | OCR output |
| `scan_status` | text | NOT NULL, default `none` | `none` / `pending` / `done` / `failed` |
| `uploaded_at` | timestamp | NOT NULL | |

### `payment_receipts`

Payment receipt uploads for group ticket bookings by portal users. Deadline is calculated from flight departure time.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `inquiry_id` | integer | NOT NULL | → `public_booking_inquiries.id` |
| `portal_user_id` | integer | NOT NULL | → `portal_users.id` |
| `object_key` | text | | Object storage key for uploaded receipt |
| `payment_status` | text | NOT NULL, default `pending_receipt` | `pending_receipt` / `submitted` / `verified` / `rejected` |
| `deadline_at` | timestamp | NOT NULL | Calculated deadline |
| `deadline_tier` | text | NOT NULL, default `24h` | `1h` / `3h` / `12h` / `24h` |
| `hours_until_flight` | text | | Hours between booking and flight at time of submission |
| `verified_by` | integer | | → `users.id` |
| `verified_at` | timestamp | | |
| `rejection_reason` | text | | |
| `uploaded_at` | timestamp | | Null until receipt is uploaded |
| `created_at` | timestamp | NOT NULL | |

**Deadline tier logic**: ≤24h before flight → 1h deadline; 25–48h → 3h; 49–240h → 12h; >240h → 24h.

---

## Accounting

### `chart_of_accounts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `code` | text | NOT NULL, UNIQUE | e.g. `1001` |
| `name` | text | NOT NULL | |
| `type` | text | NOT NULL | `ASSET` / `LIABILITY` / `EQUITY` / `REVENUE` / `EXPENSE` |
| `description` | text | | |
| `is_active` | boolean | NOT NULL, default true | |
| `created_at` | timestamp | NOT NULL | |

### `general_journal`

Double-entry journal. Every financial event is a single row (debit + credit pair).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `entry_number` | text | NOT NULL, UNIQUE | Auto-generated |
| `date` | timestamp | NOT NULL | |
| `description` | text | NOT NULL | |
| `debit_account_id` | integer | NOT NULL | → `chart_of_accounts.id` |
| `credit_account_id` | integer | NOT NULL | → `chart_of_accounts.id` |
| `amount` | numeric(15,2) | NOT NULL | |
| `currency` | text | NOT NULL, default `SAR` | |
| `source_type` | text | | `flight_request` / `invoice` / `expense` / etc. |
| `source_id` | integer | | ID in the source table |
| `created_at` | timestamp | NOT NULL | |

### `invoices`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `invoice_number` | text | NOT NULL, UNIQUE | |
| `type` | text | NOT NULL, default `customer` | `customer` / `vendor` |
| `client_id` | integer | | → `clients.id` |
| `vendor_id` | integer | | → `vendors.id` |
| `quotation_id` | integer | | → `quotations.id` |
| `amount` | numeric(12,2) | NOT NULL | |
| `paid_amount` | numeric(12,2) | NOT NULL, default 0 | |
| `currency` | text | NOT NULL, default `USD` | |
| `status` | text | NOT NULL, default `draft` | `draft` / `sent` / `paid` / `overdue` |
| `due_date` | timestamp | NOT NULL | |
| `notes` | text | | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

### `payments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `invoice_id` | integer | NOT NULL | → `invoices.id` |
| `amount` | numeric(12,2) | NOT NULL | |
| `currency` | text | NOT NULL, default `USD` | |
| `method` | text | NOT NULL | `bank_transfer` / `cash` / `cheque` / etc. |
| `reference` | text | | |
| `paid_at` | timestamp | NOT NULL | |
| `created_at` | timestamp | NOT NULL | |

### `expenses`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `title` | text | NOT NULL | |
| `category` | text | NOT NULL | |
| `amount` | numeric(12,2) | NOT NULL | |
| `currency` | text | NOT NULL, default `USD` | |
| `vendor_id` | integer | | → `vendors.id` |
| `date` | timestamp | NOT NULL | |
| `notes` | text | | |
| `created_at` | timestamp | NOT NULL | |

### `documents`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `type` | text | NOT NULL | |
| `title` | text | NOT NULL | |
| `client_id` | integer | | → `clients.id` |
| `url` | text | NOT NULL | |
| `created_at` | timestamp | NOT NULL | |

### `activity_logs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `type` | text | NOT NULL | |
| `description` | text | NOT NULL | |
| `entity_type` | text | NOT NULL | |
| `entity_id` | integer | NOT NULL | |
| `user_id` | integer | NOT NULL | → `users.id` |
| `created_at` | timestamp | NOT NULL | |

---

## Currency

### `currency_settings`

Singleton row (id = 1) for global currency preferences.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `home_currency` | text | Default `PKR` |
| `updated_at` | timestamp | |

### `currency_daily_rates`

One row per currency per day.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `currency` | text | e.g. `SAR`, `USD` |
| `date` | date | |
| `vendor_rate` | numeric(12,4) | Rate paid to vendor |
| `guest_rate` | numeric(12,4) | Rate offered to walk-in guests |
| `client_rate` | numeric(12,4) | Rate offered to account clients |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `currency_transactions`

Profit tracking per currency transaction.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `currency` | text | |
| `amount` | numeric(12,2) | Amount exchanged |
| `vendor_rate` | numeric(12,4) | Rate at time of transaction |
| `client_rate` | numeric(12,4) | |
| `vendor_cost` | numeric(14,2) | `amount × vendor_rate` |
| `client_revenue` | numeric(14,2) | `amount × client_rate` |
| `profit` | numeric(14,2) | `client_revenue − vendor_cost` |
| `date` | timestamp | |
| `notes` | text | |
| `created_at` | timestamp | |

---

## WhatsApp

### `whatsapp_monitored_groups`

Groups whose messages are scraped for group ticket data.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `jid` | text | NOT NULL, UNIQUE | WhatsApp group JID |
| `name` | text | NOT NULL | |
| `enabled` | boolean | NOT NULL, default false | |
| `updated_at` | timestamp | NOT NULL | |

### `whatsapp_group_names`

Lightweight JID → display name cache, populated on WhatsApp connect.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `jid` | text | PK | |
| `subject` | text | NOT NULL | Group display name |
| `synced_at` | timestamp | NOT NULL | |

### `whatsapp_messages`

Every group message received by the linked WhatsApp account.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `group_jid` | text | NOT NULL | |
| `sender_jid` | text | NOT NULL | |
| `sender_name` | text | | |
| `text` | text | NOT NULL | |
| `wa_message_id` | text | | WhatsApp internal message ID |
| `timestamp` | bigint | NOT NULL | Unix epoch ms |
| `is_read` | boolean | NOT NULL, default false | |
| `is_sent` | boolean | NOT NULL, default false | True = sent from ERP |
| `quoted_wa_id` | text | | Message being replied to |
| `quoted_text` | text | | |
| `quoted_sender_name` | text | | |
| `created_at` | timestamp | NOT NULL | |

### `whatsapp_group_links`

Links a WhatsApp group to any ERP entity. Unique on `(group_jid, entity_type, entity_id)`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `group_jid` | text | NOT NULL | |
| `entity_type` | text | NOT NULL | `flight_quotation` / `quotation` / `hotel_request` / `transport_booking` / `invoice` / `visa_application` |
| `entity_id` | integer | NOT NULL | |
| `linked_at` | timestamp | NOT NULL | |
| `linked_by` | integer | | → `users.id` |

---

## Bot / Campaigns

### `bot_campaigns`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `message` | text | NOT NULL | Message text to send |
| `contacts` | jsonb | NOT NULL | Array of `{ jid, name }` |
| `current_index` | integer | NOT NULL, default 0 | Progress pointer |
| `status` | text | NOT NULL, default `idle` | `idle` / `running` / `paused` / `done` |
| `next_send_at` | timestamp | | Scheduled time for next send |
| `delay_seconds` | integer | NOT NULL, default 20 | Delay between messages |
| `created_at` | timestamp | NOT NULL | |

### `bot_campaign_sends`

One row per message sent by a campaign.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | serial | PK | |
| `campaign_id` | integer | NOT NULL | → `bot_campaigns.id` |
| `jid` | text | NOT NULL | Recipient JID |
| `name` | text | | |
| `sent_at` | timestamp | NOT NULL | |
| `wa_message_id` | text | | WhatsApp message ID on success |

---

## Config

### `website_config`

Key-value store for public website settings.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `key` | text | PK | Config key |
| `value` | text | NOT NULL | Config value (JSON or plain string) |
| `updated_at` | timestamp | NOT NULL | |
