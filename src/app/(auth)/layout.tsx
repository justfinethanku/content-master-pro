"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

const GATE_PASSWORD = "JonFuckedUpTheAllowList&ThisIsHisTemporarySolution";
const STORAGE_KEY = "cmp_gate_pass";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === GATE_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-6 p-8"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Content Master Pro
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter the access code to continue
            </p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Access code"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              autoFocus
              className="bg-background text-foreground placeholder:text-muted-foreground"
            />
            {error && (
              <p className="text-sm text-destructive">Wrong code. Try again.</p>
            )}
          </div>
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">{children}</div>
    </div>
  );
}
