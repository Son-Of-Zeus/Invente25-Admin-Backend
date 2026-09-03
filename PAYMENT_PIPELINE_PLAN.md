# Invente25 payment-verification implementation plan

The current scope is the payment-verification slice only. The detailed,
implementation-aligned README is [README_updated.md](README_updated.md).

## Phases

1. Azure Blob setup: issue short-lived single-blob SAS upload URLs, return the
   permanent public URL, and validate the uploaded object with a server-side
   HEAD/GetProperties check. Accept PDFs up to 5 MiB only.
2. Shared staff authentication: validate the agreed JWT, derive receipt
   access from its roles, and require volunteer signup using the JWT subject
   UUID as `verification.volunteer_id`.
3. Verification API: read the supplied schema directly, list all payment
   statuses with search/filter/pagination, show participant/team/event data
   and the public PDF URL, then transactionally record `Accepted` or `Rejected`
   decisions with `FOR UPDATE` and `payment_verification_log`.
4. Volunteer GUI: add signup, queue, debounced search, all-status filtering,
   detail/PDF display, and decision controls.
5. Integration: configure the external database endpoint, Azure container,
   public URL, Azure CORS, allowed frontend origins, and the staff JWT public
   key. The participant frontend performs the PATCH to its own repository
   after this backend validates the upload.

## Explicitly deferred

Participant registration and payment, the participant repository's PATCH API,
Redis workers, ticket/QR/email processing, attendance, and all migrations are
outside this repository's current implementation.
