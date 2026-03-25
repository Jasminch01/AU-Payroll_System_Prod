import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return errorResponse('Not authenticated', 401);
        }

        // Try Owner/Manager table
        const { data: userRecord } = await supabase
            .from('User')
            .select('*, Business(*)')
            .eq('user_id', user.id)
            .single();

        if (userRecord) {
            return successResponse(userRecord);
        }

        // Try Employee table
        const { data: employeeRecord } = await supabase
            .from('Employee')
            .select('*, Business(*), EmployeeRateHistory(*)')
            .eq('user_id', user.id)
            .single();

        if (employeeRecord) {
            // Sort to get current rate
            let current_rate = null;
            if (employeeRecord.EmployeeRateHistory && employeeRecord.EmployeeRateHistory.length > 0) {
                const sorted = employeeRecord.EmployeeRateHistory.sort((a: any, b: any) =>
                    new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime()
                );
                current_rate = sorted[0];
            }
            const { ...safeEmployeeRecord } = employeeRecord;
            return successResponse({ ...safeEmployeeRecord, current_rate });
        }

        return errorResponse('Profile not found', 404);
    } catch (error: any) {
        return errorResponse(error.message, 500);
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return errorResponse('Not authenticated', 401);
        }

        const body = await request.json();

        // Check if updating User or Employee to determine allowed fields
        const { data: existingUser } = await supabase
            .from('User')
            .select('user_id, business_id, role')
            .eq('user_id', user.id)
            .single();

        let allowedUpdates: any = {};
        const businessUpdates = body.business ? {
            business_name: body.business.business_name,
            abn: body.business.abn,
            state: body.business.state,
            labour_threshold_min: body.business.labour_threshold_min,
            labour_theshold_max: body.business.labour_theshold_max,
        } : null;

        if (existingUser) {
            // User table (Owners/Managers) only allows Name updates
            allowedUpdates = {
                first_name: body.first_name,
                last_name: body.last_name,
            };
        } else {
            // Employee table allows full profile updates
            const { data: existingEmployee } = await supabase
                .from('Employee')
                .select('employee_id, user_id, business_id')
                .eq('user_id', user.id)
                .single();

            if (existingEmployee) {
                allowedUpdates = {
                    first_name: body.first_name,
                    last_name: body.last_name,
                    phone: body.phone,
                    dob: body.dob,
                    bank_details: body.bank_details,
                    bank_account_name: body.bank_account_name,
                    bank_bsb: body.bank_bsb,
                    bank_account_number: body.bank_account_number,
                    "ABN/TFN/ACN": body["ABN/TFN/ACN"],
                    emergency_contact_name: body.emergency_contact_name,
                    emergency_contact_phone: body.emergency_contact_phone,
                };
            } else {
                return errorResponse('Profile not found', 404);
            }
        }

        // Remove undefined fields from allowedUpdates
        Object.keys(allowedUpdates).forEach((key) => {
            if (allowedUpdates[key] === undefined) {
                delete allowedUpdates[key];
            }
        });

        // Remove undefined fields from businessUpdates
        if (businessUpdates) {
            Object.keys(businessUpdates).forEach((key) => {
                if ((businessUpdates as any)[key] === undefined) {
                    delete (businessUpdates as any)[key];
                }
            });
        }

        if (Object.keys(allowedUpdates).length === 0 && (!businessUpdates || Object.keys(businessUpdates).length === 0)) {
            return errorResponse('No valid fields to update', 400);
        }

        if (existingUser) {
            if (Object.keys(allowedUpdates).length > 0) {
                const { error: updateError } = await supabase
                    .from('User')
                    .update(allowedUpdates)
                    .eq('user_id', user.id);

                if (updateError) return errorResponse(updateError.message, 400);
            }

            // If owner, update business info if provided
            if (existingUser.role === 'owner' && businessUpdates && Object.keys(businessUpdates).length > 0) {
                const { error: bizError } = await supabase
                    .from('Business')
                    .update(businessUpdates)
                    .eq('business_id', existingUser.business_id);

                if (bizError) return errorResponse(bizError.message, 400);
            }

            await logAudit({
                businessId: existingUser.business_id,
                tableName: 'User/Business',
                recordId: user.id,
                action: 'UPDATE',
                changedBy: user.id,
                afterValue: { allowedUpdates, businessUpdates },
                reason: 'Self profile/business update'
            });

            return successResponse(null, 'Profile updated successfully');
        }


        const { error: updateError } = await supabase
            .from('Employee')
            .update(allowedUpdates)
            .eq('user_id', user.id);

        if (updateError) return errorResponse(updateError.message, 400);

        // Fetch business_id for audit logging (we know it's an employee now)
        const { data: empData } = await supabase
            .from('Employee')
            .select('business_id')
            .eq('user_id', user.id)
            .single();

        await logAudit({
            businessId: empData?.business_id,
            tableName: 'Employee',
            recordId: user.id,
            action: 'UPDATE',
            changedBy: user.id,
            afterValue: allowedUpdates,
            reason: 'Self profile update'
        });

        return successResponse(null, 'Profile updated successfully');

    } catch (error: any) {
        return errorResponse(error.message, 500);
    }
}
