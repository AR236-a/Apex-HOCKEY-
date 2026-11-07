# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Zero PII Storage**: None of `/players/{playerId}`, `/chatMessages/{messageId}`, `/socialGroups/{groupId}`, or `/tournamentRuns/{runId}` store email addresses, phone numbers, or physical addresses.
2. **Identity & Ownership**:
   - A `PlayerProfile` at `/players/{playerId}` can only be created or updated when `playerId == request.auth.uid` and `incoming().uid == request.auth.uid`.
   - A `ChatMessage` at `/chatMessages/{messageId}` requires `incoming().authorId == request.auth.uid` and is immutable after creation.
   - A `SocialGroup` at `/socialGroups/{groupId}` requires `incoming().ownerId == request.auth.uid` on creation and preserves `ownerId` and `createdAt` on updates.
   - A `TournamentRun` at `/tournamentRuns/{runId}` requires `incoming().ownerId == request.auth.uid` and locks updates once `existing().status in ['champion', 'eliminated']` (Terminal State Locking).
3. **Strict Keys & Volumetric Bounds**:
   - Every string validates `.size() >= min && .size() <= max`.
   - Every list (`unlockedJerseyIds`, `completedChallengeIds`, `claimedRewardIds`) is strictly bounded in size and validates element type on non-empty arrays.
   - All timestamps (`createdAt`, `updatedAt`) must match `request.time`.
4. **Query Enforcer on `list`**:
   - `/players`: `allow list: if resource.data.mmr >= 0;`
   - `/chatMessages`: `allow list: if resource.data.channel in ['global', 'world-cup', 'asia-cup', 'lfg', 'strategy'];`
   - `/socialGroups`: `allow list: if resource.data.memberCount >= 1;`
   - `/tournamentRuns`: `allow list: if resource.data.mode in ['world_cup', 'asia_cup', 'all_teams'];`

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on PlayerProfile**: Authenticated user `uid_A` creates `/players/uid_B` or sets `uid: "uid_B"`. -> `PERMISSION_DENIED`
2. **Shadow Field Injection on PlayerProfile**: User sends `isAdmin: true` in `/players/uid_A`. -> `PERMISSION_DENIED`
3. **Unverified Email Write**: User with `email_verified: false` attempts to create a `ChatMessage`. -> `PERMISSION_DENIED`
4. **Denial-of-Wallet 1MB String on ChatMessage**: User sends `text` of length 5000 (> 400 max). -> `PERMISSION_DENIED`
5. **Unbounded Array Poisoning on PlayerProfile**: User sends 100 items in `unlockedJerseyIds` (> 30 max). -> `PERMISSION_DENIED`
6. **Client Timestamp Forgery**: User supplies a past/future `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`
7. **Immutable Field Mutation**: User updates `createdAt` or `uid` on `/players/uid_A`. -> `PERMISSION_DENIED`
8. **ChatMessage Mutation**: User attempts to `update` or `delete` an existing `/chatMessages/{messageId}`. -> `PERMISSION_DENIED`
9. **Terminal State Bypass on TournamentRun**: User attempts to update a `TournamentRun` whose `existing().status` is `'champion'` or `'eliminated'`. -> `PERMISSION_DENIED`
10. **Invalid Enum Injection**: User creates a `ChatMessage` with `channel: 'secret-hack'`. -> `PERMISSION_DENIED`
11. **Path ID Poisoning**: User creates `/chatMessages/invalid$id!with*spaces` failing `isValidId()`. -> `PERMISSION_DENIED`
12. **Value Poisoning on Update**: User updates `mmr` on `/players/uid_A` with a string `"999999"` instead of a bounded number. -> `PERMISSION_DENIED`
