export default function Loading() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
            <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[hsl(var(--muted))] border-t-[hsl(var(--brand))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</p>
            </div>
        </div>
    );
}
