// ============================================
// Australia Payroll System — Database TypeScript Types
// Matches Supabase PostgreSQL schema exactly
// ============================================

// ==================== ENUMS ====================

export type EmployeeType = 'full_time' | 'part_time' | 'casual';

export type PayCycle = 'weekly' | 'fortnightly' | 'monthly';

export type EmployeeStatus = 'active' | 'inactive' | 'invited';

export type CertificateType = 'RSA' | 'food_safety' | 'first_aid' | 'other';

export type RosterStatus = 'draft' | 'published';

export type ShiftType = 'morning' | 'afternoon' | 'evening';

export type EventType = 'CLOCK_IN' | 'CLOCK_OUT';
export type TimesheetStatus = 'pending' | 'approved' | 'rejected';

export type RateType = 'weekday' | 'saturday' | 'sunday' | 'public_holiday' | 'evening';

export type PayrollStatus = 'draft' | 'approved' | 'paid';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type UserRole = 'owner' | 'manager';

export type SwapStatus = 'pending_acceptance' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export type XeroSyncStatus = 'pending' | 'synced' | 'failed';

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
  bank_account_name: string | null;
  bank_bsb: string | null;
  bank_account_number: string | null;
  "ABN/TFN/ACN": string | null;
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

export type ShiftStatus = 'draft' | 'published';

export interface Shift {
  shift_id: string;
  roster_id: string | null;
  employee_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: ShiftType;
  shift_status: ShiftStatus;
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
  approved_by: string | null;
  gross_pay: number;
  status: TimesheetStatus | null;
  approved_at: string | null;
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
  hours_breakdown: any | null;
  payment_date: string | null;
  created_at: string;
  payment_status: PaymentStatus | null;
  payroll_id: string;
  updated_at: string | null;
}

export interface AuditLog {
  audit_id: string;
  business_id: string;
  table_name: string;
  record_id: string;
  action: AuditAction | null;
  changed_by: string | null;
  changed_at: string;
  before_value: any | null;
  after_value: any | null;
  reason: string | null;
  created_at: string;
}

export interface SalesData {
  Sales_id: string;
  business_id: string;
  sales_date: string;
  total_sales: number;
  cogs: number;
  gross_profit: number | null;
  top_skus: any | null;
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

export interface LeaveType {
  leave_type_id: string;
  business_id: string;
  name: string;
  is_paid: boolean;
  accrual_rate: number | null;
  max_carry_over: number | null;
  requires_doc: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface LeaveBalance {
  balance_id: string;
  employee_id: string;
  leave_type_id: string;
  business_id: string;
  accrued_hours: number;
  taken_hours: number;
  pending_hours: number;
  year: number;
  last_accrual_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface LeaveRequest {
  request_id: string;
  employee_id: string;
  leave_type_id: string;
  business_id: string;
  start_date: string;
  end_date: string;
  total_hours: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PublicHoliday {
  holiday_id: string;
  business_id: string;
  name: string;
  date: string;
  state: string;
  is_national: boolean;
  year: number;
  source: string | null;
  created_at: string;
}

export interface XeroConfig {
  config_id: string;
  business_id: string;
  tenant_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
}


export interface XeroSync {
  sync_id: string;
  business_id: string;
  payroll_id: string;
  status: XeroSyncStatus;
  xero_invoice_id: string | null;
  error_message: string | null;
  synced_at: string | null;
  created_at: string;
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

export type PayrollInsert = Omit<Payroll, 'payroll_id' | 'created_at' | 'updated_at'> & {
  payroll_id?: string;
  updated_at?: string;
};

export type PayrollLineInsert = Omit<PayrollLine, 'PayrollLine_id' | 'created_at' | 'updated_at'> & {
  PayrollLine_id?: string;
  updated_at?: string;
};

export type SalesDataInsert = Omit<SalesData, 'Sales_id' | 'created_at'> & {
  Sales_id?: string;
};

export type ShiftSwapRequestInsert = Omit<ShiftSwapRequest, 'request_id' | 'created_at' | 'updated_at'> & {
  request_id?: string;
};

export type LeaveTypeInsert = Omit<LeaveType, 'leave_type_id' | 'created_at' | 'updated_at'> & {
  leave_type_id?: string;
};

export type LeaveBalanceInsert = Omit<LeaveBalance, 'balance_id' | 'created_at' | 'updated_at'> & {
  balance_id?: string;
};

export type LeaveRequestInsert = Omit<LeaveRequest, 'request_id' | 'created_at' | 'updated_at'> & {
  request_id?: string;
};

export type PublicHolidayInsert = Omit<PublicHoliday, 'holiday_id' | 'created_at'> & {
  holiday_id?: string;
};

export type XeroConfigInsert = Omit<XeroConfig, 'config_id' | 'created_at' | 'updated_at'> & {
  config_id?: string;
};


export type XeroSyncInsert = Omit<XeroSync, 'sync_id' | 'created_at'> & {
  sync_id?: string;
};

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
