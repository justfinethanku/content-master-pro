# Partner API System

## Problem Statement

Content Master Pro needs an invite-only Partner API that allows trusted external developers to programmatically query Pinecone namespaces for semantic search. Partners sign in through Supabase Auth, create API keys, and admins control namespace access and read/write permissions per partner. All usage is logged for tracking and rate limiting.

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rate limiting backend | Database-based (MVP) | Simpler, no extra services. Can migrate to Redis later if needed. |
| Invite delivery | Copy to clipboard | Partners are trusted contacts—admin sends code manually via Slack/email. |
| Partner onboarding | Invite-only | Admin creates invite, partner redeems via Supabase Auth. |
| Namespace control | Admin-managed | Admin assigns which namespaces each partner can access. |
| Default permissions | Read-only | Partners can read by default; write toggled per-partner by admin. |

---

## Implementation Plan

### Phase 1: Database Schema

**Goal**: Create tables for invites, partners, permissions, API keys, and usage logs.

#### Table: `partner_invites`
Admin-created, redeemable once.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| code | TEXT UNIQUE | e.g., "INV_abc123xyz" |
| email | TEXT | Expected recipient email |
| created_by | UUID | Admin who created it |
| expires_at | TIMESTAMPTZ | 7-day default |
| redeemed_at | TIMESTAMPTZ | When redeemed |
| redeemed_by | UUID | User who redeemed |
| status | TEXT | 'pending', 'redeemed', 'expired', 'revoked' |
| metadata | JSONB | Notes, preset permissions |

#### Table: `partners`
Users who have redeemed invites.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID UNIQUE | Links to auth.users |
| organization_name | TEXT | Partner org name |
| contact_email | TEXT | Contact email |
| status | TEXT | 'active', 'suspended', 'revoked' |
| rate_limit_per_minute | INTEGER | Default 60 |
| rate_limit_per_day | INTEGER | Default 5000 |

#### Table: `partner_namespace_permissions`
Per-partner namespace access control.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| partner_id | UUID | References partners |
| namespace_id | UUID | References pinecone_namespaces |
| can_read | BOOLEAN | Default true |
| can_write | BOOLEAN | Default false |
| UNIQUE(partner_id, namespace_id) | | |

#### Table: `partner_api_keys`
API keys for programmatic access.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| partner_id | UUID | References partners |
| key_hash | TEXT UNIQUE | SHA-256 hash (never store plaintext) |
| key_prefix | TEXT | First 16 chars for UI display |
| name | TEXT | User-friendly name |
| last_used_at | TIMESTAMPTZ | Last API call |
| status | TEXT | 'active', 'revoked' |
| expires_at | TIMESTAMPTZ | Optional expiration |
| metadata | JSONB | IP whitelist, scopes |

#### Table: `partner_api_usage`
Complete audit trail of all API calls.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| api_key_id | UUID | References partner_api_keys |
| partner_id | UUID | References partners |
| endpoint | TEXT | '/api/v1/search', etc. |
| method | TEXT | 'GET', 'POST' |
| namespace_slug | TEXT | Which namespace queried |
| query_params | JSONB | Request parameters |
| status_code | INTEGER | HTTP response code |
| response_time_ms | INTEGER | Latency |
| error_message | TEXT | If error occurred |
| ip_address | TEXT | Client IP |
| user_agent | TEXT | Client user agent |

---

### Phase 2: Core API

**Goal**: Implement API key authentication and public search endpoint.

#### API Key Format
```
pk_live_abc123xyz456789  (production)
pk_test_abc123xyz456789  (test/development)
```

#### Key Generation
- Generate 32 random bytes, encode as base64url
- Hash with SHA-256 for storage
- Store first 16 chars as `key_prefix` for UI display
- **CRITICAL**: Full key shown ONLY once at creation

#### Authentication Flow
1. Extract `Bearer <key>` from Authorization header
2. Hash the key with SHA-256
3. Look up `partner_api_keys` by hash
4. Verify key is active and not expired
5. Verify partner is active
6. Update `last_used_at`
7. Return partner + key context

#### Rate Limiting
- Sliding window per minute (default: 60 requests)
- Daily quota (default: 5000 requests)
- Configurable per partner via `rate_limit_per_minute` and `rate_limit_per_day`
- Return `429 Too Many Requests` with `Retry-After` header

#### Public Endpoints

**POST /api/v1/search**
```json
// Request
{
  "query": "AI content creation",
  "namespaces": ["jon", "nate"],  // optional, defaults to all allowed
  "topK": 10                       // optional, default 10
}

// Response
{
  "results": [...],
  "query": "AI content creation",
  "namespaces": ["jon", "nate"],
  "count": 10,
  "rateLimit": {
    "remaining": 59,
    "resetAt": "2026-01-10T23:00:00Z"
  }
}
```

**GET /api/v1/namespaces**
```json
// Response
{
  "namespaces": [
    {
      "slug": "jon",
      "display_name": "Jon",
      "description": "Jonathan Edwards' newsletter posts",
      "source_type": "newsletter",
      "can_read": true,
      "can_write": false
    }
  ]
}
```

---

### Phase 3: Admin UI

**Goal**: Admin pages for invite management and partner permissions.

#### `/admin/invites`
- List all invites (pending, redeemed, expired)
- Create new invite (email, expiration, preset permissions)
- Copy invite code to clipboard
- Revoke/delete invites

#### `/admin/partners`
- List all partners with status badges
- View partner details
- Edit rate limits
- Suspend/reactivate partners
- View API keys (prefix only)
- Revoke API keys

#### `/admin/partners/[id]/permissions`
- Visual matrix: namespaces × permissions
- Toggle read/write per namespace
- Bulk grant/revoke

#### `/admin/usage`
- Partner usage stats
- Rate limit violations
- Error rates
- Top namespaces by query volume

---

### Phase 4: Partner Dashboard

**Goal**: Partner-facing UI for key management and usage tracking.

#### `/partner` (Dashboard)
- Overview stats (calls today/month)
- Rate limit status
- Accessible namespaces
- Recent API calls

#### `/partner/keys`
- List keys with prefix, name, last used
- Create new key (shows full key ONCE)
- Revoke key with confirmation
- Status badges

#### `/partner/usage`
- Daily usage chart
- Endpoint breakdown
- Error logs
- Export CSV

#### `/partner/redeem`
- Input invite code
- Validate and redeem
- Redirect to dashboard on success

---

### Phase 5: Documentation

**Goal**: External developer documentation.

#### `/docs/api`
- Getting started
- Authentication guide
- Endpoint reference
- Rate limits
- Error codes
- Examples (cURL, JavaScript, Python)

#### Example Request
```bash
curl -X POST https://your-domain.com/api/v1/search \
  -H "Authorization: Bearer pk_live_abc123xyz456789" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "AI content creation workflows",
    "namespaces": ["jon", "nate"],
    "topK": 10
  }'
```

---

## Files to Modify

- `src/lib/types.ts` - Add Partner API types
- `src/app/(dashboard)/layout.tsx` - Add admin/partner nav items

---

## New Files

### Migrations
- `supabase/migrations/20260111000001_partner_api_tables.sql` - All tables, indexes, RLS

### Library Functions
- `src/lib/partner-api/keys.ts` - Key generation/hashing
- `src/lib/partner-api/auth.ts` - API key authentication
- `src/lib/partner-api/rate-limit.ts` - Database-based rate limiting (query usage table)
- `src/lib/partner-api/permissions.ts` - Permission helpers

### API Routes
- `src/app/api/v1/search/route.ts` - Public search
- `src/app/api/v1/namespaces/route.ts` - List namespaces
- `src/app/api/admin/partners/route.ts` - Partner management
- `src/app/api/admin/invites/route.ts` - Invite management
- `src/app/api/partner/keys/route.ts` - Key management
- `src/app/api/partner/redeem/route.ts` - Redeem invite

### Admin UI
- `src/app/(dashboard)/admin/invites/page.tsx`
- `src/app/(dashboard)/admin/partners/page.tsx`
- `src/app/(dashboard)/admin/partners/[id]/page.tsx`
- `src/app/(dashboard)/admin/partners/[id]/permissions/page.tsx`
- `src/app/(dashboard)/admin/usage/page.tsx`

### Partner UI
- `src/app/(dashboard)/partner/page.tsx`
- `src/app/(dashboard)/partner/keys/page.tsx`
- `src/app/(dashboard)/partner/usage/page.tsx`
- `src/app/(dashboard)/partner/redeem/page.tsx`

### Documentation
- `src/app/docs/api/page.tsx`

### Components
- `src/components/partner/api-key-display.tsx`
- `src/components/partner/permissions-matrix.tsx`
- `src/components/partner/usage-chart.tsx`

---

## Status: ✅ Implementation Complete

## Execution Order

0. [x] Copy plan to `./plans/partner-api-system.md`
1. [x] Create database migration with all tables, indexes, RLS
2. [x] Add Partner API types to `src/lib/types.ts`
3. [x] Implement key generation helper
4. [x] Implement API key auth middleware
5. [x] Implement rate limiting (DB-based MVP)
6. [x] Build public search endpoint (`/api/v1/search`)
7. [x] Build namespaces endpoint (`/api/v1/namespaces`)
8. [x] Build admin invites API and UI
9. [x] Build admin partners UI with permissions matrix
10. [x] Build partner redeem flow
11. [x] Build partner dashboard and key management
12. [x] Build partner usage dashboard
13. [x] Build API documentation page
14. [ ] Test complete flow end-to-end
15. [x] Mark plan complete

---

## Notes

### Security Considerations
1. **Never store plaintext API keys** - Always hash with SHA-256
2. **One-time key display** - Full key shown only at creation
3. **Rate limiting essential** - Prevents abuse
4. **Audit everything** - All API calls logged

### Rate Limiting Strategy
- Sliding window per minute + daily quota
- Configurable per partner
- `429 Too Many Requests` with `Retry-After` header
- **Decision: Database-based for MVP** - Query `partner_api_usage` table to count recent requests. Simpler setup, no extra services. Can migrate to Vercel KV/Redis later if latency becomes an issue at scale.

### Invite Delivery
- **Decision: Display code to copy** - Admin UI shows the invite code with a "Copy to Clipboard" button. Admin manually sends to partner via Slack, email, etc.
- No email service integration for MVP (can add Resend later if needed)

### Key Formats
- Invite: `INV_<16-char-random>` (e.g., `INV_abc123XYZ456def`)
- API Key: `pk_live_<base64url>` (e.g., `pk_live_qR8xK2mN5pT9wF3v...`)

### RLS Pattern Summary
| Table | Read | Write |
|-------|------|-------|
| partner_invites | Admins + own redeemed | Admins only |
| partners | Admins + own record | Admins only |
| partner_namespace_permissions | Admins + own | Admins only |
| partner_api_keys | Admins + own | Partners own, Admins all |
| partner_api_usage | Admins + own | Service role only (logging) |

### Dependencies
- Existing `pinecone_namespaces` table
- Existing `searchPosts()` function
- Existing admin role in `profiles` table
- Rate limiting store (Vercel KV recommended, DB fallback)
