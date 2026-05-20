-- ============================================================
-- Deputy MVP — Performance Indexes
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. AttendanceLog: Most critical — queried on EVERY clock-in/out
--    Used in: GET /api/attendance, kiosk route, timesheet engine
CREATE INDEX IF NOT EXISTS idx_attendance_log_employee_timestamp
  ON "AttendanceLog"(employee_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_log_business_timestamp
  ON "AttendanceLog"(business_id, timestamp DESC);

-- 2. Notifications: Queried on every page load (notification bell unread count)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_business_created
  ON notifications(business_id, created_at DESC);

-- 3. Shifts: Queried by roster + date on every roster/timesheet view
CREATE INDEX IF NOT EXISTS idx_shift_roster_date
  ON "Shift"(roster_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_shift_business_date
  ON "Shift"(business_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_shift_employee_date
  ON "Shift"(employee_id, shift_date);

-- 4. TimeSheet: Queried by business + date range on every timesheet view
CREATE INDEX IF NOT EXISTS idx_timesheet_business_date
  ON "TimeSheet"(business_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_timesheet_employee_date
  ON "TimeSheet"(employee_id, date DESC);

-- 5. LeaveRequest: Queried by employee + date range in timesheet engine
CREATE INDEX IF NOT EXISTS idx_leave_employee_dates
  ON "LeaveRequest"(employee_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_leave_business_status
  ON "LeaveRequest"(business_id, status);

-- 6. Employee: Queried on every auth check and kiosk lookup
CREATE INDEX IF NOT EXISTS idx_employee_user_id
  ON "Employee"(user_id);

CREATE INDEX IF NOT EXISTS idx_employee_business_status
  ON "Employee"(business_id, status);

-- 7. User: Queried on every auth check
CREATE INDEX IF NOT EXISTS idx_user_business_role
  ON "User"(business_id, role);

-- 8. UserNotificationPreference: Queried on every notification dispatch
CREATE INDEX IF NOT EXISTS idx_notif_pref_user_type
  ON "UserNotificationPreference"(user_id, type);

-- 9. PublicHoliday: Queried in timesheet engine
CREATE INDEX IF NOT EXISTS idx_public_holiday_business_date
  ON "PublicHoliday"(business_id, date);

-- 10. Roster: Queried by business
CREATE INDEX IF NOT EXISTS idx_roster_business_dates
  ON "Roster"(business_id, start_date, end_date);

-- ============================================================
-- Verify indexes were created:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
-- ============================================================
