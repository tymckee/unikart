import { cn } from "@/lib/utils";
import type { ProductView } from "@/lib/types";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: ProductView[];
  className?: string;
  empty?: React.ReactNode;
}

export function ProductGrid({ products, className, empty }: ProductGridProps) {
  if (products.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
