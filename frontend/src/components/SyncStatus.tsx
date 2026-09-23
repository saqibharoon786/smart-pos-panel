import { useSyncStatus } from "@/lib/store";

export function SyncStatus() {
  const status = useSyncStatus();
  const label = !status.online ? "Offline" : status.syncing ? "Syncing" : status.pending ? "Pending" : "Online";
  const detail = !status.online
    ? "No internet. Sales and stock are saved on this device and will go to the database when the connection is back."
    : status.pending
      ? "Saved on this device. Sending to the database…"
      : "";

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          status.online && !status.pending
            ? "bg-emerald-500/15 text-emerald-700"
            : "bg-amber-500/15 text-amber-800"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${status.online && !status.pending ? "bg-emerald-600" : "bg-amber-600"}`}
        />
        {label}
      </span>
      {detail ? <p className="max-w-xs text-right text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
