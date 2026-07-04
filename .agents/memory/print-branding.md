---
name: Print Branding System
description: How company branding is stored, fetched, and applied to print documents in the ERP
---

## The pattern

Branding fields live as extra keys in the existing `websiteConfigTable` key-value store.
No new DB table is ever needed — just add keys to DEFAULTS, rowsToConfig, and keyMap in `artifacts/api-server/src/routes/website-config.ts`.

The snake_case keys are returned verbatim in the GET `/api/website-config` response:
`company_name`, `logo_url`, `print_logo_url`, `company_address`, `company_ntn`,
`bank_name`, `bank_account`, `bank_iban`, `swift_code`, etc.

## Shared component

`artifacts/umrah-erp/src/components/print-layout.tsx` exports:
- `PrintLayout` — wraps printable content with AMI-style A4 header (logo, company name, address), optional watermark, bank details, terms, signature footer
- `useBranding()` — hook that fetches `/api/website-config` and normalises to a typed `Branding` object

**Why a hook rather than context:** avoids provider boilerplate; query is cached 5 min so multiple components on one page don't re-fetch.

## Applying to a page (pattern)

```tsx
import { useBranding } from "@/components/print-layout";
// inside component:
const branding = useBranding();
const logoSrc = branding.printLogoUrl || branding.logoUrl;
// then in JSX:
<div className="hidden print:block ...">   // print-only header
  {logoSrc && <img src={logoSrc} ... />}
  <div>{branding.companyName}</div>
  ...
</div>
```

Already applied to: `voucher-detail.tsx`, `hotel-invoice-form.tsx`.

## Logo upload

Uses existing `/api/storage/uploads/request-url` presigned URL pattern:
POST → get `{ uploadURL, objectPath }` → PUT file to uploadURL → store `/api/storage/public-objects/<objectPath>` as the logo_url value.

## Nav groups (layout.tsx)

Current order: Dashboard, Sales (CRM merged here), Recording (new shortcut group),
Finance, Reports, Operations, Portal, Messaging, Files, Admin.
The "Recording" group has direct links to create new Hotel Invoice (DN), and RV/PV/JV/CV vouchers.
