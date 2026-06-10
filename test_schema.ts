import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
const envVars: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
});

const supabase = createClient(
    envVars['NEXT_PUBLIC_SUPABASE_URL'],
    envVars['SUPABASE_SERVICE_ROLE_KEY']
);

async function checkSchema() {
    const { data: businessData, error: businessError } = await supabase
        .from('Business')
        .select('*')
        .limit(1);

    console.log('Business Error:', businessError);
    if (businessData && businessData.length > 0) {
        console.log('Business Columns:', Object.keys(businessData[0]));
    } else {
        console.log('Business Data:', businessData);
    }

    const { data: userData, error: userError } = await supabase
        .from('User')
        .select('*')
        .limit(1);

    console.log('User Error:', userError);
    if (userData && userData.length > 0) {
        console.log('User Columns:', Object.keys(userData[0]));
    }
}

checkSchema();
