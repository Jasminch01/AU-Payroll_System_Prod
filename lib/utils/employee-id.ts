/**
 * Generates a 3-letter abbreviation for a business name.
 * Priority: 
 * 1. 3-word initials (e.g., "Australia Payroll System" -> "APS")
 * 2. 2-word initials + first char of last (e.g., "Beaver Labs" -> "BLS"?) 
 *    Actually, let's keep it simple: 
 *    - 3+ words: take first char of first 3 words.
 *    - 1-2 words: take first 3 chars of the name (stripping spaces).
 */
export function generateBusinessPrefix(businessName: string): string {
    const words = businessName.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (words.length >= 3) {
        return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    }
    
    const cleanName = businessName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (cleanName.length >= 3) {
        return cleanName.substring(0, 3);
    }
    
    return cleanName.padEnd(3, 'X');
}

/**
 * Pads a number to 4 digits for use in Employee IDs.
 */
export function formatEmpSuffix(num: number): string {
    return num.toString().padStart(4, '0');
}

/**
 * Helper to extract the numeric suffix from an ID like BVL1234
 */
export function getNumericSuffix(employeeId: string): number {
    const match = employeeId.match(/\d{4}$/);
    return match ? parseInt(match[0]) : 0;
}
