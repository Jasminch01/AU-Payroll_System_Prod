import { getBusinessTimezone } from '../lib/auth';
import { getDateInTimezone, getTimeInTimezone } from '../lib/timezone-utils';

interface MockShift {
  shift_id: string;
  shift_status: 'draft' | 'published';
  start_time: string; // 'YYYY-MM-DDTHH:mm:ss'
  end_time: string; // 'YYYY-MM-DDTHH:mm:ss'
  business_id: string;
}

// Emulate POST/PUT/DELETE checks
function checkPostPutDelete(shift: MockShift, nowBusinessTimestamp: string) {
  if (nowBusinessTimestamp > shift.end_time) {
    return { allowed: false, error: 'Cannot modify checklist after the shift has completed.' };
  }

  if (shift.shift_status === 'published' && nowBusinessTimestamp >= shift.start_time) {
    return { allowed: false, error: 'Cannot modify checklist tasks on a published shift once it has started.' };
  }

  return { allowed: true };
}

// Emulate PATCH checks
function checkPatch(shift: MockShift, nowBusinessTimestamp: string, body: any) {
  if (nowBusinessTimestamp > shift.end_time) {
    return { allowed: false, error: 'Cannot update checklist tasks after the shift has completed.' };
  }

  if (shift.shift_status === 'published' && nowBusinessTimestamp >= shift.start_time) {
    if (
      body.task_text !== undefined ||
      body.instructions !== undefined ||
      body.is_required !== undefined ||
      body.sort_order !== undefined
    ) {
      return { allowed: false, error: 'Cannot edit task details on a published shift once it has started. Only status updates are allowed.' };
    }
  }

  return { allowed: true };
}

async function test() {
  console.log('--- RUNNING RESTRICTIONS LOGIC VERIFICATION ---');

  // Let's assume now in business local time is: 2026-06-13T12:00:00
  const now = '2026-06-13T12:00:00';
  console.log(`Current Time (Local): ${now}\n`);

  const scenarios: { name: string; shift: MockShift; body?: any; method: 'POST' | 'PATCH' }[] = [
    {
      name: '1. POST: Upcoming Draft Shift (starts 13:00, ends 18:00)',
      method: 'POST',
      shift: {
        shift_id: '1',
        shift_status: 'draft',
        start_time: '2026-06-13T13:00:00',
        end_time: '2026-06-13T18:00:00',
        business_id: 'biz1'
      }
    },
    {
      name: '2. POST: Completed Draft Shift (ended at 11:00)',
      method: 'POST',
      shift: {
        shift_id: '2',
        shift_status: 'draft',
        start_time: '2026-06-13T08:00:00',
        end_time: '2026-06-13T11:00:00',
        business_id: 'biz1'
      }
    },
    {
      name: '3. POST: Upcoming Published Shift (starts 13:00, ends 18:00)',
      method: 'POST',
      shift: {
        shift_id: '3',
        shift_status: 'published',
        start_time: '2026-06-13T13:00:00',
        end_time: '2026-06-13T18:00:00',
        business_id: 'biz1'
      }
    },
    {
      name: '4. POST: Ongoing Published Shift (starts 11:00, ends 18:00)',
      method: 'POST',
      shift: {
        shift_id: '4',
        shift_status: 'published',
        start_time: '2026-06-13T11:00:00',
        end_time: '2026-06-13T18:00:00',
        business_id: 'biz1'
      }
    },
    {
      name: '5. PATCH: Ongoing Published Shift (updating status/reason only)',
      method: 'PATCH',
      shift: {
        shift_id: '5',
        shift_status: 'published',
        start_time: '2026-06-13T11:00:00',
        end_time: '2026-06-13T18:00:00',
        business_id: 'biz1'
      },
      body: { status: 'completed', reason: 'Done' }
    },
    {
      name: '6. PATCH: Ongoing Published Shift (updating task text - structural)',
      method: 'PATCH',
      shift: {
        shift_id: '6',
        shift_status: 'published',
        start_time: '2026-06-13T11:00:00',
        end_time: '2026-06-13T18:00:00',
        business_id: 'biz1'
      },
      body: { task_text: 'New task name' }
    },
    {
      name: '7. PATCH: Completed Published Shift (updating status)',
      method: 'PATCH',
      shift: {
        shift_id: '7',
        shift_status: 'published',
        start_time: '2026-06-13T08:00:00',
        end_time: '2026-06-13T11:00:00',
        business_id: 'biz1'
      },
      body: { status: 'completed' }
    }
  ];

  for (const tc of scenarios) {
    let result;
    if (tc.method === 'POST') {
      result = checkPostPutDelete(tc.shift, now);
    } else {
      result = checkPatch(tc.shift, now, tc.body);
    }
    console.log(`Scenario: ${tc.name}`);
    console.log(`Result: ${result.allowed ? '✅ ALLOWED' : '❌ BLOCKED - ' + result.error}`);
    console.log('----------------------------------------------------');
  }
}

test();
