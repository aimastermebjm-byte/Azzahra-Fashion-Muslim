// Stock Opname Types

export interface StockOpnameSession {
    id: string;
    createdAt: Date;
    createdBy: string;
    createdByName: string;
    status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: Date;
    rejectedReason?: string;
    notes?: string;
    items: StockOpnameItem[];
    totalItems: number;
    countedItems: number;
    itemsWithDifference: number;
}

// Setiap kombinasi SIZE + VARIAN = 1 baris
export interface StockOpnameItem {
    productId: string;
    productName: string;
    productImage: string;
    size: string;            // "L", "M", "S", "XL"
    variant: string;         // "Pink", "Hitam" ATAU "A", "B", "C", "D"
    systemStock: number;
    actualStock: number | null;  // null = belum dihitung
    difference: number | null;
    notes?: string;
    countedAt?: Date;
}
