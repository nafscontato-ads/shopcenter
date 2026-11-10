import type { ImgHTMLAttributes } from "react";
import { thumbUrl } from "@/lib/image-thumb";

/** List/grid product photo: loads the supplier's small copy and falls back to the original if it is missing. */
export function ThumbImg({ src, size = 300, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | null | undefined; size?: number }) {
  const original = src ?? "";
  return (
    <img
      loading="lazy"
      decoding="async"
      {...props}
      src={thumbUrl(original, size)}
      onError={(event) => {
        const img = event.currentTarget;
        if (original && img.src !== original) img.src = original;
      }}
    />
  );
}
