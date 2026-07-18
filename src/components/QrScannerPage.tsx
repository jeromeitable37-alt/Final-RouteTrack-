"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Camera, FileSearch, QrCode, Search, StopCircle } from "lucide-react";
import { DocumentRecord } from "@/lib/types";

type DetectorResult = { rawValue?: string };
type DetectorConstructor = new (options?: { formats?: string[] }) => { detect: (source: CanvasImageSource) => Promise<DetectorResult[]> };

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function QrScannerPage({
  documents,
  onOpenDocument,
}: {
  documents: DocumentRecord[];
  onOpenDocument: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState(true);
  const [message, setMessage] = useState("Use your phone camera to scan a RouteTrack QR code.");
  const [manual, setManual] = useState("");

  useEffect(() => () => stopScanner(), []);

  function findDocument(raw: string): DocumentRecord | undefined {
    let candidate = raw.trim();
    try {
      const url = new URL(candidate);
      candidate = url.searchParams.get("document") || candidate;
    } catch {
      // Plain document number or Firestore ID is also accepted.
    }
    const normalized = normalize(candidate);
    return documents.find((item) =>
      item.id === candidate ||
      normalize(item.requestNo) === normalized ||
      normalize(`${item.type} ${item.requestNo}`) === normalized ||
      normalize(item.trackingId) === normalized,
    );
  }

  function openResult(raw: string) {
    const found = findDocument(raw);
    if (found) {
      stopScanner();
      onOpenDocument(found.id);
      return;
    }
    setMessage("The QR code was read, but no visible RouteTrack document matched it.");
  }

  async function startScanner() {
    const Detector = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setSupported(false);
      setMessage("Live QR scanning is not supported by this browser. Use the manual search below or Chrome on Android.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new Detector({ formats: ["qr_code"] });
      setScanning(true);
      setMessage("Point the camera at a RouteTrack QR code.");
      timerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const results = await detector.detect(video);
          const value = results[0]?.rawValue;
          if (value) openResult(value);
        } catch {
          // Keep scanning when a frame cannot be analyzed.
        }
      }, 700);
    } catch {
      setMessage("Camera access was not granted. Allow camera permission or use manual search.");
    }
  }

  function stopScanner() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const found = findDocument(manual);
    if (found) onOpenDocument(found.id);
    else setMessage("No visible document matched that number or tracking ID.");
  }

  return (
    <div className="page-section scanner-page">
      <section className="scanner-hero panel">
        <div className="scanner-copy">
          <p className="eyebrow">MOBILE TRACE SCANNER</p>
          <h2>Scan and open a document instantly</h2>
          <p>{message}</p>
          <div className="scanner-actions">
            {!scanning ? (
              <button className="primary-button" onClick={() => void startScanner()}><Camera size={18} /> Start camera</button>
            ) : (
              <button className="secondary-button" onClick={stopScanner}><StopCircle size={18} /> Stop camera</button>
            )}
          </div>
        </div>
        <div className={`scanner-frame ${scanning ? "scanner-active" : ""}`}>
          <video ref={videoRef} muted playsInline />
          {!scanning && <div><QrCode size={54} /><span>{supported ? "Camera preview" : "Manual mode"}</span></div>}
          {scanning && <div className="scanner-target" />}
        </div>
      </section>

      <section className="panel scanner-manual-panel">
        <div className="panel-heading"><div><p className="eyebrow">MANUAL FALLBACK</p><h2>Search a document number</h2></div><FileSearch size={20} /></div>
        <form onSubmit={submitManual} className="scanner-manual-form">
          <div className="search-box"><Search size={18} /><input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="PRF 2026-001 or tracking ID" /></div>
          <button className="primary-button">Open document</button>
        </form>
      </section>
    </div>
  );
}
