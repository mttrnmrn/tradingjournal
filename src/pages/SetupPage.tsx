import { Card } from "@/components/ui/card";

/** Shown only when the Supabase env variables have not been configured yet. */
export default function SetupPage() {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-lg space-y-3 p-6">
        <h1 className="text-lg font-semibold">Connect Supabase</h1>
        <p className="text-sm text-muted-foreground">
          The app needs your Supabase project credentials before it can run. Copy <code className="rounded bg-muted px-1">.env.example</code> to{" "}
          <code className="rounded bg-muted px-1">.env</code> and fill in:
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
        <p className="text-sm text-muted-foreground">
          Then run <code className="rounded bg-muted px-1">supabase/schema.sql</code> in the Supabase SQL editor and restart <code className="rounded bg-muted px-1">npm run dev</code>. See the README for full steps.
        </p>
      </Card>
    </div>
  );
}
