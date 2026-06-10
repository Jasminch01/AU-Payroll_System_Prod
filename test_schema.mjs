const supabaseUrl = 'https://hihvehilmlloienmnxqh.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpaHZlaGlsbWxsb2llbm1ueHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODIyOTEsImV4cCI6MjA4NTk1ODI5MX0.r37h-5WG1EmcL1I89LOCIgBRjUnWoqO2cwXJ1TF8m3o';

async function check() {
    const res = await fetch(`${supabaseUrl}/rest/v1/Business?select=*&limit=1`, {
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
        }
    });
    
    if (!res.ok) {
        console.error("Failed to fetch Business:", await res.text());
    } else {
        const data = await res.json();
        console.log("Business columns:", Object.keys(data[0] || {}));
    }

    const res2 = await fetch(`${supabaseUrl}/rest/v1/Subscriptions?select=*&limit=1`, {
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
        }
    });
    
    if (!res2.ok) {
        console.error("Failed to fetch Subscriptions:", await res2.text());
    } else {
        const data2 = await res2.json();
        console.log("Subscriptions columns:", Object.keys(data2[0] || {}));
    }
}

check();
