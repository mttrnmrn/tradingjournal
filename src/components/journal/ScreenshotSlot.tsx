import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signedUrl, validateImage } from "@/services/trades";
import type { Screenshot } from "@/types";

export function useSignedUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) signedUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

export function ScreenshotSlot({
  title,
  existing,
  file,
  removed,
  onFile,
  onRemove,
  onError,
}: {
  title: string;
  existing?: Screenshot;
  file: File | null;
  removed: boolean;
  onFile: (f: File | null) => void;
  onRemove: () => void;
  onError: (msg: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const savedUrl = useSignedUrl(existing && !removed ? existing.storage_path : undefined);
  const localUrl = useObjectUrl(file);
  const shown = localUrl ?? (removed ? null : savedUrl);
  const hasImage = Boolean(file) || (Boolean(existing) && !removed);

  function pick(f: File | undefined) {
    if (!f) return;
    const err = validateImage(f);
    if (err) return onError(err);
    onFile(f);
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div
        className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/40"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        {shown ? (
          <img src={shown} alt={title} className="h-full w-full object-contain" />
        ) : hasImage ? (
          <span className="text-xs text-muted-foreground">Loading image…</span>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ImagePlus className="h-6 w-6" />
            Click or drop PNG / JPG
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {hasImage && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            Replace
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 /> Remove
          </Button>
        </div>
      )}
    </div>
  );
}

/** Read-only screenshot display with click-to-enlarge. */
export function ScreenshotView({ title, shot }: { title: string; shot?: Screenshot }) {
  const url = useSignedUrl(shot?.storage_path);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-muted/40">
        {!shot ? (
          <span className="text-xs text-muted-foreground">No screenshot</span>
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" className="block h-full w-full">
            <img src={url} alt={title} className="h-full w-full object-contain" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Loading image…</span>
        )}
      </div>
    </div>
  );
}
