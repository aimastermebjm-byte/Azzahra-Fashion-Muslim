// Script untuk membuat user testing di Firebase
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { initializeApp } = require('firebase/app');

// Firebase config - ambil dari .env atau firebase config
const firebaseConfig = {
  // Ambil dari project settings
  apiKey: "AIzaSyCYhJjHQ7oqQj3nQZkPjTnR8xKjIwYfXc",
  authDomain: "azzahra-fashion-muslim-ab416.firebaseapp.com",
  projectId: "azzahra-fashion-muslim-ab416",
  storageBucket: "azzahra-fashion-muslim-ab416.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Test users to create
const testUsers = [
  { email: 'admin@azzahra.com', password: 'admin123', displayName: 'Admin User' },
  { email: 'reseller@azzahra.com', password: 'reseller123', displayName: 'Reseller User' },
  { email: 'customer@gmail.com', password: 'customer123', displayName: 'Customer User' }
];

async function createTestUsers() {
  console.log('🔥 Creating test users...');

  for (const user of testUsers) {
    try {
      console.log(`Creating user: ${user.email}`);
      const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);

      if (userCredential.user) {
        await userCredential.user.updateProfile({ displayName: user.displayName });
        console.log(`✅ User created: ${user.email}`);
      }
    } catch (error) {
      console.log(`❌ Error creating ${user.email}:`, error.message);
    }
  }

  console.log('🎉 Test users creation completed!');
}

createTestUsers().catch(console.error);