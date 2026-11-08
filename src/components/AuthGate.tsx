import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, LockKeyhole, ShieldCheck } from "lucide-react";

import { createAuthSession, getAuthSession } from "../api/auth";
import { SESSION_STATE_EVENT, type SessionStateReason } from "../api/client";
import { ApiError } from "../api/system";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

export function AuthGate({ children }: { children: ReactNode }) {
  const [accessKey, setAccessKey] = useState("");
  const [sessionReason, setSessionReason] = useState<SessionStateReason>();
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const unlock = useMutation({
    mutationFn: createAuthSession,
    onSuccess: () => {
      setAccessKey("");
      setSessionReason(undefined);
      void session.refetch();
    },
  });

  useEffect(() => {
    function handleSessionState(event: Event) {
      const reason = (event as CustomEvent<SessionStateReason>).detail;
      setSessionReason(reason);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth-session",
      });
      queryClient.setQueryData(["auth-session"], { authenticated: false });
    }
    window.addEventListener(SESSION_STATE_EVENT, handleSessionState);
    return () =>
      window.removeEventListener(SESSION_STATE_EVENT, handleSessionState);
  }, [queryClient]);

  if (session.isLoading) {
    return (
      <main className="auth-gate" aria-live="polite">
        Checking platform access…
      </main>
    );
  }
  if (session.data?.authenticated) return children;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accessKey) unlock.mutate(accessKey);
  }

  const error = unlock.error ?? session.error;
  return (
    <main className="auth-gate">
      <Card className="w-full max-w-md py-0" aria-labelledby="unlock-heading">
        <CardContent className="p-6 sm:p-8">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot size={22} aria-hidden="true" />
          </div>
          <p className="eyebrow mt-6">Local MVP access</p>
          <h1
            id="unlock-heading"
            className="mt-2 text-2xl font-semibold tracking-tight text-foreground"
          >
            Unlock StockBOT
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Enter the local access key to create a secure browser session. The
            key is only held in this form while it is submitted and is never
            saved in browser storage.
          </p>
          {sessionReason && (
            <Notice
              variant="warning"
              className="mt-5"
              role="status"
              aria-live="assertive"
            >
              {sessionReason === "expired"
                ? "Your secure session expired. Unlock the platform again to continue. No access key was saved."
                : "You signed out safely. Unlock the platform to begin a new session."}
            </Notice>
          )}
          <form
            className="upload-form"
            onSubmit={submit}
            aria-busy={unlock.isPending}
          >
            <label htmlFor="local-access-key">
              Local access key
              <input
                id="local-access-key"
                className="field-control"
                type="password"
                autoComplete="current-password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                required
                autoFocus
              />
            </label>
            <Button
              disabled={!accessKey || unlock.isPending}
              className="w-full"
            >
              <LockKeyhole aria-hidden="true" />
              {unlock.isPending ? "Unlocking…" : "Unlock platform"}
            </Button>
            {error instanceof ApiError && (
              <p className="error-text" role="alert">
                {error.message}
                {error.requestId ? ` Request ID: ${error.requestId}` : ""}
              </p>
            )}
            {error && !(error instanceof ApiError) && (
              <p className="error-text" role="alert">
                The platform could not verify access. Check that the API is
                available, then try again.
              </p>
            )}
          </form>
          <p className="mt-6 flex items-center gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            The access key is not retained after this secure session is created.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
