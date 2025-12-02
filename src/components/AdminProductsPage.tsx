// Import diagnostik function
import { forceSyncAllProducts } from '../services/globalIndexSync';

// Tambahkan tombol debug di UI
const AdminProductsPage: React.FC<AdminProductsPageProps> = ({ onBack, user }) => {
  // ... existing imports dan state
  console.log('🔧 DEBUG MODE ENABLED - Additional sync controls available');

  // ... gunakan fungsi forceSyncAllProducts
  const forceSyncGlobalIndex = async () => {
    console.log('🔄 FORCING SYNC FROM BATCH_1 TO GLOBALINDEX...');
    const syncCount = await forceSyncAllProducts();
    console.log(`✅ Force sync completed: ${syncCount} products synced`);

    // Refresh halaman untuk melihat perubahan
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  // ... return existing JSX dengan tambahan tombol debug
  return (
    <div className="container mx-auto p-4">
      {/* ... existing UI components */}

      {/* Tombol Debug Baru */}
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-yellow-800">🔧 DEBUG MODE</h3>
          <span className="text-xs text-yellow-600">Sync Controls</span>
        </div>
        <div className="flex gap-2 mb-4">
          <button
            onClick={forceSyncGlobalIndex}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium"
          >
            🔄 Force Sync All Products
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
          >
            🔄 Refresh Page
          </button>
        </div>
        <div className="text-xs text-yellow-600">
          This will sync all 23 products from batch_1 to globalindex collection
        </div>
      </div>
    </div>
  );
};