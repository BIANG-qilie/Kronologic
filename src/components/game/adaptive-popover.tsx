"use client";

import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePhone } from "@/hooks/use-media";
import { cn } from "@/lib/utils";

/** Anchored popover on wider screens; bottom drawer within thumb reach on phones. */
export function AdaptivePopover({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  className,
  popoverClassName,
  align = "center",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
  popoverClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const phone = usePhone();

  if (phone) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          sheet
          aria-describedby={undefined}
          className={cn("gap-0 border-0 px-4 pt-6 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)]", className)}
          closeClassName="text-[var(--ink-deep)]"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={cn(className, popoverClassName)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
