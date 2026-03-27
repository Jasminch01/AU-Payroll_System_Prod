import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { sendPushNotification } from '@/lib/push-notifications';

export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        await sendPushNotification(
            authUser.user_id, 
            'Test Notification', 
            'This is a test push notification to confirm that your device is correctly set up!',
            '/'
        );

        return successResponse({ message: 'Push notification triggered' });
    } catch (err: any) {
        console.error('Test push error:', err);
        return errorResponse(err.message || 'Internal server error', 500);
    }
}
