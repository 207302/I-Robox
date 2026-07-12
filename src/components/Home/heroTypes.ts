export type HeroSlide = {
  id: string;
  image_url: string;
  /** Optional dedicated mobile banner; falls back to image_url when missing. */
  mobile_image_url?: string | null;
  image_srcSet?: string;
  title?: string | null;
  link_url?: string | null;
};
