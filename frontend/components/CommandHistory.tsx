"use client";

import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CommandStatus = "done" | "processing" | "error";

export interface HistoryItem {
  id: string;
  instruction: string;
  status: CommandStatus;
  summary?: string;
}

const statusConfig: Record<
  CommandStatus,
  { label: string; icon: typeof Check; className: string }
> = {
  done: {
    label: "完成",
    icon: Check,
    className: "text-primary",
  },
  processing: {
    label: "处理中",
    icon: Loader2,
    className: "text-muted-foreground animate-spin",
  },
  error: {
    label: "失败",
    icon: AlertCircle,
    className: "text-destructive",
  },
};

interface CommandHistoryProps {
  items?: HistoryItem[];
}

export default function CommandHistory({
  items = [],
}: CommandHistoryProps) {
  return (
    <aside
      aria-label="指令历史"
      className="flex h-full flex-col rounded-[10px] border border-border bg-card p-5"
    >
      <header className="mb-4">
        <h2 className="text-sm font-medium text-foreground">指令历史</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">此前的指令</p>
      </header>

      {items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          暂无指令,试着说一句吧
        </p>
      ) : (
        <ol className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {items.map((cmd) => {
            const { label, icon: Icon, className } =
              statusConfig[cmd.status] ?? statusConfig.error;
            return (
              <li
                key={cmd.id}
                className="flex items-start gap-3 rounded-[10px] border border-border bg-secondary px-3 py-2.5"
              >
                <Icon
                  className={cn("mt-0.5 size-4 shrink-0", className)}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-foreground">
                    {cmd.instruction}
                  </p>
                  <span className="mt-1 inline-block text-[11px] text-muted-foreground">
                    {cmd.summary ? `${label} · ${cmd.summary}` : label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
