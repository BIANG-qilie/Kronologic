"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Ticket } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { signOut, useAccount } from "@/hooks/use-account";
import { cn } from "@/lib/utils";
import { AuthDialog } from "./auth-dialog";

/** Header corner: 「登录」 for guests, the username with a small menu once signed in. Hidden when accounts are off. */
export function AccountMenu({ className }: { className?: string }) {
  const account = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (account.status === "loading") {
    return <span className={cn("block h-11 w-16", className)} aria-hidden />;
  }
  if (!account.enabled) return null;

  if (!account.user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className={cn(
            "-mr-2 flex min-h-11 items-center gap-2 px-2 text-xs tracking-[0.24em] text-[var(--ink-muted)] transition-colors hover:text-[var(--amber)]",
            className
          )}
        >
          <Ticket className="h-4 w-4" aria-hidden />
          登录
        </button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "-mr-2 flex min-h-11 max-w-[11rem] items-center gap-1.5 px-2 text-sm tracking-normal text-[var(--ink)] transition-colors hover:text-[var(--amber)] data-[state=open]:text-[var(--amber)]",
            className
          )}
          aria-label={`账号：${account.user.username}`}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green-win)] shadow-[0_0_6px_rgba(111,191,138,0.8)]" aria-hidden />
          <span className="truncate">{account.user.username}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-48 border-0 bg-[var(--stage)] p-1 text-[var(--ink)] shadow-[0_0_0_1px_var(--ink-faint),0_24px_60px_-20px_rgba(0,0,0,0.9)]"
      >
        <Link
          href="/me"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center gap-2.5 rounded-[3px] px-3 text-sm transition-colors hover:bg-curtain/70 hover:text-[var(--amber)]"
        >
          <Ticket className="h-4 w-4 opacity-80" aria-hidden />
          我的战绩
        </Link>
        <button
          type="button"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            try {
              await signOut();
            } finally {
              setLeaving(false);
              setMenuOpen(false);
            }
          }}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-[3px] px-3 text-sm text-[var(--ink-muted)] transition-colors hover:bg-curtain/70 hover:text-[var(--ink)] disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 opacity-80" aria-hidden />
          {leaving ? "正在退出…" : "退出"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
