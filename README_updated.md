# Invente25 Admin Backend — payment verification

This repository contains the payment-receipt verification slice of the
Invente backend. It uses the participant repository's PostgreSQL schema and
does not own that schema.

## Scope

Implemented here:

- Azure Blob Storage upload tickets for participant PDF receipts.
- Direct browser upload with a short-lived, single-blob SAS URL.
- Server-side Azure `HEAD`/`GetProperties` validation.
- Permanent public Azure URL generation for the participant repository's
  `ticket_payments.s3_url` column.
- Shared staff JWT validation.
- Required volunteer signup in the `verification` table.
- Volunteer queue, debounced search, status filter, payment detail, PDF
  display, and decision UI.
- Transactional `Accepted`/`Rejected` decisions with a verification log.

Not implemented in this repository:

- Participant registration, Razorpay integration, or the participant PATCH
  API.
- Redis streams, ticket creation, QR generation, or participant email.
- Attendance changes.
- Database migrations.

The legacy unauthenticated OCR receipt routes are no longer mounted. New
participant uploads must use the Azure flow below.

The participant frontend and worker project remain separate systems.

## Database contract

The supplied `V1__Initial_schema.sql` is authoritative. This service uses
only its existing tables and columns, especially:

- `ticket_payments` — `ticket_id`, `ticket_type`, `amount_paid`, `s3_url`,
  `status`, and timestamps.
- `users` — participant details.
- `ticket_event` and `events` — events associated with a payment.
- `hackathon_regs` and `hackathon_members` — hackathon team data.
- `verification` — volunteer signup records.
- `payment_verification_log` — accepted/rejected decision history.

Payment statuses are exactly the values in the schema:

```text
PendingPayment
NotVerified
Accepted
Rejected
```

The service never runs the files under `backend/migrations/`. Configure the
provided shared `DATABASE_URL` to a database where the participant schema has
already been installed.

## End-to-end flow

```text
Participant frontend
  │ POST upload URL with ticket_id, application/pdf, and file_size
  ▼
This backend ── checks ticket_payments ──► returns Azure SAS + public_url
  │
  ├── browser PUTs the PDF directly to Azure Blob Storage
  │
  ├── POST validation with upload_token
  │     └── this backend performs Azure HEAD/GetProperties
  │
  └── frontend PATCHes the participant repository with public_url
        └── participant repository owns s3_url and PendingPayment → NotVerified

Volunteer frontend
  │ shared staff JWT
  ▼
This backend ── direct database reads ──► queue/detail/PDF
  │
  └── PATCH decision ── transaction + FOR UPDATE ──► ticket_payments
                                      └────────────► payment_verification_log
```

This backend does not update `s3_url` or the participant status during the
upload flow. The participant frontend performs the agreed PATCH request to
the other repository after the validation endpoint succeeds.

## API

All endpoints below are mounted beneath `/organizers/api`.

### Participant receipt upload

These two endpoints are sessionless. The upload URL endpoint requires an
allowed browser `Origin`; it is not a participant login mechanism.

#### `POST /public/registrations/receipt-upload-url`

Request:

```json
{
  "ticket_id": "payment-ticket-uuid",
  "content_type": "application/pdf",
  "file_size": 123456
}
```

The ticket must exist in `ticket_payments` and currently be
`PendingPayment`. The backend returns:

```json
{
  "ticket_id": "payment-ticket-uuid",
  "upload_id": "random-upload-uuid",
  "object_key": "receipts/random-upload-uuid.pdf",
  "upload_url": "https://...signed-azure-url",
  "public_url": "https://.../receipts/random-upload-uuid.pdf",
  "upload_token": "signed-validation-token",
  "expires_at": "timestamp",
  "content_type": "application/pdf",
  "max_size_bytes": 5242880
}
```

The participant frontend must upload using `PUT` to `upload_url` with:

```text
x-ms-blob-type: BlockBlob
Content-Type: application/pdf
```

#### `POST /public/registrations/receipt-upload/validate`

Request:

```json
{
  "upload_token": "signed-validation-token",
  "object_key": "receipts/random-upload-uuid.pdf"
}
```

The backend performs an Azure blob properties request and accepts the object
only when it exists, has `Content-Type: application/pdf`, starts with the PDF
signature `%PDF-`, and is larger than zero bytes and at most 5 MiB. Only after
a successful response should the frontend PATCH the other repository with
the returned `public_url`.

The upload endpoints do not write `ticket_payments.s3_url`; that column is
written by the participant repository's API.

### Volunteer receipt review

All review endpoints require the shared staff access JWT and a completed
signup in `verification`.

```text
GET   /receipt-review/volunteers/me
POST  /receipt-review/volunteers/signup
GET   /receipt-review/submissions
GET   /receipt-review/submissions/:ticketId
PATCH /receipt-review/submissions/:ticketId/decision
```

`GET /volunteers/me` is available after JWT authentication before signup so
the UI can determine whether to show the signup form.

Signup request:

```json
{
  "email": "volunteer@ssn.edu.in",
  "password": "a-real-user-entered-password",
  "name": "Volunteer Name",
  "dept": "CSE"
}
```

The backend ignores any client-supplied volunteer ID. It extracts the UUID
from the JWT subject `staff:<uuid>` and inserts that UUID into
`verification.volunteer_id`. The password is stored as a bcrypt hash; the
shared staff JWT remains the authorization mechanism for these endpoints.

List query parameters:

```text
status=all|PendingPayment|NotVerified|Accepted|Rejected
search=<ticket id, participant name/email, or hackathon team>
page=1
page_size=25
```

The default status is `all`, so `PendingPayment` is visible in the queue.

Decision request:

```json
{
  "status": "Accepted"
}
```

or:

```json
{
  "status": "Rejected"
}
```

Only `NotVerified` payments can be decided. The decision transaction locks
the payment row with `FOR UPDATE`, updates `ticket_payments`, and inserts a
row into `payment_verification_log` using the registered volunteer UUID. A
second concurrent decision receives a conflict after the first transaction
commits.

Every JWT role with a non-empty `roles` claim can view and decide receipts, as
requested. The frontend does not replace backend authorization.

## JWT

The review middleware validates the agreed staff access token:

```json
{
  "iss": "invente-auth",
  "aud": ["invente-admin-api", "invente-review-api"],
  "sub": "staff:8f3b2b1e-7d4f-4d8a-a6f1-123456789abc",
  "jti": "unique-token-id",
  "token_type": "access",
  "email": "volunteer@ssn.edu.in",
  "primary_role": "volunteer",
  "roles": ["volunteer", "receipt_read_write"],
  "permissions": ["receipts:read", "receipts:review"],
  "department_ids": [],
  "event_ids": [],
  "iat": 1788336000,
  "nbf": 1788336000,
  "exp": 1788336900
}
```

The backend verifies the signature using `JWT_PUBLIC_KEY`, issuer, audience,
algorithm, time claims, `token_type`, the `staff:<uuid>` subject format, and a
non-empty roles array. Receipt access is derived from the presence of a staff
role; the token's permission list is not used to grant access.

## Configuration

Required backend environment variables:

```text
DATABASE_URL
JWT_PUBLIC_KEY                 # PEM; literal \n is accepted in an env value
```

Azure can be configured with either a connection string or account details:

```text
AZURE_STORAGE_CONNECTION_STRING
```

or:

```text
AZURE_STORAGE_ACCOUNT_NAME
AZURE_STORAGE_ACCOUNT_KEY
```

Storage and upload settings:

```text
AZURE_STORAGE_CONTAINER_NAME
AZURE_PUBLIC_BASE_URL           # URL prefix before the object key; defaults to account/container
AZURE_STORAGE_BLOB_ENDPOINT     # optional; defaults to account blob endpoint
AZURE_UPLOAD_TOKEN_SECRET
AZURE_SAS_EXPIRY_SECONDS        # defaults to 900; allowed range 60–604800
AZURE_RECEIPT_PREFIX            # defaults to receipts
UPLOAD_ALLOWED_ORIGINS          # comma-separated exact frontend origins
LEGACY_ATTENDANCE_JOBS_ENABLED  # leave false until attendance is resumed
```

The Azure container must be configured for anonymous public blob read access
if the permanent `public_url` is expected to render without a read SAS. Azure
Blob CORS must also allow the participant frontend to issue the direct PUT.

## Upload security boundary

The backend never sends Azure credentials to either frontend. Each upload URL
is scoped to one random object key, grants only create/write permissions, and
expires quickly. The backend checks an exact configured `Origin` before
issuing or validating an upload ticket.

A browser `Origin` check and a bearer SAS cannot cryptographically prove that
the request came from one particular frontend: a holder of a still-valid SAS
can reuse it. Keeping the SAS short-lived, random, single-blob, and write-only
is the practical control for a direct-browser-upload design. Public read URLs
also mean that anyone who obtains a URL can read that PDF; this is inherent in
the permanent public URL requirement.

## Development and verification

```bash
cd backend && npm ci && npm start
cd frontend && npm ci && npm run dev
```

The backend start command no longer runs migrations. Use the externally
provided database endpoint and schema.

Checks:

```bash
cd backend
node --check src/index.js
node --check src/routes/receipt-upload.js
node --check src/routes/receipt-review.js
node --check src/utils/azureBlobStorage.js

cd ../frontend
npm run build
npx eslint src/pages/ReceiptReview.jsx
```

The repository's full frontend lint currently contains pre-existing errors in
unrelated legacy pages; the new receipt review page is lint-clean and the
production build completes successfully.
