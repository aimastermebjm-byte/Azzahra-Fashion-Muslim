import { useState, useEffect } from 'react';
import { Product, FlashSale } from '../types';

// Mock data untuk testing - nanti bisa diganti dengan Firebase
const initialMockProducts: Product[] = [
  {
    id: '1',
    name: 'Hijab Segi Empat Premium',
    description: 'Hijab segi empat berbahan premium dengan kualitas terbaik. Nyaman dipakai sehari-hari.',
    category: 'hijab',
    images: [
      'https://images.pexels.com/photos/8839887/pexels-photo-8839887.jpeg?auto=compress&cs=tinysrgb&w=400',
      'https://images.pexels.com/photos/8839888/pexels-photo-8839888.jpeg?auto=compress&cs=tinysrgb&w=400'
    ],
    variants: {
      sizes: ['S', 'M', 'L'],
      colors: ['Hitam', 'Putih', 'Navy', 'Coklat']
    },
    retailPrice: 85000,
    resellerPrice: 65000,
    costPrice: 45000,
    stock: 25,
    status: 'ready',
    isFlashSale: false,
    flashSalePrice: 0,
    createdAt: new Date(),
    salesCount: 15,
    isFeatured: true,
    featuredOrder: 1
  },
  {
    id: '2',
    name: 'Gamis Syari Elegant',
    description: 'Gamis syari dengan desain elegant dan modern. Cocok untuk acara formal maupun casual.',
    category: 'gamis',
    images: [
      'https://images.pexels.com/photos/9594673/pexels-photo-9594673.jpeg?auto=compress&cs=tinysrgb&w=400',
      'https://images.pexels.com/photos/9594674/pexels-photo-9594674.jpeg?auto=compress&cs=tinysrgb&w=400'
    ],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Hitam', 'Navy', 'Maroon', 'Olive']
    },
    retailPrice: 250000,
    resellerPrice: 200000,
    costPrice: 150000,
    stock: 15,
    status: 'ready',
    isFlashSale: true,
    flashSalePrice: 199000,
    createdAt: new Date(),
    salesCount: 28,
    isFeatured: true,
    featuredOrder: 2
  },
  {
    id: '3',
    name: 'Khimar Instant Premium',
    description: 'Khimar instant dengan bahan premium, mudah dipakai dan nyaman.',
    category: 'khimar',
    images: [
      'https://images.pexels.com/photos/8839889/pexels-photo-8839889.jpeg?auto=compress&cs=tinysrgb&w=400'
    ],
    variants: {
      sizes: ['One Size'],
      colors: ['Hitam', 'Putih', 'Abu-abu', 'Coklat']
    },
    retailPrice: 120000,
    resellerPrice: 95000,
    costPrice: 70000,
    stock: 8,
    status: 'po',
    estimatedReady: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isFlashSale: false,
    flashSalePrice: 0,
    createdAt: new Date(),
    salesCount: 8
  },
  {
    id: '4',
    name: 'Tunik Casual Modern',
    description: 'Tunik dengan desain casual modern, cocok untuk aktivitas sehari-hari.',
    category: 'tunik',
    images: [
      'https://images.pexels.com/photos/9594675/pexels-photo-9594675.jpeg?auto=compress&cs=tinysrgb&w=400'
    ],
    variants: {
      sizes: ['S', 'M', 'L'],
      colors: ['Putih', 'Cream', 'Pink', 'Lavender']
    },
    retailPrice: 180000,
    resellerPrice: 145000,
    costPrice: 110000,
    stock: 20,
    status: 'ready',
    isFlashSale: true,
    flashSalePrice: 149000,
    createdAt: new Date(),
    salesCount: 22,
    isFeatured: true,
    featuredOrder: 3
  },
  {
    id: '5',
    name: 'Abaya Dubai Premium',
    description: 'Abaya dengan gaya Dubai yang elegant dan mewah.',
    category: 'abaya',
    images: [
      'https://images.pexels.com/photos/8839890/pexels-photo-8839890.jpeg?auto=compress&cs=tinysrgb&w=400'
    ],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Hitam', 'Navy', 'Maroon']
    },
    retailPrice: 350000,
    resellerPrice: 280000,
    costPrice: 220000,
    stock: 12,
    status: 'ready',
    isFlashSale: false,
    flashSalePrice: 0,
    createdAt: new Date(),
    salesCount: 18,
    isFeatured: true,
    featuredOrder: 4
  },
  {
    id: '6',
    name: 'Hijab Pashmina Silk',
    description: 'Hijab pashmina berbahan silk yang lembut dan nyaman.',
    category: 'hijab',
    images: [
      'https://images.pexels.com/photos/8839891/pexels-photo-8839891.jpeg?auto=compress&cs=tinysrgb&w=400'
    ],
    variants: {
      sizes: ['One Size'],
      colors: ['Dusty Pink', 'Sage Green', 'Cream', 'Lavender']
    },
    retailPrice: 95000,
    resellerPrice: 75000,
    costPrice: 55000,
    stock: 30,
    status: 'ready',
    isFlashSale: true,
    flashSalePrice: 79000,
    createdAt: new Date(),
    salesCount: 35
  },
  {
    id: '7',
    name: 'Gamis Katun Jepang',
    description: 'Gamis dengan bahan katun jepang yang adem dan nyaman dipakai sehari-hari.',
    category: 'gamis',
    images: [
      'https://images.pexels.com/photos/9594676/pexels-photo-9594676.jpeg?auto=compress&cs=tinysrgb&w=400',
      'https://images.pexels.com/photos/9594677/pexels-photo-9594677.jpeg?auto=compress&cs=tinysrgb&w=400'
    ],
    variants: {
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Biru BCA', 'Maroon', 'Mustard', 'Tosca', 'Abu-abu']
    },
    retailPrice: 275000,
    resellerPrice: 220000,
    costPrice: 175000,
    stock: 18,
    status: 'ready',
    isFlashSale: false,
    flashSalePrice: 0,
    createdAt: new Date()
  },
  {
    id: '8',
    name: 'Setelan Kuliah (Gamis + Khimar)',
    description: 'Setelan gamis dan khimar cocok untuk kuliah atau aktivitas formal.',
    category: 'gamis',
    images: [
      'https://images.pexels.com/photos/9594678/pexels-photo-9594678.jpeg?auto=compress&cs=tinysrgb&w=400'
    ],
    variants: {
      sizes: ['S', 'M', 'L'],
      colors: ['Army', 'Silver', 'Milo', 'Black']
    },
    retailPrice: 325000,
    resellerPrice: 260000,
    costPrice: 200000,
    stock: 10,
    status: 'po',
    estimatedReady: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    isFlashSale: true,
    flashSalePrice: 275000,
    createdAt: new Date()
  },
  // Tambahkan produk duplikat untuk testing pagination
  ...[...Array(12)].map((_, i) => ({
    id: `9-${i}`,
    name: `Hijab Segi Empat Premium Variasi ${i + 1}`,
    description: `Hijab segi empat berbahan premium dengan kualitas terbaik. Nyaman dipakai sehari-hari. Varian warna ${['Dusty Rose', 'Milo', 'Sage', 'Navy', 'Maroon', 'Tosca', 'Mustard', 'Terracotta', 'Cream', 'Black', 'White', 'Gray'][i]}.`,
    category: 'hijab',
    images: [
      `https://images.pexels.com/photos/${8839887 + i}/pexels-photo-${8839887 + i}.jpeg?auto=compress&cs=tinysrgb&w=400`,
      `https://images.pexels.com/photos/${8839888 + i}/pexels-photo-${8839888 + i}.jpeg?auto=compress&cs=tinysrgb&w=400`
    ],
    variants: {
      sizes: ['S', 'M', 'L'],
      colors: ['Hitam', 'Putih', 'Navy', 'Coklat', 'Maroon', 'Cream', 'Gray', 'Pink', 'Purple', 'Green']
    },
    retailPrice: 75000 + (i * 5000),
    resellerPrice: 55000 + (i * 4000),
    costPrice: 35000 + (i * 3000),
    stock: 15 + (i * 2),
    status: i % 2 === 0 ? 'ready' : 'po',
    isFlashSale: i % 3 === 0,
    flashSalePrice: (75000 + (i * 5000)) * 0.8,
    createdAt: new Date()
  })),
  ...[...Array(10)].map((_, i) => ({
    id: `10-${i}`,
    name: `Gamis Casual Modern Series ${i + 1}`,
    description: `Gamis casual dengan desain modern dan modis. Cocok untuk aktivitas sehari-hari. Material ${['Katun', 'Woolpeach', 'Moscrepe', 'Baloteli', 'Denim', 'Linen', 'Satin', 'Brokat', 'Tille', 'Chiffon'][i]}.`,
    category: 'gamis',
    images: [
      `https://images.pexels.com/photos/${9594673 + i}/pexels-photo-${9594673 + i}.jpeg?auto=compress&cs=tinysrgb&w=400`,
      `https://images.pexels.com/photos/${9594674 + i}/pexels-photo-${9594674 + i}.jpeg?auto=compress&cs=tinysrgb&w=400`
    ],
    variants: {
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'Navy', 'Maroon', 'Army', 'Silver', 'Milo', 'Tosca', 'Purple', 'Pink', 'Brown']
    },
    retailPrice: 180000 + (i * 10000),
    resellerPrice: 140000 + (i * 8000),
    costPrice: 100000 + (i * 7000),
    stock: 20 + (i * 3),
    status: 'ready',
    isFlashSale: i % 2 === 0,
    flashSalePrice: (180000 + (i * 10000)) * 0.85,
    createdAt: new Date()
  }))
];

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>(initialMockProducts);
  const [loading, setLoading] = useState(true);
  const [flashSaleEvents, setFlashSaleEvents] = useState<any[]>([]);

  const updateProductStock = (productId: string, quantity: number) => {
    setProducts(prev => 
      prev.map(product => 
        product.id === productId 
          ? { ...product, stock: Math.max(0, product.stock - quantity) }
          : product
      )
    );
  };

  const applyFlashSaleToProducts = (flashSale: FlashSale, forceUpdate = false) => {
    console.log('Applying flash sale:', flashSale);
    console.log('Products before flash sale:', products.map(p => ({ id: p.id, name: p.name, retailPrice: p.retailPrice, isFlashSale: p.isFlashSale })));
    
    setProducts(prev => 
      prev.map(product => {
        if (flashSale.productIds.includes(product.id)) {
          // Store original prices if not already stored
          const originalRetailPrice = product.originalRetailPrice || product.retailPrice;
          const originalResellerPrice = product.originalResellerPrice || product.resellerPrice;
          
          let flashSalePrice = originalRetailPrice;
          let newRetailPrice = originalRetailPrice;
          
          if (flashSale.discountType === 'percentage') {
            flashSalePrice = Math.round(originalRetailPrice * (1 - flashSale.discountValue / 100));
            newRetailPrice = flashSalePrice;
          } else {
            flashSalePrice = Math.max(0, originalRetailPrice - flashSale.discountValue);
            newRetailPrice = flashSalePrice;
          }
          
          console.log(`Product ${product.name}: ${originalRetailPrice} -> ${flashSalePrice}`);
          
          const updatedProduct = {
            ...product,
            isFlashSale: true,
            flashSalePrice: flashSalePrice,
            retailPrice: flashSalePrice,
            originalRetailPrice,
            originalResellerPrice
          };
          
          console.log('Updated product:', updatedProduct);
          
          return updatedProduct;
        }
        return product;
      })
    );
    
    // Force re-render after state update
    setTimeout(() => {
      console.log('Products after flash sale update:', products.filter(p => flashSale.productIds.includes(p.id)));
    }, 100);
  };

  const removeFlashSaleFromProducts = (productIds: string[]) => {
    console.log('Removing flash sale from products:', productIds);
    setProducts(prev => 
      prev.map(product => {
        if (productIds.includes(product.id) && product.isFlashSale) {
          return {
            ...product,
            isFlashSale: false,
            flashSalePrice: 0,
            retailPrice: product.originalRetailPrice || product.retailPrice,
            resellerPrice: product.originalResellerPrice || product.resellerPrice,
            originalRetailPrice: undefined,
            originalResellerPrice: undefined
          };
        }
        return product;
      })
    );
  };

  useEffect(() => {
    // Simulate API call
    const fetchProducts = async () => {
      setLoading(true);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProducts(initialMockProducts);
      setLoading(false);
    };

    fetchProducts();
  }, []);

  // Listen for flash sale events from AdminContext
  useEffect(() => {
    const handleFlashSaleCreated = (event: any) => {
      console.log('Flash sale created event:', event.detail);
      const flashSale = event.detail;
      
      // Add to events for tracking
      setFlashSaleEvents(prev => [...prev, { type: 'created', flashSale, timestamp: new Date() }]);
      
      // Apply immediately
      applyFlashSaleToProducts(flashSale);
      
      // Force update after a short delay
      setTimeout(() => {
        setProducts(currentProducts => {
          console.log('Force updating products after flash sale creation');
          return currentProducts.map(product => {
            if (flashSale.productIds.includes(product.id)) {
              const originalRetailPrice = product.originalRetailPrice || product.retailPrice;
              let flashSalePrice = originalRetailPrice;
              
              if (flashSale.discountType === 'percentage') {
                flashSalePrice = Math.round(originalRetailPrice * (1 - flashSale.discountValue / 100));
              } else {
                flashSalePrice = Math.max(0, originalRetailPrice - flashSale.discountValue);
              }
              
              return {
                ...product,
                isFlashSale: true,
                flashSalePrice: flashSalePrice,
                retailPrice: flashSalePrice,
                originalRetailPrice: originalRetailPrice,
                originalResellerPrice: product.originalResellerPrice || product.resellerPrice
              };
            }
            return product;
          });
        });
      }, 500);
    };

    const handleFlashSaleUpdated = (event: any) => {
      console.log('Flash sale updated event:', event.detail);
      const flashSale = event.detail;
      
      setFlashSaleEvents(prev => [...prev, { type: 'updated', flashSale, timestamp: new Date() }]);
      
      if (flashSale.isActive) {
        applyFlashSaleToProducts(flashSale);
      } else {
        removeFlashSaleFromProducts(flashSale.productIds);
      }
    };

    const handleFlashSaleDeleted = (event: any) => {
      console.log('Flash sale deleted event:', event.detail);
      const flashSale = event.detail;
      
      setFlashSaleEvents(prev => [...prev, { type: 'deleted', flashSale, timestamp: new Date() }]);
      removeFlashSaleFromProducts(flashSale.productIds);
    };

    // Use more specific event handling
    const handleFlashSaleCreatedWrapper = (event: CustomEvent) => handleFlashSaleCreated(event);
    const handleFlashSaleUpdatedWrapper = (event: CustomEvent) => handleFlashSaleUpdated(event);
    const handleFlashSaleDeletedWrapper = (event: CustomEvent) => handleFlashSaleDeleted(event);

    window.addEventListener('flashSaleCreated', handleFlashSaleCreatedWrapper as EventListener);
    window.addEventListener('flashSaleUpdated', handleFlashSaleUpdatedWrapper as EventListener);
    window.addEventListener('flashSaleDeleted', handleFlashSaleDeletedWrapper as EventListener);

    return () => {
      window.removeEventListener('flashSaleCreated', handleFlashSaleCreatedWrapper as EventListener);
      window.removeEventListener('flashSaleUpdated', handleFlashSaleUpdatedWrapper as EventListener);
      window.removeEventListener('flashSaleDeleted', handleFlashSaleDeletedWrapper as EventListener);
    };
  }, [applyFlashSaleToProducts, removeFlashSaleFromProducts]);

  return { 
    products, 
    loading, 
    updateProductStock, 
    applyFlashSaleToProducts,
    removeFlashSaleFromProducts,
    flashSaleEvents
  };
};