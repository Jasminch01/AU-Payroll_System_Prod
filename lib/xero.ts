import { XeroClient, TokenSet } from 'xero-node';
import { createAdminClient } from '@/lib/supabase/admin';

// Fixed state value — must be same for auth and callback
const XERO_STATE = 'xero-auth-state';

const XERO_SCOPES: string[] = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'accounting.settings',
    'accounting.contacts',
];


// Singleton instance
let xeroInstance: XeroClient | null = null;

export function getXero(): XeroClient {
    if (!xeroInstance) {
        const clientId = (process.env.XERO_CLIENT_ID || '').trim();
        const clientSecret = (process.env.XERO_CLIENT_SECRET || '').trim();
        const redirectUri = (process.env.XERO_REDIRECT_URI || '').trim();

        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Xero configuration missing in .env.local');
        }

        xeroInstance = new XeroClient({
            clientId,
            clientSecret,
            redirectUris: [redirectUri],
            scopes: XERO_SCOPES,
            state: XERO_STATE,
        });
    }
    return xeroInstance;
}

export function resetXeroInstance() {
    xeroInstance = null;
}

export async function getXeroClient(businessId: string) {
    const supabase = createAdminClient();

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
        scope: XERO_SCOPES.join(' '),
    });

    const xero = getXero();
    xero.setTokenSet(tokenSet);

    const now = Math.floor(Date.now() / 1000);
    // Refresh if expiring in less than 5 minutes
    if (tokenSet.expires_at! < now + 300) {
        const clientId = (process.env.XERO_CLIENT_ID || '').trim();
        const clientSecret = (process.env.XERO_CLIENT_SECRET || '').trim();
        const newTokenSet = await xero.refreshWithRefreshToken(clientId, clientSecret, config.refresh_token);
        await saveXeroTokens(businessId, newTokenSet, config.tenant_id);
        xero.setTokenSet(newTokenSet);
    }


    return xero;
}

export async function saveXeroTokens(businessId: string, tokenSet: TokenSet, tenantId: string) {
    const supabase = createAdminClient();

    const configData: any = {
        business_id: businessId,
        tenant_id: tenantId,
        access_token: tokenSet.access_token!,
        refresh_token: tokenSet.refresh_token!,
        token_expires_at: new Date(tokenSet.expires_at! * 1000).toISOString(),
        updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
        .from('XeroConfig')
        .select('created_at')
        .eq('business_id', businessId)
        .single();

    if (!existing) {
        configData.created_at = new Date().toISOString();
    }

    const { error } = await supabase
        .from('XeroConfig')
        .upsert(configData, { onConflict: 'business_id' });

    if (error) throw new Error('Failed to save Xero credentials: ' + error.message);
}


export async function disconnectXero(businessId: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
        .from('XeroConfig')
        .delete()
        .eq('business_id', businessId);
    if (error) throw error;
    resetXeroInstance();
}