import { XeroClient, TokenSet } from 'xero-node';
import { createAdminClient } from '@/lib/supabase/admin';
import { XeroConfig } from '@/types/database';

const clientId = process.env.XERO_CLIENT_ID!;
const clientSecret = process.env.XERO_CLIENT_SECRET!;
const redirectUri = process.env.XERO_REDIRECT_URI!;

const xero = new XeroClient({
    clientId,
    clientSecret,
    redirectUris: [redirectUri],
    scopes: 'openid profile email accounting.settings accounting.transactions accounting.contacts offline_access'.split(' '),
});

/**
 * Get an authenticated Xero client for a specific business.
 * Handles automatic token refresh if expired.
 */
export async function getXeroClient(businessId: string) {
    const supabase = createAdminClient();

    // 1. Fetch config from DB
    const { data: config, error } = await supabase
        .from('XeroConfig')
        .select('*')
        .eq('business_id', businessId)
        .single();

    if (error || !config) {
        throw new Error('Xero not connected for this business');
    }

    const tokenSet = new TokenSet({
        access_token: config.access_token,
        refresh_token: config.refresh_token,
        id_token: '',
        expires_at: Math.floor(new Date(config.token_expires_at).getTime() / 1000),
        token_type: 'Bearer',
        scope: 'openid profile email accounting.settings accounting.transactions accounting.contacts offline_access'
    });

    xero.setTokenSet(tokenSet);

    // 2. Refresh if expired (or within 5 mins of expiry)
    const now = Math.floor(Date.now() / 1000);
    if (tokenSet.expires_at! < now + 300) {
        console.log('Xero token expired or near expiry, refreshing...');
        const newTokenSet = await xero.refreshWithRefreshToken(clientId, clientSecret, config.refresh_token);
        await saveXeroTokens(businessId, newTokenSet);
        xero.setTokenSet(newTokenSet);
    }

    return xero;
}

/**
 * Save Xero tokens to the database.
 */
export async function saveXeroTokens(businessId: string, tokenSet: TokenSet) {
    const supabase = createAdminClient();

    const configData = {
        business_id: businessId,
        access_token: tokenSet.access_token!,
        refresh_token: tokenSet.refresh_token!,
        token_expires_at: new Date(tokenSet.expires_at! * 1000).toISOString(),
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from('XeroConfig')
        .upsert(configData, { onConflict: 'business_id' });

    if (error) {
        console.error('Error saving Xero tokens:', error);
        throw new Error('Failed to save Xero credentials');
    }
}

/**
 * Disconnect Xero for a business.
 */
export async function disconnectXero(businessId: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
        .from('XeroConfig')
        .delete()
        .eq('business_id', businessId);

    if (error) throw error;
}

export { xero };
