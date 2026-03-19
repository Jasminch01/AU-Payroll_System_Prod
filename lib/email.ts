/**
 * Email Service Utility
 * Currently uses a mock/console logger. 
 * To enable real emails, add RESEND_API_KEY to your .env.local
 */

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        console.log("--- MOCK EMAIL START ---");
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${text}`);
        console.log("--- MOCK EMAIL END ---");
        return { success: true, message: "Mock email logged to console" };
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: "AU Payroll <onboarding@resend.dev>", // Replace with verified domain in production
                to: [to],
                subject,
                html,
                text,
            }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Failed to send email");

        return { success: true, data: result };
    } catch (error: any) {
        console.error("Email send error:", error);
        return { success: false, error: error.message };
    }
}
