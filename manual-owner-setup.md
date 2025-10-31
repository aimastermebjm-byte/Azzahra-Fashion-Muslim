# Manual Owner User Setup for Cache Management

## Problem
User `mFMzpiBNbKZeuotZwc0jPPJwQfn2` (v4hrin@gmail.com) exists in Firebase Auth but not in Firestore `users` collection with `role: owner`.

## Solution: Manual Setup via Firebase Console

### Step 1: Open Firebase Console
1. Go to: https://console.firebase.google.com/project/azzahra-fashion-muslim-ab416/firestore
2. Select the database (should be already selected)

### Step 2: Create User Document
1. Click **"Start collection"** if no data exists, or **"+ Add document"**
2. Collection ID: `users`
3. Document ID: `mFMzpiBNbKZeuotZwc0jPPJwQfn2`

### Step 3: Add Fields
Add these fields with their values:

| Field | Type | Value |
|-------|------|-------|
| uid | String | mFMzpiBNbKZeuotZwc0jPPJwQfn2 |
| email | String | v4hrin@gmail.com |
| displayName | String | v4hrin |
| name | String | v4hrin |
| role | String | owner |
| createdAt | Timestamp | [Current timestamp] |
| updatedAt | Timestamp | [Current timestamp] |
| isActive | Boolean | true |
| phone | String | (empty) |
| address | String | (empty) |

### Step 4: Save
1. Click **"Save"**
2. Wait for confirmation

### Step 5: Test Cache Management
1. Go to your application
2. Login as v4hrin@gmail.com
3. Go to Account → Owner Tools → Cache Management
4. Should work without "User not found" error

## Verification
After setup, you can verify by checking the document exists in Firestore with correct `role: owner`.

## Alternative: Using Firebase CLI
If you have Firebase CLI installed, you can also run:

```bash
firebase firestore:import --project azzahra-fashion-muslim-ab416 users.json
```

Where `users.json` contains the user data.