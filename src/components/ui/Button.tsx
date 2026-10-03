"use client";

import type { ButtonHTMLAttributes } from "react";
import { audio } from "@/audio/audioManager";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Skip the default click sound (the caller plays its own). */
  silent?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-orange text-navy shadow-[0_4px_0_0_rgba(160,90,0,0.55)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_0_rgba(160,90,0,0.55)]",
  secondary:
    "bg-brand-deep text-white shadow-[0_4px_0_0_rgba(8,30,70,0.5)] hover:brightness-110 active:translate-y-[3px] active:shadow-[0_1px_0_0_rgba(8,30,70,0.5)]",
  ghost: "bg-surface-2 text-ink hover:brightness-95 active:scale-[0.97]",
};

export function Button({ variant = "primary", silent, className = "", onClick, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 text-base font-extrabold tracking-wide transition-[transform,filter,box-shadow] duration-100 disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${className}`}
      onClick={(event) => {
        if (!silent) audio.play("uiClick");
        onClick?.(event);
      }}
      {...props}
    />
  );
}
