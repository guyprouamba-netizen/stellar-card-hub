export type ShopProduct = {
  id: string; name: string; slug: string; description: string | null;
  price: number; currency: string; project_id?: string | null; media?: any;
  category_id?: string | null;
};

export type ShopTheme = {
  bg: string; surface: string; text: string; muted: string; primary: string; primary_text: string;
  [k: string]: any;
};

export type ShopLayoutProps = {
  biz: any;
  th: ShopTheme;
  products: ShopProduct[];
  categories: { id: string; name: string; slug: string; position: number }[];
  activeCategory: string | null;
  setActiveCategory: (id: string | null) => void;
  onSelect: (p: ShopProduct) => void;
};

export const money = (p: ShopProduct) =>
  `${Number(p.price).toLocaleString("fr-FR")} ${p.currency}`;