# Subscription Validation Bug Fix - Complete Guide

## Problem Statement
Users with active subscriptions were seeing "10 days expired" message (trial expiry message) when logging in, even with valid pro plan subscriptions.

## Root Cause
The `SubscriptionGuard.tsx` component was only checking the subscription `status` field without validating the `current_period_end` date. This caused:
- Expired subscriptions to incorrectly show trial messages
- Invalid subscription validation logic

## Solution Overview

### Files Modified
1. **app/owner/SubscriptionGuard.tsx** - Fixed subscription validation logic
2. **app/pricing/page.tsx** - Added handling for subscription expiry messages

### Key Changes

#### 1. SubscriptionGuard.tsx - Subscription Validation Logic

**Before:**
```typescript
// Only checked status, not expiry date
if (subData && (subData.status === 'active' || subData.status === 'trialing')) {
    if (isMounted) setStatus('active');
    return;
}
```

**After:**
```typescript
// Now checks both status AND current_period_end date
if (subData && subData.stripe_subscription_id) {
    const periodEndDate = subData.current_period_end ? new Date(subData.current_period_end) : null;
    const now = new Date();
    
    // Valid subscription must be active AND not expired
    if ((subData.status === 'active' || subData.status === 'trialing') && periodEndDate && periodEndDate > now) {
        if (isMounted) setStatus('active');
        return;
    }
    
    // Subscription exists but has expired
    if (periodEndDate && periodEndDate <= now) {
        if (isMounted) {
            setSubscriptionEndDate(subData.current_period_end);
            setStatus('subscription_expired');
        }
        return;
    }
}
```

#### 2. New Subscription States

| Status | When | Display |
|--------|------|---------|
| `active` | Valid subscription OR access allowed | Full dashboard access |
| `trial` | Free trial active (days remaining) | Trial banner with countdown |
| `subscription_expired` | Subscription past `current_period_end` | "Subscription Expired" modal + renew button |
| `trial_expired` | Free trial period exceeded | "Free Trial Expired" modal + plan selection |

#### 3. User Flow

```
Login
├─ Check if user has business_id
│
├─ Look for Subscriptions record with stripe_subscription_id
│
├─ If Found:
│  ├─ Check status = 'active' or 'trialing' ✓
│  ├─ Check current_period_end > today ✓
│  ├─ YES → Navigate to dashboard
│  └─ NO → Show "Subscription Expired" with end date + Renew button
│
└─ If Not Found:
   ├─ Calculate trial days: TRIAL_DAYS - (today - user.created_at)
   ├─ If > 0 → Show trial banner with X days remaining
   └─ If ≤ 0 → Show "Free Trial Expired" + plan selection
```

## Testing Checklist

### Test Case 1: Valid Active Subscription
**Setup:** User with active subscription, `current_period_end` is in future
**Expected:** 
- [ ] Dashboard loads immediately
- [ ] No trial banner
- [ ] No expiry message

### Test Case 2: Expired Subscription  
**Setup:** User with subscription, `current_period_end` is in past
**Expected:**
- [ ] Redirects to modal showing "Subscription Expired"
- [ ] Shows the subscription end date
- [ ] "Renew Subscription" button appears
- [ ] "Switch Account" button appears

### Test Case 3: First Time Login (Day 1 of Trial)
**Setup:** New user, no subscription
**Expected:**
- [ ] Dashboard shows trial banner
- [ ] Banner shows "🚀 Free trial: 10 days remaining"
- [ ] "Upgrade now" link in banner

### Test Case 4: Trial Expired (Day 11+)
**Setup:** User 11+ days old, no subscription
**Expected:**
- [ ] Redirects to modal showing "Free Trial Expired"
- [ ] "Choose a Plan" button appears
- [ ] "Switch Account" button appears

### Test Case 5: Trial Within Period (Day 5)
**Setup:** User 5 days old, no subscription
**Expected:**
- [ ] Dashboard shows trial banner
- [ ] Banner shows "🚀 Free trial: 5 days remaining"

## Development/Testing Commands

### Simulate Trial Expiry (Dev Only)
```bash
# Set trial_expired_at in user metadata to simulate expired trial
curl -X POST http://localhost:3000/api/dev/expire-trial \
  -H "Content-Type: application/json"
```

### Restore Trial (Dev Only)
```bash
# Remove trial_expired_at override
curl -X POST http://localhost:3000/api/dev/restore-trial \
  -H "Content-Type: application/json"
```

### Debug Subscription Flow
```bash
# Check all businesses and subscriptions
npx ts-node debug_subscription_flow.ts
```

## Database Queries for Verification

### Check User's Subscription Status
```sql
SELECT 
  s.id,
  s.business_id,
  s.status,
  s.current_period_end,
  s.stripe_subscription_id,
  CASE 
    WHEN s.current_period_end::timestamp > now() THEN 'VALID'
    ELSE 'EXPIRED'
  END as validity
FROM "Subscriptions" s
WHERE s.business_id = 'YOUR_BUSINESS_ID'
ORDER BY s.created_at DESC
LIMIT 1;
```

### Check Trial Status
```sql
SELECT 
  u.user_id,
  u.email,
  u.created_at,
  u.role,
  (u.user_metadata->>'trial_expired_at')::timestamp as trial_override,
  CASE 
    WHEN EXTRACT(DAY FROM (now() - u.created_at)) < 10 THEN 'IN_TRIAL'
    ELSE 'TRIAL_EXPIRED'
  END as trial_status
FROM auth.users u
WHERE u.created_at > now() - INTERVAL '15 days'
ORDER BY u.created_at DESC;
```

## Troubleshooting

### Issue: Users still see "10 days expired" with valid subscription
**Check:**
1. ✓ Subscription record exists in `Subscriptions` table
2. ✓ `stripe_subscription_id` is NOT NULL
3. ✓ `status` is 'active' or 'trialing'
4. ✓ `current_period_end` date is in the future
5. ✓ Browser cache cleared (hard refresh)

### Issue: Valid trial users see "Trial Expired"
**Check:**
1. ✓ User's `created_at` is within 10 days
2. ✓ No `trial_expired_at` in user metadata (unless dev testing)
3. ✓ System clock is correct

### Issue: Subscription shows "EXPIRED" but should be active
**Check:**
1. ✓ Stripe webhook was received and processed
2. ✓ `current_period_end` timestamp is correctly converted (in UTC)
3. ✓ No timezone issues in the database

## Related Files
- **SubscriptionGuard Component:** [app/owner/SubscriptionGuard.tsx](app/owner/SubscriptionGuard.tsx)
- **Pricing Page:** [app/pricing/page.tsx](app/pricing/page.tsx)
- **Stripe Webhook:** [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts)
- **Billing Details API:** [app/api/stripe/billing-details/route.ts](app/api/stripe/billing-details/route.ts)
- **Database Types:** [types/database.ts](types/database.ts)

## Notes for Production
- ✓ No breaking changes to existing subscriptions
- ✓ Backward compatible with current database schema
- ✓ Clear error messages for users
- ✓ Supports account switching
- ✓ Renewal flow preserved
