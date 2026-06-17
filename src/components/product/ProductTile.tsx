import Image from "next/image";
import {
  Armchair,
  BookOpen,
  Blocks,
  CookingPot,
  Footprints,
  Gamepad2,
  Headphones,
  House,
  Luggage,
  Package,
  Shirt,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WheelLogo } from "@/components/brand/WheelLogo";

interface Art {
  from: string;
  to: string;
  fg: string;
  Icon: LucideIcon;
}

const CATEGORY_ART: Record<string, Art> = {
  Headphones: { from: "#EAF0FA", to: "#C9D8F0", fg: "#3E5C8A", Icon: Headphones },
  Home: { from: "#F3EEE7", to: "#E2D5C4", fg: "#8A6F4E", Icon: House },
  Kitchen: { from: "#F6ECEA", to: "#ECCFC6", fg: "#A85C46", Icon: CookingPot },
  Office: { from: "#ECF1EF", to: "#CFDED6", fg: "#4E7A66", Icon: Armchair },
  Gaming: { from: "#F0EAF7", to: "#D8C8EE", fg: "#6A4E9A", Icon: Gamepad2 },
  Apparel: { from: "#F8ECF0", to: "#ECC9D6", fg: "#9A4E6E", Icon: Shirt },
  Toys: { from: "#FBF1E3", to: "#F2D9B0", fg: "#B07A2E", Icon: Blocks },
  "E-reader": { from: "#E8F2F1", to: "#C6E0DD", fg: "#3E7A74", Icon: BookOpen },
  Travel: { from: "#E9F1FA", to: "#C8DEF2", fg: "#3E6E9A", Icon: Luggage },
  Footwear: { from: "#EEF2E9", to: "#D6E2C6", fg: "#5C7A3E", Icon: Footprints },
};

const DEFAULT_ART: Art = {
  from: "#F1F2F4",
  to: "#DDE0E6",
  fg: "#6E737C",
  Icon: Package,
};

interface ProductTileProps {
  category?: string | null;
  imageUrl?: string | null;
  title: string;
  storeName?: string;
  className?: string;
  iconSize?: number;
  /** Show the quiet wheel watermark. */
  watermark?: boolean;
}

/**
 * Branded product artwork. Uses a real image when the parser provides
 * one; otherwise renders a calm, category-tinted gradient tile with a
 * thin-line glyph and a quiet wheel watermark.
 */
export function ProductTile({
  category,
  imageUrl,
  title,
  storeName,
  className,
  iconSize = 56,
  watermark = true,
}: ProductTileProps) {
  const art = (category && CATEGORY_ART[category]) || DEFAULT_ART;
  const { from, to, fg, Icon } = art;

  if (imageUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-canvas", className)}>
        <Image
          src={imageUrl}
          alt={title}
          fill
          unoptimized
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 320px"
        />
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 120% at 28% 18%, ${from} 0%, ${to} 78%)`,
      }}
      aria-label={title}
    >
      {storeName && (
        <span
          className="absolute left-3 top-3 inline-flex h-6 items-center rounded-full bg-white/70 px-2 text-[0.625rem] font-semibold backdrop-blur-sm"
          style={{ color: fg }}
        >
          {storeName}
        </span>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon
          size={iconSize}
          strokeWidth={1.25}
          style={{ color: fg }}
          className="opacity-80"
          aria-hidden="true"
        />
      </div>
      {watermark && (
        <span
          className="pointer-events-none absolute -bottom-5 -right-5 opacity-[0.08]"
          style={{ color: fg }}
        >
          <WheelLogo size={64} />
        </span>
      )}
    </div>
  );
}
