export interface Banner {
    id: string;
    title: string;
    imageUrl: string;
    order: number; // Display order (1, 2, 3...)
    isActive: boolean;

    // Action Configuration
    actionType: 'products' | 'flash_sale' | 'url' | 'none';
    actionData: {
        productIds?: string[]; // For actionType = 'products'
        url?: string; // For actionType = 'url'
    };

    // Schedule (optional)
    startDate?: Date | null;
    endDate?: Date | null;

    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export interface CreateBannerInput {
    title: string;
    imageUrl: string;
    actionType: 'products' | 'flash_sale' | 'url' | 'none';
    actionData: {
        productIds?: string[];
        url?: string;
    };
    startDate?: Date | null;
    endDate?: Date | null;
}
