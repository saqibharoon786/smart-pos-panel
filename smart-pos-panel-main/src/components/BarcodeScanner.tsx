import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
};

/**
 * Live camera barcode scanner. Uses @zxing/browser loaded lazily so nothing
 * camera-related ships or runs during SSR.
 */
export function BarcodeScanner({ open, onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let controls: { stop: () => void } | undefined;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result) return;
            const code = result.getText();
            const now = Date.now();
            // ignore duplicate reads of the same barcode for 2s
            if (code === lastRef.current.code && now - lastRef.current.at < 2000) return;
            lastRef.current = { code, at: now };
            onScan(code);
          },
        );
      } catch {
        if (!cancelled) setError("Camera not available. Allow camera permission and try again.");
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Camera className="size-4 text-primary" />
          <span className="text-sm font-semibold">Scan barcode with camera</span>
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close scanner"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 bg-red-500/80" />
        </div>
        <p className="px-4 py-3 text-center text-xs text-muted-foreground">
          {error || "Point the camera at the barcode — it scans automatically."}
        </p>
      </div>
    </div>
  );
}
