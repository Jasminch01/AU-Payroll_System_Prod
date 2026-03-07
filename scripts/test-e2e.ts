import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
let cookie = '';

async function request(endpoint: string, method: string = 'GET', body?: any) {
    const headers: Record<string, string> = {};
    if (cookie) headers['cookie'] = cookie;
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        // Simple cookie extraction, might need refinement depending on how Supabase structures them
        const sessionCookie = setCookie.split(';')[0];
        cookie = `${cookie ? cookie + '; ' : ''}${sessionCookie}`;
    }

    const data = await response.json();
    return { status: response.status, data };
}

async function runTests() {
    console.log('--- Starting Australia Payroll System E2E API Tests ---\n');

    const testSuffix = Math.floor(Math.random() * 100000);
    const ownerEmail = `owner${testSuffix}@test.com`;
    const employeeEmail = `emp${testSuffix}@test.com`;
    let employeeId = '';
    let rosterId = '';
    let shiftId = '';
    let payrollId = '';
    let leaveTypeId = '';
    let leaveRequestId = '';

    // ============================================
    // 1. AUTH FLOW
    // ============================================
    console.log('[1] Testing Auth Flow');
    const registerParams = {
        email: ownerEmail,
        password: 'password123',
        first_name: 'Test',
        last_name: 'Owner',
        business_name: `Business ${testSuffix}`,
        abn: '12345678901',
        state: 'NSW'
    };

    const registerRes = await request('/auth/register', 'POST', registerParams);
    if (!registerRes.data.success) {
        console.error('Registration failed:', registerRes.data);
        return;
    }
    console.log('✅ Registered new owner');

    const meRes = await request('/auth/me');
    if (!meRes.data.success) {
        console.error('Session check failed:', meRes.data);
        return;
    }
    console.log('✅ Auth session confirmed');

    // ============================================
    // 2. EMPLOYEE FLOW
    // ============================================
    console.log('\n[2] Testing Employee Flow');
    const employeeParams = {
        email: employeeEmail,
        password: 'password123',
        first_name: 'Test',
        last_name: 'Employee',
        dob: '1990-01-01',
        bank_details: '062000 12345678',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '0400000000',
        phone: '0400111222',
        role_title: 'Server',
        kiosk_pin: '1234',
        start_date: new Date().toISOString().split('T')[0],
        employee_id: `EMP${testSuffix}`,
        weekday_rate: 25.0
    };

    const empRes = await request('/employees', 'POST', employeeParams);
    if (!empRes.data.success) {
        console.error('Employee creation failed:', empRes.data);
        return;
    }
    employeeId = empRes.data.data.employee.employee_id;
    console.log(`✅ Created new employee (${employeeId})`);

    // ============================================
    // 3. SCHEDULING FLOW
    // ============================================
    console.log('\n[3] Testing Scheduling Flow');
    const dateNow = new Date().toISOString().split('T')[0];
    const rosterRes = await request('/rosters', 'POST', {
        start_date: dateNow,
        end_date: dateNow
    });

    if (!rosterRes.data.success) {
        console.error('Roster creation failed:', rosterRes.data);
        return;
    }
    rosterId = rosterRes.data.data.roster_id;
    console.log(`✅ Created roster`);

    const shiftRes = await request('/shift', 'POST', {
        roster_id: rosterId,
        employee_id: employeeId,
        shift_date: dateNow,
        start_time: `${dateNow}T09:00:00Z`,
        end_time: `${dateNow}T17:00:00Z`,
        shift_type: 'morning'
    });

    if (!shiftRes.data.success) {
        console.error('Shift creation failed:', shiftRes.data);
        return;
    }
    shiftId = shiftRes.data.data.shift_id;
    console.log(`✅ Created shift`);

    const pubRes = await request(`/rosters/${rosterId}`, 'PUT', { status: 'published' });
    if (!pubRes.data.success) {
        console.error('Roster publish failed:', pubRes.data);
        return;
    }
    console.log('✅ Published roster');

    // ============================================
    // 4. LEAVE FLOW
    // ============================================
    console.log('\n[4] Testing Leave Flow');

    // First we need a leave type
    const ltRes = await request('/leave/types', 'POST', {
        name: 'Annual Leave',
        is_paid: true,
        accrual_rate: 0.0769,
        max_carry_over: 0,
        requires_doc: false
    });

    if (!ltRes.data.success) {
        console.error('Leave type creation failed:', ltRes.data);
        return;
    }
    leaveTypeId = ltRes.data.data.leave_type_id;
    console.log('✅ Created leave type');

    // Create leave request
    const lrRes = await request('/leave', 'POST', {
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        start_date: dateNow,
        end_date: dateNow,
        total_hours: 8,
        reason: 'Vacation'
    });

    if (!lrRes.data.success) {
        console.error('Leave request failed:', lrRes.data);
        return;
    }
    leaveRequestId = lrRes.data.data.request_id;
    console.log('✅ Created leave request');

    // Approve leave
    const laRes = await request(`/leave/${leaveRequestId}`, 'PUT', { status: 'approved' });
    if (!laRes.data.success) {
        console.error('Leave approval failed:', laRes.data);
        return;
    }
    console.log('✅ Approved leave request');

    // ============================================
    // 5. SALES & ANALYTICS
    // ============================================
    console.log('\n[5] Testing Sales & Analytics Flow');
    const salesRes = await request('/sales', 'POST', {
        sales_date: dateNow,
        total_sales: 1000.0,
        cogs: 300.0
    });

    if (!salesRes.data.success) {
        console.error('Sales recording failed:', salesRes.data);
        return;
    }
    console.log('✅ Recorded daily sales');

    const summaryRes = await request('/analytics/summary');
    if (!summaryRes.data.success) {
        console.error('Analytics summary failed:', summaryRes.data);
        return;
    }
    console.log('✅ Fetched analytics summary', summaryRes.data.data.stats);

    // ============================================
    // 6. AUDIT LOG
    // ============================================
    console.log('\n[6] Testing Audit Log');
    const auditRes = await request(`/audit-log?table_name=Employee&record_id=${employeeId}`);
    if (!auditRes.data.success) {
        console.error('Audit log fetch failed:', auditRes.data);
        return;
    }
    const auditLogFound = auditRes.data.data.length > 0;
    if (auditLogFound) {
        console.log(`✅ Found ${auditRes.data.data.length} audit log entries for employee`);
    } else {
        console.error('❌ Audit log for employee creation not found');
    }

    console.log('\n🎉 ALL E2E FLOWS COMPLETED SUCCESSFULLY');
}

runTests().catch(console.error);
