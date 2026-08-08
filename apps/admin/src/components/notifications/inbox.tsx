"use client";

import {
  readAllAction,
  readNotificationAction,
} from "@/app/(dashboard)/notifications/action";
import type { Inbox as InboxData } from "services";
import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Read rows are kept and dimmed rather than removed. A list that empties as you
// read it gives you nowhere to go back to when you realise the one you dismissed
// was the one that mattered.

type InboxProps = {
  inbox: InboxData;
};

export const Inbox = ({ inbox }: InboxProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>): void => {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  };

  if (inbox.items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-sm text-faint">
        Nothing here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          <span className="font-medium text-ink">{inbox.unread}</span> unread
        </p>
        {inbox.unread > 0 && (
          <button
            type="button"
            onClick={() => run(readAllAction)}
            disabled={pending}
            className="rounded-control border border-hairline px-2.5 py-1 text-xs text-secondary hover:bg-hover hover:text-ink disabled:opacity-60"
          >
            Mark all read
          </button>
        )}
      </div>

      {inbox.items.map((item) => (
        <div
          key={item.uuid}
          className={`flex items-start justify-between gap-3 rounded-card border px-4 py-3 ${
            item.readAt
              ? "border-hairline bg-base opacity-60"
              : "border-primary/30 bg-surface"
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm text-ink">
              {item.href ? (
                <Link href={item.href} className="hover:text-primary">
                  {item.title}
                </Link>
              ) : (
                item.title
              )}
            </p>
            {item.body && (
              <p className="text-[11px] text-muted">{item.body}</p>
            )}
            <p className="text-[11px] text-faint">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>

          {!item.readAt && (
            <button
              type="button"
              onClick={() => run(() => readNotificationAction(item.uuid))}
              disabled={pending}
              aria-label="Mark read"
              className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink disabled:opacity-60"
            >
              <Check size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export const InboxIcon = () => <Bell size={20} strokeWidth={2} />;
