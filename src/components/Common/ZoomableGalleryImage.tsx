"use client";

import SafeProductImage from "@/components/Common/SafeProductImage";
import { resolveProductImageSrc } from "@/lib/shop/productImagePlaceholder";
import { useCallback, useEffect, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const CLICK_ZOOM_SCALE = 2.5;
const DRAG_THRESHOLD_PX = 4;

type Props = {
  src: string;
  alt: string;
  priority?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
  onZoomChange?: (zoomed: boolean) => void;
};

function clampPan(
  tx: number,
  ty: number,
  scale: number,
  width: number,
  height: number
): { x: number; y: number } {
  if (scale <= MIN_SCALE) return { x: 0, y: 0 };
  const maxX = (width * (scale - 1)) / 2;
  const maxY = (height * (scale - 1)) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, tx)),
    y: Math.max(-maxY, Math.min(maxY, ty)),
  };
}

function touchDistance(touches: TouchList | React.TouchList): number {
  if (touches.length < 2) return 0;
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export default function ZoomableGalleryImage({
  src,
  alt,
  priority,
  fetchPriority,
  loading,
  onZoomChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const scaleRef = useRef(scale);
  const translateRef = useRef(translate);
  const pointerMovedRef = useRef(false);
  const pointerDragRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef({ startDistance: 0, startScale: MIN_SCALE });

  scaleRef.current = scale;
  translateRef.current = translate;

  const applyZoom = useCallback(
    (nextScale: number, nextTranslate = { x: 0, y: 0 }) => {
      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      const rect = containerRef.current?.getBoundingClientRect();
      const bounded = rect
        ? clampPan(nextTranslate.x, nextTranslate.y, clampedScale, rect.width, rect.height)
        : nextTranslate;

      setScale(clampedScale);
      setTranslate(bounded);
      onZoomChange?.(clampedScale > MIN_SCALE + 0.02);
    },
    [onZoomChange]
  );

  const resetZoom = useCallback(() => {
    setScale(MIN_SCALE);
    setTranslate({ x: 0, y: 0 });
    onZoomChange?.(false);
  }, [onZoomChange]);

  useEffect(() => {
    resetZoom();
  }, [src, resetZoom]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (pointerMovedRef.current || pointerDragRef.current) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (scaleRef.current <= MIN_SCALE + 0.02) {
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const nextScale = CLICK_ZOOM_SCALE;
      applyZoom(nextScale, {
        x: (rect.width / 2 - x) * (nextScale - 1),
        y: (rect.height / 2 - y) * (nextScale - 1),
      });
      return;
    }

    resetZoom();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (scaleRef.current <= MIN_SCALE + 0.02) return;
    if (event.pointerType === "touch") return;

    pointerMovedRef.current = false;
    pointerDragRef.current = true;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDragRef.current || scaleRef.current <= MIN_SCALE + 0.02) return;

    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;

    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) {
      pointerMovedRef.current = true;
    }

    lastPointerRef.current = { x: event.clientX, y: event.clientY };

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const next = clampPan(
      translateRef.current.x + dx,
      translateRef.current.y + dy,
      scaleRef.current,
      rect.width,
      rect.height
    );
    setTranslate(next);
  };

  const endPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDragRef.current) return;
    pointerDragRef.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      onZoomChange?.(true);
      pinchRef.current = {
        startDistance: touchDistance(event.touches),
        startScale: scaleRef.current,
      };
      event.stopPropagation();
      return;
    }

    if (event.touches.length === 1 && scaleRef.current > MIN_SCALE + 0.02) {
      pointerMovedRef.current = false;
      pointerDragRef.current = true;
      const touch = event.touches[0]!;
      lastPointerRef.current = { x: touch.clientX, y: touch.clientY };
      event.stopPropagation();
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      event.stopPropagation();

      const distance = touchDistance(event.touches);
      const { startDistance, startScale } = pinchRef.current;
      if (startDistance <= 0) return;

      const ratio = distance / startDistance;
      applyZoom(startScale * ratio, translateRef.current);
      return;
    }

    if (!pointerDragRef.current || scaleRef.current <= MIN_SCALE + 0.02) return;
    if (event.touches.length !== 1) return;

    event.preventDefault();
    event.stopPropagation();

    const touch = event.touches[0]!;
    const dx = touch.clientX - lastPointerRef.current.x;
    const dy = touch.clientY - lastPointerRef.current.y;

    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) {
      pointerMovedRef.current = true;
    }

    lastPointerRef.current = { x: touch.clientX, y: touch.clientY };

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const next = clampPan(
      translateRef.current.x + dx,
      translateRef.current.y + dy,
      scaleRef.current,
      rect.width,
      rect.height
    );
    setTranslate(next);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length > 0) return;
    pointerDragRef.current = false;
    pinchRef.current = { startDistance: 0, startScale: MIN_SCALE };

    if (scaleRef.current < MIN_SCALE + 0.05) {
      resetZoom();
    }
  };

  const zoomed = scale > MIN_SCALE + 0.02;

  return (
    <div
      ref={containerRef}
      role="presentation"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`relative mx-auto flex h-[min(80vh,720px)] w-full max-w-4xl select-none items-center justify-center overflow-hidden ${
        zoomed ? "cursor-zoom-out touch-none" : "cursor-zoom-in"
      }`}
      style={{ touchAction: zoomed ? "none" : "pan-y" }}
    >
      <div
        className="flex h-full w-full items-center justify-center will-change-transform"
        style={{
          transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
      >
        <SafeProductImage
          src={resolveProductImageSrc(src)}
          alt={alt}
          width={900}
          height={900}
          draggable={false}
          className="mx-auto max-h-[min(80vh,720px)] w-auto max-w-full pointer-events-none object-contain"
          sizes="(max-width: 1024px) 95vw, 900px"
          priority={priority}
          fetchPriority={fetchPriority}
          loading={loading}
        />
      </div>
    </div>
  );
}
