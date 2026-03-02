// ============================================
// Deputy-MVP — Database TypeScript Types
// Matches Supabase PostgreSQL schema exactly
// ============================================

// ==================== ENUMS ====================

export type EmployeeType = 'full_time' | 'part_time' | 'casual';

export type PayCycle = 'weekly' | 'fortnightly' | 'monthly';

export type EmployeeStatus = 'active' | 'inactive';

export type CertificateType = 'RSA' | 'food_safety' | 'first_aid' | 'other';

export type RosterStatus = 'draft' | 'published';

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'split';

export type EventType = 'CLOCK_IN' | 'CLOCK_OUT';
export type TimesheetStatus = 'pending' | 'approved' | 'rejected';

export type RateType = 'weekday' | 'saturday' | 'sunday' | 'public_holiday' | 'evening';

export type PayrollStatus = 'draft' | 'approved' | 'paid';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type UserRole = 'owner' | 'manager';

export type SwapStatus = 'pending_acceptance' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | 'expired';

// ==================== TABLE TYPES ====================

export interface Business {
  business_id: string;
  business_name: string;
  abn: string;
  state: string;
  labour_threshold_min: number;
  labour_theshold_max: number;
  created_at: string;
  updated_at: string | null;
}

export interface User {
  user_id: string;
  business_id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string;
  dob: string;
  bank_details: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  employment_type: EmployeeType | null;
  role_title: string;
  pay_cycle: PayCycle | null;
  kiosk_pin: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string | null;
  business_id: string;
  user_id: string;
  status: EmployeeStatus;
}

export interface EmployeeRateHistory {
  rate_history_id: string;
  weekday_rate: number;
  saturday_multiplier: number;
  sunday_multiplier: number;
  public_holiday_multiplier: number | null;
  evening_rate: number | null;
  evening_start_time: number | null;
  evening_end_time: number | null;
  effective_from: string;
  effective_to: string | null;
  created_bv: string | null;
  created_at: string;
  employee_id: string;
  business_id: string;
}

export interface Certificate {
  certificate_id: string;
  employee_id: string;
  certificate_type: CertificateType | null;
  file_url: string;
  issue_date: string;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Roster {
  roster_id: string;
  business_id: string;
  start_date: string;
  end_date: string;
  status: RosterStatus;
  created_by: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  shift_id: string;
  roster_id: string | null;
  employee_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: ShiftType;
  created_at: string;
  updated_at: string;
  business_id: string;
}

export interface AttendanceLog {
  log_id: string;
  business_id: string;
  employee_id: string | null;
  event_type: EventType;
  device_info: string | null;
  override_by: string | null;
  override_reason: string | null;
  created_at: string;
  timestamp: string;
}

export interface TimeSheet {
  timesheet_id: string;
  created_at: string;
  employee_id: string;
  business_id: string;
  aproved_by: string | null;
  gross_pay: number;
  status: TimesheetStatus | null;
  approve_at: string | null;
  flags: string | null;
  notes: string | null;
  updated_at: string | null;
  rate_type: RateType | null;
  roster_start: string | null;
  roster_end: string | null;
  rostered_hours: number | null;
  actual_start: string | null;
  actual_end: string | null;
  actual_hours: number | null;
  hourly_rate: number;
  date: string;
}

export interface Payroll {
  payroll_id: string;
  created_at: string;
  business_id: string;
  period_start: string;
  period_end: string;
  total_gross: number;
  total_net: number;
  approved_by: string | null;
  approved_at: string | null;
  updated_at: string;
  status: PayrollStatus;
}

export interface PayrollLine {
  PayrollLine_id: string;
  employee_id: string | null;
  gross_wages: number;
  additions: number;
  deductions: number;
  net_pay: number | null;
  hours_breakdown: Record<string, unknown> | null;
  payment_date: string | null;
  created_at: string;
  payment_status: PaymentStatus | null;
  payroll_id: string;
}

export interface AuditLog {
  audit_id: string;
  business_id: string;
  table_name: string;
  record_id: string;
  action: AuditAction | null;
  changed_by: string | null;
  changed_at: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  resone: string | null;
  created_at: string;
}

export interface SalesData {
  Sales_id: string;
  buniness_id: string;
  sales_date: string;
  total_sales: number;
  cogs: number;
  gross_profit: number | null;
  top_skus: Record<string, unknown> | null;
  created_at: string;
}

export interface ShiftSwapRequest {
  request_id: string;
  business_id: string;
  requester_id: string;
  shift_id: string;
  target_employee_id: string | null;
  target_shift_id: string | null;
  status: SwapStatus;
  manager_id: string | null;
  manager_note: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== INSERT TYPES (for creating new records) ====================

export type BusinessInsert = Omit<Business, 'business_id' | 'created_at' | 'updated_at'> & {
  business_id?: string;
};

export type UserInsert = Omit<User, 'created_at' | 'updated_at'>;

export type EmployeeInsert = Omit<Employee, 'created_at' | 'updated_at'> & {
  status?: EmployeeStatus;
};

export type EmployeeRateHistoryInsert = Omit<EmployeeRateHistory, 'rate_history_id' | 'created_at'> & {
  rate_history_id?: string;
  saturday_multiplier?: number;
  sunday_multiplier?: number;
  public_holiday_multiplier?: number;
};

export type RosterInsert = Omit<Roster, 'roster_id' | 'created_at' | 'updated_at' | 'published_at'> & {
  roster_id?: string;
};

export type ShiftInsert = Omit<Shift, 'shift_id' | 'created_at' | 'updated_at'> & {
  shift_id?: string;
};

export type AttendanceLogInsert = Omit<AttendanceLog, 'log_id' | 'created_at'> & {
  log_id?: string;
};

export type TimeSheetInsert = Omit<TimeSheet, 'timesheet_id' | 'created_at' | 'updated_at'> & {
  timesheet_id?: string;
};

export type PayrollInsert = Omit<Payroll, 'created_at' | 'updated_at'>;

export type PayrollLineInsert = Omit<PayrollLine, 'PayrollLine_id' | 'created_at'> & {
  PayrollLine_id?: string;
};

export type SalesDataInsert = Omit<SalesData, 'Sales_id' | 'created_at'> & {
  Sales_id?: string;
};

export type ShiftSwapRequestInsert = Omit<ShiftSwapRequest, 'request_id' | 'created_at' | 'updated_at'> & {
  request_id?: string;
};

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
