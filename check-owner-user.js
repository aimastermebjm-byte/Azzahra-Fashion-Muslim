// Check and create owner user in Firestore for cache management access

const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

// User data from error log
const USER_DATA = {
  uid: 'mFMzpiBNbKZeuotZwc0jPPJwQfn2',
  email: 'v4hrin@gmail.com',
  displayName: 'v4hrin',
  role: 'owner'
};

async function checkUserExists() {
  console.log('🔍 Checking if user exists in Firestore...');
  console.log('User ID:', USER_DATA.uid);

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${USER_DATA.uid}?key=${FIREBASE_API_KEY}`;

  try {
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ User found in Firestore!');
      console.log('User data:');

      Object.keys(data.fields).forEach(key => {
        const value = data.fields[key];
        let actualValue;
        if (value.stringValue) actualValue = value.stringValue;
        else if (value.booleanValue) actualValue = value.booleanValue;
        else if (value.timestampValue) actualValue = value.timestampValue;
        else actualValue = value;

        console.log(`  ${key}: ${actualValue}`);
      });

      const userRole = data.fields.role?.stringValue;
      console.log('\n🎯 User Role Analysis:');
      console.log(`Current role: "${userRole}"`);
      console.log(`Expected role: "owner"`);

      if (userRole === 'owner') {
        console.log('✅ User has correct role - Cache Management should work!');
      } else {
        console.log('❌ User role mismatch - need to update to owner');
        console.log('Updating role to owner...');
        await updateUserRole();
      }
    } else {
      console.log('❌ User not found in Firestore');
      console.log('Creating user with owner role...');
      await createOwnerUser();
    }
  } catch (error) {
    console.error('❌ Error checking user:', error);
  }
}

async function createOwnerUser() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${USER_DATA.uid}?key=${FIREBASE_API_KEY}`;

  const firestoreData = {
    fields: {
      uid: { stringValue: USER_DATA.uid },
      email: { stringValue: USER_DATA.email },
      displayName: { stringValue: USER_DATA.displayName },
      name: { stringValue: USER_DATA.displayName },
      role: { stringValue: USER_DATA.role },
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
      isActive: { booleanValue: true },
      phone: { stringValue: '' },
      address: { stringValue: '' }
    }
  };

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreData)
    });

    if (response.ok) {
      console.log('✅ Owner user created successfully!');
      await checkUserExists(); // Verify creation
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to create user:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Error creating user:', error);
  }
}

async function updateUserRole() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${USER_DATA.uid}?key=${FIREBASE_API_KEY}`;

  const updateData = {
    fields: {
      role: { stringValue: 'owner' },
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  };

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (response.ok) {
      console.log('✅ User role updated to owner successfully!');
      await checkUserExists(); // Verify update
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to update role:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Error updating role:', error);
  }
}

// Run the check
checkUserExists().then(() => {
  console.log('\n🎉 User verification completed!');
}).catch(error => {
  console.error('❌ Fatal error:', error);
});