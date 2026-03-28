# Australia Payroll System Backend API Documentation

This document covers all currently implemented REST API endpoints for the Australia Payroll System platform, extracted directly from the codebase.

## `GET` /api/analytics/labour-vs-revenue

```text
Calculate labour cost % against total salesAccess: OwnerQuery params: from, to (YYYY-MM-DD)
```

---

## `GET` /api/analytics/summary

```text
Get dashboard summary statsAccess: Owner, Manager
```

---

## `GET` /api/attendance

```text
List attendance logs for the businessAccess: Owner, Manager
```

---

## `POST` /api/attendance

```text
Manual entry/Correction by ManagerAccess: Owner, ManagerBody:{  "employee_id": "uuid",  "event_type": "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END",  "timestamp": "ISO_STRING",  "coordinates": { "lat": 0, "lng": 0 } (optional)}
```

---

## `POST` /api/attendance/kiosk

```text
Handle clock in/out from a common device (Kiosk)Access: Restricted (Kiosk Device Token Required)Body:{  "employee_id": "EMP001",  "event_type": "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END",  "device_info": "Front Desk Tablet" (optional)}
```

---

## `GET` /api/attendance/me

```text
Get today's logs for the authenticated employeeAccess: Employee, Manager, Owner
```

---

## `GET` /api/audit-log

```text
List audit entries with filtersAccess: OwnerQuery params: table_name, record_id, action, changed_by, from, to
```

---

## `POST` /api/auth/login

```text
Login for Owner, Manager, or EmployeeAccess: PublicBody:{  "email": "user@example.com",  "password": "password123"}
```

---

## `POST` /api/auth/logout

```text
Sign out the current userAccess: Authenticated
```

---

## `GET` /api/auth/me

```text
Get current authenticated user's profile and roleAccess: Authenticated
```

---

## `POST` /api/auth/register

```text
Register a new Owner + BusinessAccess: PublicBody:{  "email": "owner@example.com",  "password": "securepassword",  "first_name": "John",  "last_name": "Doe",  "business_name": "My Restaurant",  "abn": "12345678901",  "state": "NSW"}
```

---

## `GET` /api/cron/generate-timesheets

```text
Scheduled task to automatically generate timesheets for "Yesterday"Access: System/Cron (CRON_SECRET)
```

---

## `GET` /api/cron/sync-holidays

```text
Fetches AU Public Holidays for the current and next year and syncs them to our DBAccess: System/Cron (CRON_SECRET)
```

---

## `GET` /api/employees

```text
List all employees for the businessAccess: Owner, Manager
```

---

## `POST` /api/employees

```text
Create a new employee and auth accountAccess: Owner, ManagerBody:{  "email": "employee@example.com",  "password": "securepassword",  "first_name": "Mike",  "last_name": "Johnson",  "phone": "0412345678",  "dob": "1995-06-15",  "bank_account_name": "Mike Johnson",
  "bank_bsb": "062000",
  "bank_account_number": "12345678",  "emergency_contact_name": "Sarah Johnson",  "emergency_contact_phone": "0498765432",  "employment_type": "full_time",  "role_title": "Barista",  "pay_cycle": "fortnightly",  "start_date": "2026-03-01",  "employee_id": "EMP001",  "weekday_rate": 28.50,  "opening_balances": { "LT_ID": 10.5 } (optional)}
```

---

## `GET` /api/employees/[id]

```text
Get a specific employee by employee_idAccess: Owner, Manager
```

---

## `PUT` /api/employees/[id]

```text
Update an employee's detailsAccess: Owner, ManagerBody:{  "first_name": "Mike",  "last_name": "Johnson",  "phone": "0412345678",  "email": "newemail@example.com",  "bank_account_name": "Mike Johnson",
  "bank_bsb": "062000",
  "bank_account_number": "87654321",  "emergency_contact_name": "New Contact",  "emergency_contact_phone": "0411111111",  "employment_type": "part_time",  "role_title": "Senior Barista",  "pay_cycle": "weekly",  "end_date": "2026-12-31",  "status": "active"}
```

---

## `DELETE` /api/employees/[id]

```text
Deactivate an employee (soft delete)Access: Owner, ManagerQuery params:  ?hard=true (permanent delete)
```

---

## `GET` /api/employees/[id]/rates

```text
Get pay rate history for an employeeAccess: Owner
```

---

## `POST` /api/employees/[id]/rates

```text
Add a new pay rate for an employee (effective from a date)Access: OwnerBody:{  "weekday_rate": 30.00,  "effective_from": "2026-04-01",  "saturday_multiplier": 1.25,  "sunday_multiplier": 1.50,  "public_holiday_multiplier": 2.50,  "evening_rate": 35.00,  "evening_start_time": 18,  "evening_end_time": 23}
```

---

## `POST` /api/employees/invite

```text
Send an invitation to a new employee or manager.Owner/Manager fills in minimal info; the invitee completes self-onboarding.Access: Owner, ManagerBody:{  "email": "newemployee@example.com",  "first_name": "Jane",  "last_name": "Doe",  "role_title": "Barista",  "employment_type": "casual",          // optional  "weekday_rate": 28.50,  "invite_as": "employee" | "manager"   // defaults to "employee"}
```

---

## `POST` /api/employees/resend-invite

```text
Resend the invitation email for a pending (invited) employee.Access: Owner, ManagerBody:{  "employee_id": "EMP-XXXXX"}
```

---

## `GET` /api/holidays

```text
List public holidays for the businessAccess: Authenticated
```

---

## `POST` /api/holidays

```text
Manually add a public holidayAccess: Owner, ManagerBody:{  "name": "Christmas Day",  "date": "2026-12-25",  "state": "NSW",  "is_national": true (optional, default false),  "source": "manual" (optional)}
```

---

## `GET` /api/leave

```text
List leave requestsAccess: Owner, Manager, Employee (own)
```

---

## `POST` /api/leave

```text
Create a new leave requestAccess: Owner, Manager, EmployeeBody:{  "leave_type_id": "uuid",  "start_date": "2026-12-01",  "end_date": "2026-12-05",  "total_hours": 38,  "reason": "Family trip",  "employee_id": "uuid" (optional, for admin use),  "document_url": "url" (optional)}
```

---

## `PUT` /api/leave/[id]

```text
Update leave status (Approve/Reject)Access: Owner, ManagerBody:{  "status": "approved" | "rejected" | "cancelled",  "rejection_reason": "string" (optional),  "manager_note": "string" (optional)}
```

---

## `DELETE` /api/leave/[id]

```text
Cancel a leave requestAccess: Owner, Manager, Employee (if pending)
```

---

## `GET` /api/leave/balances

```text
Get leave balancesAccess: Owner, Manager, Employee (own)
```

---

## `PATCH` /api/leave/balances/[id]

```text
Manually adjust a leave balanceAccess: Owner, ManagerBody:{  "accrued_hours": 40.5,  "taken_hours": 10,  "reason": "Adjustment" (optional)}
```

---

## `GET` /api/leave/types

```text
List leave types for the businessAccess: Authenticated
```

---

## `POST` /api/leave/types

```text
Create a new leave typeAccess: Owner, ManagerBody:{  "name": "Annual Leave",  "is_paid": true (optional, default true),  "accrual_rate": 0.0769 (optional),  "max_carry_over": 40 (optional),  "requires_doc": false (optional)}
```

---

## `GET` /api/managers

```text
List all managers for the businessAccess: Owner
```

---

## `POST` /api/managers

```text
Create/invite a new managerAccess: OwnerBody:{  "email": "manager@example.com",  "password": "tempPassword123",  "first_name": "Jane",  "last_name": "Smith",  "dob": "1990-01-15",  "bank_account_name": "Jane Smith",
  "bank_bsb": "062000",
  "bank_account_number": "12345678",  "emergency_contact_name": "John Smith",  "emergency_contact_phone": "0498765432",  "role_title": "Shift Manager",  "start_date": "2026-03-01",  "employee_id": "MGR001",  "weekday_rate": 35.00}
```

---

## `GET` /api/managers/[id]

```text
Get a specific manager profileAccess: Owner
```

---

## `PUT` /api/managers/[id]

```text
Update a manager's profileAccess: OwnerBody:{  "first_name": "Jane",  "last_name": "Smith",  "phone": "0412345678",  "status": "active",  ...}
```

---

## `DELETE` /api/managers/[id]

```text
Delete a manager profile and accountAccess: Owner
```

---

## `POST` /api/onboarding/complete

```text
Complete the self-onboarding process after accepting an invitation.The user must be authenticated (via the invite magic link which auto-signs them in).Access: Authenticated user with 'invited' employee statusBody:{  "password": "newsecurepassword",  "phone": "0412345678",  "dob": "1995-06-15",  "bank_account_name": "Mike Johnson",
  "bank_bsb": "062000",
  "bank_account_number": "12345678",  "emergency_contact_name": "Sarah Johnson",  "emergency_contact_phone": "0498765432"}
```

---

## `GET` /api/onboarding/status

```text
Check the onboarding status of the currently authenticated user.Used by the frontend to determine if the user needs to complete onboarding.Access: Authenticated userReturns:{  "needs_onboarding": true/false,  "employee": { employee details },  "business_name": "Acme Corp"}
```

---

## `GET` /api/payroll

```text
List payroll cyclesAccess: Owner, Manager
```

---

## `POST` /api/payroll

```text
Manually trigger payroll generationAccess: OwnerBody:{  "period_start": "2026-03-01",  "period_end": "2026-03-14"}
```

---

## `GET` /api/payroll/[id]

```text
Get payroll details and linesAccess: Owner, Manager
```

---

## `PUT` /api/payroll/[id]

```text
Approve or mark payroll as paidAccess: OwnerBody:{  "status": "approved" | "paid"}
```

---

## `DELETE` /api/payroll/[id]

```text
Rollback/Delete a payroll draftAccess: Owner
```

---

## `GET` /api/payroll/lines

```text
Get payroll lines filtered by employee_id and/or payroll_idAccess: Owner, ManagerQuery Params:  ?employee_id=uuid (required or optional depending on use)  ?payroll_id=uuid (optional, narrow to a specific payroll)  ?payment_status=pending|paid|failed (optional)
```

---

## `GET` /api/rosters

```text
List all rosters for the businessAccess: Owner, ManagerQuery params:  ?status=draft|published (optional)  ?from=YYYY-MM-DD (optional)  ?to=YYYY-MM-DD (optional)
```

---

## `POST` /api/rosters

```text
Create a new roster (week block)Access: Owner, ManagerBody:{  "start_date": "2026-03-03",  "end_date": "2026-03-09"}
```

---

## `GET` /api/rosters/[id]

```text
Get a specific roster with shiftsAccess: Owner, Manager
```

---

## `PUT` /api/rosters/[id]

```text
Update roster dates or publish itAccess: Owner, ManagerBody:{  "start_date": "2026-03-03",  "end_date": "2026-03-09",  "status": "published"}
```

---

## `DELETE` /api/rosters/[id]

```text
Delete a roster (draft only)Access: Owner, Manager
```

---

## `GET` /api/sales

```text
List sales dataAccess: OwnerQuery params: from, to (YYYY-MM-DD)
```

---

## `POST` /api/sales

```text
Record daily sales dataAccess: OwnerBody:{  "sales_date": "2026-03-04",  "total_sales": 1500.50,  "cogs": 450.00,  "top_skus": { "item1": 10, "item2": 5 }}
```

---

## `GET` /api/sales/[id]

```text
Get single sales recordAccess: Owner
```

---

## `PUT` /api/sales/[id]

```text
Update sales recordAccess: Owner
```

---

## `DELETE` /api/sales/[id]

```text
Delete sales recordAccess: Owner
```

---

## `GET` /api/shift

```text
List shifts based on filtersAccess: Owner, Manager
```

---

## `POST` /api/shift

```text
Create a new shiftAccess: Owner, ManagerBody:{  "employee_id": "uuid" (optional),  "roster_id": "uuid" (optional),  "shift_date": "2026-03-10",  "start_time": "ISO_TIMESTAMP",  "end_time": "ISO_TIMESTAMP",  "shift_type": "morning" | "afternoon" | etc}
```

---

## `GET` /api/shift/[id]

```text
Get a specific shiftAccess: Owner, Manager
```

---

## `PUT` /api/shift/[id]

```text
Update a shiftAccess: Owner, ManagerBody:{  "employee_id": "uuid",  "start_time": "ISO_TIMESTAMP",  "end_time": "ISO_TIMESTAMP",  "shift_type": "morning"}
```

---

## `DELETE` /api/shift/[id]

```text
Delete a shiftAccess: Owner, Manager
```

---

## `GET` /api/shifts/me

```text
Get assigned shifts for the authenticated employeeAccess: Employee, Manager, OwnerNote: Only returns shifts from PUBLISHED rosters.
```

---

## `GET` /api/shifts/swaps

```text
List swap requestsAccess: Owner, Manager, Employee (own)
```

---

## `POST` /api/shifts/swaps

```text
Initiate a shift swap or dropAccess: Employee, Manager, OwnerBody:{  "shift_id": "uuid",  "target_employee_id": "uuid" (optional, for direct swap/invite),  "target_shift_id": "uuid" (optional, for 1-for-1 swap)}
```

---

## `PUT` /api/shifts/swaps/[id]

```text
Handle multi-stage swap actionsAccess: Owner, Manager, Employee (involved)Body:{  "action": "accept" | "decline" | "approve" | "reject" | "cancel",  "manager_note": "string" (optional)}
```

---

## `GET` /api/timesheets

```text
List timesheets for the businessAccess: Owner, Manager (all timesheets), Employee (own only)Query Params:  ?status=pending|approved|rejected  ?employee_id=uuid (Owner/Manager only)  ?from=YYYY-MM-DD  ?to=YYYY-MM-DD
```

---

## `GET` /api/timesheets/[id]

```text
Get a single timesheet by IDAccess: Owner, Manager
```

---

## `PUT` /api/timesheets/[id]

```text
Approve, reject, or manually adjust a timesheetAccess: Owner, ManagerBody:{  "status": "approved" | "rejected" | "pending",  "actual_hours": number,  "gross_pay": number,  "notes": "string",  "flags": "string"}
```

---

## `GET` /api/timesheets/employee/[id]

```text
Get all timesheets for a specific employeeAccess: Owner, Manager, or the Employee themselves
```

---

## `POST` /api/timesheets/generate

```text
Manually trigger timesheet generationAccess: Owner, ManagerBody:{  "start_date": "2026-03-01",  "end_date": "2026-03-07",  "employee_id": "uuid" (optional)}
```

---

## `POST` /api/upload/avatar

```text
Upload a profile photoAccess: Any authenticated user (uploads for themselves)Form Data:  file: File (image only)
```

---

## `POST` /api/upload/certificate

```text
Upload a certificate file (RSA, Food Safety, First Aid, etc.)Access: Owner, Manager (for their employees), Employee (for themselves)Form Data:  file: File  employee_id: string  certificate_type: "RSA" | "food_safety" | "first_aid" | "other"  issue_date: "YYYY-MM-DD"  expiry_date: "YYYY-MM-DD" (optional)
```

---

## `POST` /api/upload/document

```text
Upload a leave request supporting document (medical certificate, etc.)Access: Any authenticated userForm Data:  file: File  leave_request_id: string (optional — can attach later)Returns: { url, path }
```

---

## `GET` /api/xero/auth

```text
Initiate Xero OAuth2 flowAccess: Owner
```

---

## `GET` /api/xero/callback

```text
Handle Xero OAuth2 callback and store tokens
```

---

## `GET` /api/xero/status

```text
Check if the business has a connected Xero accountAccess: Owner, Manager
```

---

## `POST` /api/xero/status

```text
POST /api/xero/disconnectDisconnect Xero for the businessAccess: Owner
```

---

## `POST` /api/xero/sync-employees

```text
Create/Update Xero contacts for all active employeesAccess: Owner
```

---

## `POST` /api/xero/sync-payroll

```text
Sync an approved payroll to Xero as invoices/billsAccess: OwnerBody:{  "payroll_id": "uuid-of-payroll"}
```

---

