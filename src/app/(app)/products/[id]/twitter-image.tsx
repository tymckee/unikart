import {
  OG_ALT,
  OG_CONTENT_TYPE,
  OG_SIZE,
  cardImageUrl,
  renderOgImage,
  renderProductOgImage,
} from "@/lib/og";
import { getProductView } from "@/lib/data";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProductView(id);
  if (!p) return renderOgImage();

  return renderProductOgImage({
    title: p.title,
    storeName: p.storeName,
    storeDomain: p.storeDomain,
    brand: p.brand,
    category: p.category,
    imageUrl: cardImageUrl(p),
    currency: p.currency,
    currentPrice: p.currentPrice,
    previousPrice: p.previousPrice,
    availability: p.availability,
  });
}
