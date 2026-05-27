export interface Review {
  id: string;
  productId: string;
  authorName: string;
  rating: number; // 1..5
  title: string;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
}
