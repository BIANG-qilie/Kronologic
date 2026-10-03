"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signIn } from "@/hooks/use-account";
import {
  PASSWORD_MIN,
  USERNAME_MAX,
  passwordProblem,
  usernameProblem,
} from "@/lib/account/rules";

type Kind = "login" | "register";

const FIELD =
  "h-12 rounded-none border-0 border-b border-[var(--ink-faint)] bg-transparent px-0 text-lg shadow-none transition-colors placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--amber)] focus-visible:outline-none focus-visible:ring-0 aria-[invalid=true]:border-[#e07a5f]";

export function AuthDialog({
  open,
  onOpenChange,
  initialKind = "login",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind?: Kind;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset(next: boolean) {
    if (!next) {
      setPassword("");
      setErr(null);
      setKind(initialKind);
    }
    onOpenChange(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "register") {
      const problem = usernameProblem(username) ?? passwordProblem(password);
      if (problem) {
        setErr(problem);
        return;
      }
    } else if (!username.trim() || !password) {
      setErr("称呼和密码都要填");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await signIn(kind, username, password);
      reset(false);
      setUsername("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "网络不稳，请重试");
    } finally {
      setBusy(false);
    }
  }

  const tab = (value: Kind, label: string) => (
    <TabsTrigger
      value={value}
      className="relative -mb-px min-h-11 flex-1 rounded-none border-b-2 border-transparent bg-transparent px-0 font-display text-lg text-[var(--ink-muted)] shadow-none transition-colors hover:text-[var(--ink)] data-[state=active]:border-[var(--amber)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--ink)] data-[state=active]:shadow-none"
    >
      {label}
    </TabsTrigger>
  );

  const form = (k: Kind) => (
    <form onSubmit={submit} className="space-y-6 pt-6" noValidate>
      <div className="space-y-1">
        <Label htmlFor={`${k}-name`} className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
          称呼
        </Label>
        <Input
          id={`${k}-name`}
          value={username}
          maxLength={USERNAME_MAX}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={k === "register" ? "2–16 位，中英文、数字、下划线" : "注册时用的称呼"}
          onChange={(e) => setUsername(e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${k}-pass`} className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
          密码
        </Label>
        <Input
          id={`${k}-pass`}
          type="password"
          value={password}
          autoComplete={k === "register" ? "new-password" : "current-password"}
          placeholder={k === "register" ? `至少 ${PASSWORD_MIN} 位` : ""}
          enterKeyHint="go"
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD}
        />
      </div>
      {err && (
        <p role="alert" className="animate-fade-up -mt-2 text-sm text-[#e07a5f]">
          {err}
        </p>
      )}
      <div className="space-y-2">
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? "稍等…" : k === "login" ? "登录" : "注册并登录"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-[var(--ink-muted)]">
          {k === "login"
            ? "不登录也能玩；登录后，战绩和成就会记在账号上。"
            : "没有找回密码，请记牢。称呼不区分大小写。"}
        </p>
      </div>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent
        sheet
        className="overflow-y-auto overscroll-contain border-0 bg-[var(--curtain)] px-5 pt-7 text-[var(--ink)] shadow-[0_0_0_1px_var(--ink-faint),0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:max-w-md sm:p-8"
      >
        <DialogHeader className="text-left">
          <p className="text-[11px] tracking-[0.42em] text-[var(--amber)]">调查员登记处</p>
          <DialogTitle className="font-display text-3xl">
            {kind === "login" ? "回到剧院" : "领一张常客票"}
          </DialogTitle>
          <DialogDescription className="sr-only">用称呼和密码登录或注册</DialogDescription>
        </DialogHeader>
        <Tabs
          value={kind}
          onValueChange={(v) => {
            setKind(v as Kind);
            setErr(null);
          }}
        >
          <TabsList className="h-auto w-full rounded-none border-b border-ink-faint/70 bg-transparent p-0">
            {tab("login", "登录")}
            {tab("register", "注册")}
          </TabsList>
          <TabsContent value="login" className="mt-0">
            {form("login")}
          </TabsContent>
          <TabsContent value="register" className="mt-0">
            {form("register")}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
