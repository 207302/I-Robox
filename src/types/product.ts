

export type Product = {
  id: string;
  title: string;
  price: number;
  discountedPrice?: number | null;
  shippingPerUnit?: number;
  slug: string;
  quantity: number;
  maxOrderQuantity?: number;
  brandId?: string | null;
  updatedAt: Date;
  reviews: number;
  shortDescription: string;
  ageGroup?: string | null;
  /** Diecast model scale, e.g. 1:64 */
  diecastScale?: string | null;
  /** Optional catalog taxonomy (when loaded from API). */
  category?: { name: string; slug: string } | null;
  productType?: { name: string; slug: string } | null;
  productSubtype?: { name: string; slug: string } | null;
  collection?: { name: string; slug: string } | null;
  /** Cover image URL for thumbnails/cards (first product_image by sort_order). */
  image?: string;
  productVariants: {
    id: string;
    name?: string;
    color: string;
    image: string;
    images?: string[];
    size: string;
    isDefault: boolean;
  }[];
  product_images?: {
    url: string;
    sort_order: number;
    product_variant_id?: string | null;
  }[];
};
