"use client";

import { ChangeEvent, useState } from "react";
import { Camera, Trash2 } from "lucide-react";

export function Avatar({ name, photoDataUrl, size = "normal" }: { name: string; photoDataUrl?: string; size?: "small" | "normal" | "large" }) {
  const initial = (name || "U").trim().slice(0, 1).toUpperCase();
  return (
    <div className={`profile-avatar profile-avatar-${size}`} aria-label={`${name || "User"} profile picture`}>
      {photoDataUrl ? <img src={photoDataUrl} alt="" /> : <span>{initial}</span>}
    </div>
  );
}

async function compressProfileImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("The selected image is too large.");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const item = new Image();
    item.onload = () => resolve(item);
    item.onerror = () => reject(new Error("Unable to open the image."));
    item.src = source;
  });

  const max = 320;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const output = canvas.toDataURL("image/jpeg", 0.76);
  if (output.length > 650_000) throw new Error("Please use a smaller profile picture.");
  return output;
}

export function ProfilePhotoPicker({ name, value, onChange }: { name: string; value?: string; onChange: (value: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await compressProfileImage(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to use this image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-picker">
      <Avatar name={name} photoDataUrl={value} size="large" />
      <div className="photo-picker-actions">
        <label className="secondary-button photo-upload-button">
          <Camera size={16} /> {busy ? "Processing…" : value ? "Change photo" : "Add profile photo"}
          <input type="file" accept="image/*" onChange={choose} disabled={busy} />
        </label>
        {value && <button type="button" className="danger-button compact-button" onClick={() => onChange("")}><Trash2 size={15} /> Remove</button>}
        <small>The image is compressed and saved with your user profile. Firebase Storage is not required.</small>
        {error && <span className="field-error">{error}</span>}
      </div>
    </div>
  );
}
