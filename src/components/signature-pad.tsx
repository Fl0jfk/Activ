"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ASSOCIATION_PHONE_DISPLAY } from "@/lib/association-contact";

/** Point normalisé : x et y exprimés en fraction de la largeur du cadre (le tracé se redimensionne sans déformation). */
type SignaturePoint = [number, number];
export type SignatureStroke = SignaturePoint[];

export type SignatureValue = {
  dataUrl: string;
  strokes: SignatureStroke[];
};

type SignaturePadProps = {
  value: SignatureValue | null;
  onChange: (value: SignatureValue | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Identifiant du message d'erreur lié, s'il y en a un. */
  describedBy?: string;
};

const LINE_WIDTH_PX = 3;
const INK_COLOR = "#0f172a";
const MAX_PIXEL_RATIO = 2;
/** Longueur minimale du tracé (en largeurs de cadre) pour qu'il compte comme une signature. */
const MIN_TOTAL_LENGTH = 0.1;
const MIN_POINTS = 4;

function strokesLength(strokes: SignatureStroke[]): number {
  let total = 0;
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const [x1, y1] = stroke[index - 1]!;
      const [x2, y2] = stroke[index]!;
      total += Math.hypot(x2 - x1, y2 - y1);
    }
  }
  return total;
}

function isSignatureLongEnough(strokes: SignatureStroke[]): boolean {
  const points = strokes.reduce((sum, stroke) => sum + stroke.length, 0);
  return points >= MIN_POINTS && strokesLength(strokes) >= MIN_TOTAL_LENGTH;
}

function paint(canvas: HTMLCanvasElement, strokes: SignatureStroke[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ratio = canvas.width / Math.max(canvas.clientWidth, 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = LINE_WIDTH_PX * ratio;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    ctx.beginPath();
    stroke.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x * canvas.width, y * canvas.width);
      else ctx.lineTo(x * canvas.width, y * canvas.width);
    });
    ctx.stroke();
  }
}

export default function SignaturePad({
  value,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<SignatureStroke[]>(value?.strokes ?? []);
  const currentRef = useRef<SignatureStroke | null>(null);
  const [tooShort, setTooShort] = useState(false);
  const [hasInk, setHasInk] = useState((value?.strokes.length ?? 0) > 0);

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.clientWidth === 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    paint(canvas, currentRef.current ? [...strokesRef.current, currentRef.current] : strokesRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncSize();
    const observer = new ResizeObserver(() => syncSize());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [syncSize]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): SignaturePoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.width];
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    currentRef.current = [pointFromEvent(event)];
    setTooShort(false);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = currentRef.current;
    const canvas = canvasRef.current;
    if (!stroke || !canvas || disabled) return;
    stroke.push(pointFromEvent(event));
    paint(canvas, [...strokesRef.current, stroke]);
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = currentRef.current;
    const canvas = canvasRef.current;
    if (!stroke || !canvas) return;
    currentRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // Un simple appui ne laisse aucune trace visible : on l'ignore.
    if (stroke.length >= 2) strokesRef.current = [...strokesRef.current, stroke];
    paint(canvas, strokesRef.current);

    const strokes = strokesRef.current;
    setHasInk(strokes.length > 0);
    if (isSignatureLongEnough(strokes)) {
      setTooShort(false);
      onChange({ dataUrl: canvas.toDataURL("image/png"), strokes });
    } else {
      setTooShort(true);
      onChange(null);
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    strokesRef.current = [];
    currentRef.current = null;
    if (canvas) paint(canvas, []);
    setHasInk(false);
    setTooShort(false);
    onChange(null);
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Zone de signature. Tracez votre signature avec le doigt ou la souris."
        aria-describedby={describedBy}
        className={`aspect-[2/1] w-full max-w-xl touch-none rounded-2xl border-2 bg-white ${
          invalid || tooShort ? "border-rose-500" : value ? "border-brand-green" : "border-slate-400"
        } ${disabled ? "opacity-60" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={clear} disabled={disabled || !hasInk} className="btn btn-ghost">
          Effacer et recommencer
        </button>
        {value ? (
          <p role="status" className="text-sm font-semibold text-brand-green-dark">
            ✓ Signature enregistrée
          </p>
        ) : tooShort ? (
          <p role="status" className="text-sm font-semibold text-rose-700">
            Le tracé est trop court. Signez à nouveau, en traçant un trait continu.
          </p>
        ) : null}
      </div>
      <p className="text-sm text-slate-600">
        Signez dans le cadre blanc, avec le doigt sur un téléphone ou une tablette, ou avec la souris. Vous ne pouvez
        pas signer à l’écran ? Appelez le bureau au {ASSOCIATION_PHONE_DISPLAY}.
      </p>
    </div>
  );
}
