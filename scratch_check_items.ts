import { createAdminClient } from './lib/supabase/admin';

async function checkChecklists() {
    console.log('--- Checking Checklist Templates ---');
    const supabase = createAdminClient();

    const { data: templates, error: tError } = await supabase
        .from('ChecklistTemplate')
        .select('*');

    if (tError) {
        console.error('Error fetching templates:', tError);
    } else {
        console.log(`Found ${templates?.length} templates:`);
        templates?.forEach(t => {
            console.log(`- [${t.template_id}] Name: "${t.name}" | Category: "${t.category}" | Active: ${t.is_active}`);
        });
    }

    console.log('--- Checking Checklist Template Items ---');
    const { data: items, error: iError } = await supabase
        .from('ChecklistTemplateItem')
        .select('*');

    if (iError) {
        console.error('Error fetching items:', iError);
    } else {
        console.log(`Found ${items?.length} items:`);
        items?.forEach(i => {
            console.log(`  - [Template: ${i.template_id}] Item: "${i.task_text}" | Active: ${i.is_active} | Required: ${i.is_required}`);
        });
    }

    console.log('--- Checking Shift Checklist Mappings ---');
    const { data: mappings, error: mError } = await supabase
        .from('ShiftTypeTemplateDefault')
        .select('*');

    if (mError) {
        console.error('Error fetching mappings:', mError);
    } else {
        console.log(`Found ${mappings?.length} mappings:`);
        mappings?.forEach(m => {
            console.log(`  - Shift Type: "${m.shift_type}" -> Template ID: ${m.template_id}`);
        });
    }
}

checkChecklists();
