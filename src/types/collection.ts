// Collection Type Definition
// Used for grouping products into named collections (e.g., "Mukena Favorit", "Promo Ramadhan")

export interface Collection {
    id: string;
    name: string;           // "Mukena Diskon 100rb"
    description?: string;   // Optional description
    productIds: string[];   // Array of product IDs in this collection
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateCollectionInput {
    name: string;
    description?: string;
    productIds: string[];
}
