# Security Specification — LA VUELTA SESSIONS

## 1. Data Invariants
1. **Default Deny**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false`).
2. **PII Isolation**: `users_private/{userId}` contains `email`, `phone`, `cedula`, and `birthDate` and is readable ONLY by the document owner (`request.auth.uid == userId`) or the verified bootstrapped super-admin (`forgen122@gmail.com` with `email_verified == true`).
3. **Zero Self-Privilege Escalation**: Users creating `users_public/{userId}` can ONLY set `role == 'client'`. Only `isBootstrappedAdmin()` can create/update/delete `staff_roles/{userId}` or elevate roles.
4. **Order Integrity & Terminal State Locking**: Clients creating `orders/{orderId}` must set `userId == request.auth.uid`, `status == 'pending'`, valid `eventId` (verified via `exists()`), and server timestamp `createdAt == request.time`. Clients can never set `status == 'approved'` or modify terminal orders.
5. **Query Enforcer & Cost Guard**: No `allow list` rule delegates filtering to the client or invokes `get()` / `exists()`.

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Shadow Field Injection on UserPrivate**: `{ uid: "u1", ..., isAdmin: true }` -> Rejected by `hasOnly()`.
2. **Self-Role Elevation on UserPublic Create**: `{ uid: "u1", displayName: "Attacker", role: "super_admin", blocked: false, ... }` -> Rejected because `role == 'client'` is required for non-admin creation.
3. **Unverified Admin Email Spoof**: Token `{ email: "forgen122@gmail.com", email_verified: false }` reading `/users_private/victim` -> Rejected by `email_verified == true` check.
4. **Cross-User PII Read**: User `u2` executing `get(/users_private/u1)` -> Rejected by owner check.
5. **Order Status Shortcutting**: User `u1` creating `/orders/ord1` with `status: "approved"` -> Rejected because client creation enforces `status == 'pending'`.
6. **Orphaned Order Creation**: User `u1` creating `/orders/ord1` referencing non-existent `/events/ghost_ev` -> Rejected by `exists(/databases/$(database)/documents/events/$(incoming().eventId))`.
7. **Timestamp Forgery**: User `u1` creating `/users_private/u1` with backdated `createdAt` != `request.time` -> Rejected by temporal integrity rule.
8. **ID Poisoning (2KB Document ID)**: Creating `/orders/<2000-char-id>` -> Rejected by `isValidId()` (`size() <= 128` and regex `^[a-zA-Z0-9_\-]+$`).
9. **Value Poisoning on Update**: Updating `users_private/u1` `phone` with a 50KB string or integer -> Rejected by `isValidUserPrivate(incoming())` wrapping the update block.
10. **Immutable Owner Swap**: Updating `orders/ord1` to change `userId` -> Rejected by immutability and terminal state gates.
11. **Direct Staff Role Write by Door Staff**: Authenticated user `staff1` writing `/staff_roles/staff1` with `role: "super_admin"` -> Rejected because only `isBootstrappedAdmin()` can mutate `staff_roles`.
12. **Blanket List Scraping on Orders**: User `u2` listing `/orders` without `where('userId', '==', 'u2')` -> Rejected by `resource.data.userId == request.auth.uid`.
