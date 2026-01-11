"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Check, AlertCircle } from "lucide-react";

export default function PartnerRedeemPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/partner/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          organization_name: organizationName.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // Redirect to partner dashboard after 2 seconds
        setTimeout(() => {
          router.push("/partner");
          router.refresh(); // Refresh to update sidebar
        }, 2000);
      } else {
        setError(data.error || "Failed to redeem invite");
      }
    } catch (err) {
      console.error("Error redeeming invite:", err);
      setError("Failed to redeem invite. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                Welcome to the Partner Program!
              </h2>
              <p className="mt-2 text-muted-foreground">
                Your account has been activated. Redirecting to your dashboard...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Redeem Partner Invite</CardTitle>
          <CardDescription>
            Enter your invite code to join the Partner API program
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRedeem} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Invite Code</Label>
              <Input
                id="code"
                placeholder="INV_XXXXXXXXXXXXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org">Organization Name</Label>
              <Input
                id="org"
                placeholder="Your Company Name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                This will be displayed in your partner profile
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !code.trim() || !organizationName.trim()}
            >
              {loading ? "Redeeming..." : "Redeem Invite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
