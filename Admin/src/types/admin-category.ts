export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  productCount: number;
  children: AdminCategory[];
}

export interface CreateCategoryBody {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  isActive?: boolean;
}

export interface UpdateCategoryBody {
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  isActive?: boolean;
}

export interface ReorderCategoriesBody {
  items: Array<{ id: string; sortOrder: number }>;
}
