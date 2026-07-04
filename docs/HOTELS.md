# Hotels

**Purpose**: Multi-vendor hotel procurement system covering the full pipeline from booking request through vendor quote comparison to invoice generation and accounting.  
**Backend routes**:
- `artifacts/api-server/src/routes/hotels.ts` — hotel master + procurement workflow
- `artifacts/api-server/src/routes/hotel-invoices.ts` — DN financial records
**ERP pages**: Hotels master (`/hotels`), Hotel Requests (within Quotations/Sales), Accounting (`/accounting`)  

---

## Architecture

```
Sales staff → Create Hotel Request (HR-XXXX)
                    ↓
          Send to vendor(s) via WhatsApp
                    ↓
          Vendor replies with quote
                    ↓
          ERP staff adds vendor_quotes record
                    ↓
          Select winning quote → generate Hotel Invoice (DN-XXXX)
                    ↓
          Auto-post double-entry journal entries
                    ↓
          Customer portal shows hotel voucher
```

---

## Hotel Master Database

Hotels table stores the agency's curated hotel catalogue for Umrah destinations (primarily Makkah and Madinah).

### Fields
| Field | Description |
|---|---|
| `name` | Hotel name |
| `city` | City (Makkah / Madinah / Jeddah) |
| `stars` | Star rating (1–5, default 3) |
| `distance_from_haram` | Walking distance (text, e.g. "200m") |
| `room_types` | Array: Single, Double, Triple, Quad |
| `meal_plans` | Array: BB (Bed & Breakfast), HB (Half Board), FB (Full Board) |
| `category` | Hotel category label |
| `default_vendor_id` | Preferred supplier |
| `image_url` | Hosted image URL |
| `google_image_url` | Fallback Google image |
| `vendor_whatsapp` | Primary vendor WhatsApp number |
| `vendor_whatsapp_group_id` | WhatsApp group JID for vendor communication |
| `is_active` | Controls visibility on public inquiry forms |

### Hotel Vendors (Many-to-Many)
`hotel_vendors` join table supports multiple vendors per hotel with priority ordering. Each hotel-vendor pair can have a dedicated WhatsApp group for communication.

### Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/hotels` | List hotels (with vendor counts) |
| POST | `/api/hotels` | Create hotel |
| GET | `/api/hotels/:id` | Hotel detail |
| PATCH | `/api/hotels/:id` | Update hotel |
| DELETE | `/api/hotels/:id` | Delete hotel |
| GET | `/api/hotels/:id/vendors` | Vendors for hotel |
| POST | `/api/hotels/:id/vendors` | Add vendor |
| DELETE | `/api/hotels/:id/vendors/:vendorId` | Remove vendor |
| GET | `/api/public/hotels` | Public list (active only) |

---

## Vendor Directory

`vendors` table manages all supplier accounts.

### Fields
| Field | Description |
|---|---|
| `name` | Vendor/company name |
| `type` | hotel / transport / other |
| `contact_name` | Primary contact |
| `email` | Email address |
| `phone` | Phone number |
| `country` | Country of operation |
| `rating` | Internal rating (1–5) |
| `total_deals` | Count of completed bookings |
| `is_active` | Active status |

### Endpoints
Standard CRUD: `GET/POST /api/vendors`, `GET/PATCH/DELETE /api/vendors/:id`

---

## Hotel Request (Procurement) Workflow

### Reference Number Format
`HR-XXXX` — sequential 4-digit padded number.

### Request Statuses
| Status | Description |
|---|---|
| `pending` | Just created, not yet sent to vendors |
| `notified` | Sent to vendor(s) via WhatsApp; awaiting quote |
| `quoted` | At least one quote received |
| `confirmed` | Winning quote selected |
| `invoiced` | Hotel invoice (DN) generated |
| `cancelled` | Request cancelled |

### Step-by-Step Flow

**1. Create Request**  
`POST /api/hotel-requests { clientId, hotelId, checkIn, checkOut, rooms, pax, roomType, mealPlan, specialNotes }`  
- Generates reference number `HR-XXXX`
- Status: `pending`

**2. Send to Vendor**  
`POST /api/hotel-requests/:id/send-to-vendor`  
- Looks up vendor WhatsApp number(s) from `hotel_vendors`
- Constructs enquiry message from template
- Sends via `whatsapp.ts.sendMessage()`
- Sets `notified_at = now()`, status: `notified`

**3. Add Vendor Quote**  
`POST /api/hotel-requests/:id/quotes { vendorId, pricePerRoom, totalPrice, currency, mealPlan, roomType, distance, availability, cancellationPolicy, vendorWhatsapp, notes }`  
- Creates `vendor_quotes` record with status `received`
- Status of request updated to `quoted`

**4. Update Quote**  
`PATCH /api/hotel-requests/:id/quotes/:quoteId { ...fields }` — update any quote fields

**5. Select Quote**  
`PATCH /api/hotel-requests/:id/quotes/:quoteId/select`  
- Sets `vendor_quotes.is_selected = true`
- Marks all other quotes as unselected
- Sets `hotel_requests.selected_quote_id`
- Status: `confirmed`

**6. Generate Invoice**  
Hotel invoice is created separately: `POST /api/invoices/hotel`  
Links to the request via `hotel_request_id`.

---

## Hotel Invoices (Debit Notes)

Hotel invoices use a **Debit Note (DN)** system to track dual-currency obligations.

### DN Number Format
`DN-XXXX` — sequential 4-digit padded. Seeded counter in `journal_counters`.  
`GET /api/invoices/hotel/next-dn` — preview next number before creating.

### Dual Currency Design
Each hotel invoice stores **four** monetary amounts:

| Field | Description |
|---|---|
| `client_amount_sar` | What the client owes us (SAR) |
| `client_amount_pkr` | What the client owes us (PKR) |
| `vendor_amount_sar` | What we owe the hotel vendor (SAR) |
| `vendor_amount_pkr` | What we owe the hotel vendor (PKR) |

This reflects the reality of Umrah hotels: priced in SAR to vendors but billed in PKR to Pakistani clients, with a spread.

### Auto-Accounting on DN Creation

`postHotelInvoice()` in `journal-poster.ts` creates two journal entries simultaneously:

```
Entry 1 (Client receivable):
  DR PARTY (client_amount in PKR/SAR)
  CR HOTEL

Entry 2 (Vendor payable):
  DR HOTEL
  CR VENDOR (vendor_amount in PKR/SAR)
```

### Invoice Statuses
`draft` → `accepted` → `paid` / `cancelled`

### Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/invoices/hotel/next-dn` | Preview next DN number |
| GET | `/api/invoices/hotel` | List hotel invoices (with client/vendor/hotel names) |
| GET | `/api/invoices/hotel/:id` | Full detail |
| POST | `/api/invoices/hotel` | Create hotel invoice (triggers accounting) |
| PUT | `/api/invoices/hotel/:id` | Update (status, amounts) |

---

## Portal Integration

When a hotel invoice is linked to a client (via `client_id`), it appears in the customer portal:
- `GET /api/portal/hotel-vouchers` — returns hotel invoices for the linked `clientId`
- Portal hotel voucher page shows printable confirmation with hotel name, dates, room type, and pax count

---

## Automation Integration

### Hotel Check-in Reminder (`hotel-checkin-reminder.ts`)
- Fires daily at 08:00
- Finds hotel requests with check-in **tomorrow**
- Sends WhatsApp message to customer with check-in details
- Template from `website_config.wa_templates.hotelCheckinReminder`

### Hotel Vendor Follow-up (`hotel-vendor-followup.ts`)
- Fires every 4 hours
- Finds hotel requests with status `notified` (sent to vendor) but no quotes yet
- Sends follow-up WhatsApp to the vendor
- Template from `website_config.wa_templates.hotelVendorFollowup`
- Duplicate-checked: only one follow-up per 4-hour window

---

## DN Report

`GET /api/accounting/reports/dn-report`  
Lists all hotel Debit Notes with:
- DN number, hotel name, client name, vendor name
- Check-in / check-out dates
- Client amounts (SAR + PKR)
- Vendor amounts (SAR + PKR)
- Margin / spread
- Status

---

## Database Tables

| Table | Purpose |
|---|---|
| `hotels` | Hotel master catalogue |
| `vendors` | Supplier/vendor directory |
| `hotel_vendors` | Many-to-many hotel-vendor links with priority |
| `hotel_requests` | Procurement request records |
| `vendor_quotes` | Vendor price quotes per request |
| `hotel_invoices` | Financial DN records (dual currency) |

---

## Permissions

| Action | Required Role |
|---|---|
| View hotels | All ERP roles |
| Create/edit hotels | Operations, Management, Admin |
| View hotel requests | Sales, Operations, Management, Admin |
| Create/edit requests | Sales, Operations, Management, Admin |
| Send to vendor | Operations, Management, Admin |
| Create hotel invoice (DN) | Accounts, Management, Admin |
| View DN report | Accounts, Management, Admin |

---

## Known Limitations

- Vendor WhatsApp communication is one-way; vendor replies are received in the WhatsApp inbox but not automatically parsed as quotes.
- The DN number sequence can produce gaps if a record creation fails after the counter is incremented.
- SAR/PKR conversion amounts are entered manually; no automatic conversion from daily rates at invoice time.
- The hotel invoices table does not have a direct link to the individual `vendor_quotes` record selected — only to `hotel_requests`.

---

## Future Extension Points

- Automated vendor quote parsing from WhatsApp inbox messages
- Hotel availability calendar / room count tracking
- Rate sheet management per hotel per season
- Automated confirmation vouchers sent to vendors via WhatsApp
- GDS hotel search integration (Amadeus Hotel API)
- Hotel review and rating system from past stays
