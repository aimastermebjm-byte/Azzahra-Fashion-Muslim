import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from './firebaseClient';

const db = getFirestore(firebaseApp);

// Product data from the images you provided
const dummyProducts = [
  {
    id: 'product-1',
    name: 'Gamis Premium Muslimah',
    description: 'Gamis muslimah premium dengan bahan berkualitas tinggi, nyaman dipakai untuk harian maupun acara formal',
    price: 289000,
    category: 'gamis',
    stock: 25,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/6aa981963d6c9bde06dd92e653b5824a.jpg',
    featured: true,
    rating: 4.8,
    reviews: 124,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Black', 'Navy', 'Maroon'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-2',
    name: 'Hijab Syari Premium',
    description: 'Hijab syari dengan material premium yang adem dan tidak mudah kusut, tersedia berbagai warna elegan',
    price: 125000,
    category: 'hijab',
    stock: 50,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/ca0f2e186752a3c82f5199e5934affd8.jpg',
    featured: true,
    rating: 4.9,
    reviews: 89,
    sizes: ['One Size'],
    colors: ['Pink', 'Beige', 'Gray', 'Navy'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-3',
    name: 'Koko Lengan Pendek Modern',
    description: 'Koko lengan pendek dengan desain modern, nyaman dipakai untuk shalat dan aktivitas harian',
    price: 185000,
    category: 'koko',
    stock: 30,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/2b18fa7e4b48b14f707c2d0e68652a8c.jpg',
    featured: false,
    rating: 4.6,
    reviews: 67,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['White', 'Light Blue', 'Gray'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-4',
    name: 'Mukena Travel Premium',
    description: 'Mukena travel yang praktis dan mudah dibawa, material lembut dan nyaman untuk ibadah',
    price: 220000,
    category: 'mukena',
    stock: 20,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/874f904363f0cb1dab5a591aa3ad1739.jpg',
    featured: true,
    rating: 4.7,
    reviews: 156,
    sizes: ['One Size'],
    colors: ['Pink', 'Purple', 'Green'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-5',
    name: 'Sajadah Premium Tebal',
    description: 'Sajadah dengan bahan tebal dan lembut, anti slip dan nyaman untuk shalat berjamaah',
    price: 95000,
    category: 'prayer-mat',
    stock: 40,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/b809d9dcd64fceba080dfc60dd5a1789.jpg',
    featured: false,
    rating: 4.5,
    reviews: 43,
    sizes: ['Standard'],
    colors: ['Green', 'Blue', 'Brown', 'Red'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-6',
    name: 'Gamis Katun Jepang',
    description: 'Gamis dengan bahan katun jepang premium, breathable dan nyaman dipakai seharian',
    price: 320000,
    category: 'gamis',
    stock: 18,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/3764d0818c14dd7b435ae31ef908ae64.jpg',
    featured: true,
    rating: 4.9,
    reviews: 201,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Maroon', 'Navy', 'Black', 'Misty'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-7',
    name: 'Pashmina Instan Premium',
    description: 'Pashmina instan dengan pet antem, praktis dipakai dan elegan untuk berbagai acara',
    price: 145000,
    category: 'hijab',
    stock: 35,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/1116c4a4f5ab412b96d4bf699083473e.jpg',
    featured: false,
    rating: 4.6,
    reviews: 78,
    sizes: ['One Size'],
    colors: ['Cream', 'Peach', 'Mint', 'Lavender'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-8',
    name: 'Setelan Koko Anak',
    description: 'Setelan koko anak dengan bahan nyaman dan desain lucu, tersedia berbagai ukuran',
    price: 155000,
    category: 'koko',
    stock: 25,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/f6ce47a6787b166a7150c60510ef8255.jpg',
    featured: false,
    rating: 4.7,
    reviews: 92,
    sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'],
    colors: ['Blue', 'Green', 'Orange'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-9',
    name: 'Mukena Katun Jepang',
    description: 'Mukena katun jepang dengan bordir manual yang halus dan elegant, nyaman untuk ibadah',
    price: 350000,
    category: 'mukena',
    stock: 15,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/99943805b75ba5fff60db59e80427a2f.jpg',
    featured: true,
    rating: 4.8,
    reviews: 145,
    sizes: ['One Size'],
    colors: ['White', 'Pink', 'Purple'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'product-10',
    name: 'Tas Muslimah Multifungsi',
    description: 'Tas muslimah dengan banyak kompartemen, praktis untuk menyimpan perlengkapan shalat',
    price: 175000,
    category: 'accessories',
    stock: 22,
    image: 'https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/c7b15768-3be0-449d-9a7d-afdb021716c2/e6d827f44d3070ac229a11f0744fd18e.jpg',
    featured: false,
    rating: 4.4,
    reviews: 56,
    sizes: ['One Size'],
    colors: ['Black', 'Brown', 'Navy'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const addDummyProducts = async () => {
  try {
    console.log('🔄 Starting to add dummy products to Firebase...');

    const productsCollection = collection(db, 'products');
    let successCount = 0;

    for (const product of dummyProducts) {
      try {
        await setDoc(doc(productsCollection, product.id), product);
        console.log(`✅ Successfully added product: ${product.name}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to add product ${product.name}:`, error);
      }
    }

    console.log(`🎉 Finished! Added ${successCount}/${dummyProducts.length} products to Firebase`);
    return successCount;
  } catch (error) {
    console.error('❌ Error adding dummy products:', error);
    throw error;
  }
};

// Auto-run if this file is executed directly
if (typeof window === 'undefined') {
  addDummyProducts().catch(console.error);
}