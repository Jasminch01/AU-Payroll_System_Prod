const BASE_URL = 'http://localhost:3000/api';
let cookie = '';

async function request(endpoint, method = 'GET', body) {
    const headers = {};
    if (cookie) headers['cookie'] = cookie;
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        const sessionCookie = setCookie.split(';')[0];
        cookie = `${cookie ? cookie + '; ' : ''}${sessionCookie}`;
    }

    const data = await response.json();
    return { status: response.status, data };
}

async function runTests() {
    console.log('--- Testing Shift Constraints (Update/Delete) ---');

    const testSuffix = Math.floor(Math.random() * 100000);
    const ownerEmail = `owner_test_${testSuffix}@test.com`;
    
    // 1. Register/Login as Owner
    await request('/auth/register', 'POST', {
        email: ownerEmail,
        password: 'password123',
        first_name: 'Test',
        last_name: 'Owner',
        business_name: `Test Business ${testSuffix}`,
        abn: '12345678901',
        state: 'NSW'
    });
    console.log('✅ Registered owner');

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // 2. Create a FUTURE shift (1 hour from now)
    const futureStart = new Date(today.getTime() + 60 * 60 * 1000);
    const futureEnd = new Date(today.getTime() + 2 * 60 * 60 * 1000);

    const futureShiftRes = await request('/shift', 'POST', {
        shift_date: dateStr,
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        shift_type: 'morning'
    });
    
    if (!futureShiftRes.data.success) {
        console.error('❌ Failed to create future shift:', futureShiftRes.data);
        return;
    }

    const futureShiftId = futureShiftRes.data.data.shift_id;
    console.log(`✅ Created future shift: ${futureShiftId}`);

    // Test: Update future shift
    const updateFutureRes = await request(`/shift/${futureShiftId}`, 'PUT', { shift_type: 'afternoon' });
    if (updateFutureRes.status === 200) {
        console.log('✅ Successfully updated future shift');
    } else {
        console.error('❌ Failed to update future shift:', updateFutureRes.data);
    }

    // Test: Delete future shift
    const deleteFutureRes = await request(`/shift/${futureShiftId}`, 'DELETE');
    if (deleteFutureRes.status === 200) {
        console.log('✅ Successfully deleted future shift');
    } else {
        console.error('❌ Failed to delete future shift:', deleteFutureRes.data);
    }

    // 3. Create a PAST shift (Started 1 minute ago, ends in 59 minutes)
    // Using a slightly more aggressive past shift to ensure it's "before" now when it hits the server
    const pastStart = new Date(today.getTime() - 60 * 1000); 
    const pastEnd = new Date(today.getTime() + 59 * 60 * 1000);

    const pastShiftRes = await request('/shift', 'POST', {
        shift_date: dateStr,
        start_time: pastStart.toISOString(),
        end_time: pastEnd.toISOString(),
        shift_type: 'morning'
    });
    
    if (!pastShiftRes.data.success) {
        console.error('❌ Failed to create past shift:', pastShiftRes.data);
        return;
    }

    const pastShiftId = pastShiftRes.data.data.shift_id;
    console.log(`✅ Created shift that started 1m ago: ${pastShiftId}`);

    // Test: Update past shift (Should FAIL)
    const updatePastRes = await request(`/shift/${pastShiftId}`, 'PUT', { shift_type: 'afternoon' });
    if (updatePastRes.status === 400 && updatePastRes.data.error.includes('already started')) {
        console.log('✅ Correctly blocked update of started shift');
    } else {
        console.error('❌ Update check failed! Status:', updatePastRes.status, 'Data:', updatePastRes.data);
    }

    // Test: Delete past shift (Should FAIL)
    const deletePastRes = await request(`/shift/${pastShiftId}`, 'DELETE');
    if (deletePastRes.status === 400 && deletePastRes.data.error.includes('already started')) {
        console.log('✅ Correctly blocked deletion of started shift');
    } else {
        console.error('❌ Delete check failed! Status:', deletePastRes.status, 'Data:', deletePastRes.data);
    }

    console.log('\n--- Tests Finished ---');
}

runTests().catch(console.error);
