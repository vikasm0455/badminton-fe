"use client";
import { useRef, useState } from "react";
import { downscaleImage } from "@/lib/image";
import { Button } from "./ui";

/** Camera + file-picker pair that downscales the chosen image (so uploads are
 *  always small) before handing it back. Shared by the credential OCR and the
 *  court-board scan — the single place every image upload passes through. */
export default function CaptureButtons({
  onFile,
  labels,
}: {
  onFile: (file: File) => void;
  labels?: { camera?: string; upload?: string };
}) {
  const cameraRef = useRef<HTMLInputElement>(null); // opens the camera on phones
  const uploadRef = useRef<HTMLInputElement>(null); // pick an existing image (any device)
  const [busy, setBusy] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setBusy(true);
    try {
      const small = await downscaleImage(file); // ~1600px / JPEG ≈ <1MB
      onFile(small);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" loading={busy} onClick={() => cameraRef.current?.click()}>
        📷 {labels?.camera ?? "Take photo"}
      </Button>
      <Button variant="secondary" loading={busy} onClick={() => uploadRef.current?.click()}>
        🖼 {labels?.upload ?? "Upload image"}
      </Button>
      <input ref={cameraRef} type="file" accept="image/png,image/jpeg" capture="environment" className="hidden" onChange={handle} />
      <input ref={uploadRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handle} />
    </div>
  );
}
