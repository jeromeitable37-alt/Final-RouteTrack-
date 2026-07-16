"use client";

import { Camera, X } from "lucide-react";

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The selected image could not be opened."));
    element.src = source;
  });

  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to prepare the proof image.");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function ProofPhotoPicker({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  async function choose(file?: File) {
    if (!file) return;
    try {
      onChange(await compressImage(file));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to attach the proof image.");
    }
  }

  return (
    <div className="proof-photo-picker span-2">
      <div>
        <strong>Photo proof</strong>
        <span>Optional: received copy, signature, document cover, or receiving desk.</span>
      </div>
      {value ? (
        <div className="proof-photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Routing proof preview" />
          <button type="button" className="danger-button compact-button" onClick={() => onChange("")}><X size={15} /> Remove</button>
        </div>
      ) : (
        <label className="secondary-button proof-photo-upload">
          <Camera size={16} /> Add photo
          <input type="file" accept="image/*" capture="environment" onChange={(event) => void choose(event.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}
