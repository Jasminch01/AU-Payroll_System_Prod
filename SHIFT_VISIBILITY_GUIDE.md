# Employee Shift Visibility Troubleshooting

## Issue: Employee Cannot See 1-Week Shift

### Root Causes & Solutions:

#### ✅ Solution 1: Publish the Roster (REQUIRED)

**Where:**
- Manager → Roster Page
- Look for the **"Publish X Shift(s)"** button

**What it does:**
- Marks the roster as published in the database (`published_at` timestamp)
- Marks all shifts in that roster as 'published'
- **Employees CAN NOW SEE the shifts**

**Steps:**
1. Navigate to **Manager → Roster**
2. Scroll to the roster containing the shifts
3. Look for orange/red button: **"Publish X Shift(s)"**
4. Click the button
5. Employee should now see all shifts

---

#### ✅ Solution 2: Create Shifts with "Notify" (OPTIONAL)

**Alternative Method:**
When creating a shift, click **"Save & Notify"** instead of just "Save Draft"

**Effect:**
- Shift is immediately published (doesn't need separate publish step)
- Employee gets notification
- Shift appears instantly for employee

---

### Verification Checklist:

**In Manager App:**
- [ ] Roster exists for the week
- [ ] Shifts are assigned to the employee
- [ ] Number shows in "Published" vs "Draft" sections
- [ ] "Publish X Shift(s)" button clicked?
- [ ] Roster status shows "Published" (not "Draft")

**In Employee App:**
- [ ] Employee is logged in
- [ ] Employee goes to **Shifts** page
- [ ] Shift date falls within the published roster period
- [ ] View shows shifts in list format

---

### Code Changes Made:

✅ **Shifts now default to PUBLISHED** (previously required "Notify" button)
- File: `/api/shift/route.ts` line 212

✅ **Updated documentation** for shift visibility requirements
- File: `/api/shifts/me/route.ts` docstring

---

### API Query Logic:

Employees can only see shifts where:
```
roster.published_at IS NOT NULL
AND
shift.shift_status = 'published'
```

Both conditions MUST be true.
