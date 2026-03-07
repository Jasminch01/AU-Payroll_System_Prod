import { SignJWT, jwtVerify } from 'jose';

// Get a secure key, fallback to Supabase Anon Key for MVP MVP convenience
const secretKey = process.env.KIOSK_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'default-insecure-key';
const encodedSecret = new TextEncoder().encode(secretKey);

export async function signKioskToken(businessId: string): Promise<string> {
    return await new SignJWT({ business_id: businessId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10y') // Kiosk devices stay logged in long-term
        .sign(encodedSecret);
}

export async function verifyKioskToken(token: string): Promise<{ business_id: string } | null> {
    try {
        const { payload } = await jwtVerify(token, encodedSecret);
        if (payload && payload.business_id) {
            return { business_id: payload.business_id as string };
        }
        return null;
    } catch (err) {
        console.error('Kiosk Token Verification Failed:', err);
        return null;
    }
}
