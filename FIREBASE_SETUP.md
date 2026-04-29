# Firebase Configuration Guide

## 🚨 CRITICAL: Configure Firebase Security Rules

The app is showing errors like:
- **"Missing or insufficient permissions"** (Firestore)
- **"User does not have permission to access" / storage/unauthorized** (Storage)

This is because Firebase Firestore and Storage security rules are not configured yet.

**This is normal for new Firebase projects!** Follow the steps below to fix it in 2 minutes.

### Common Errors and Solutions

| Error Message | Solution |
|---------------|----------|
| `Missing or insufficient permissions` | Configure Firestore rules (Step 2) |
| `storage/unauthorized` | Configure Storage rules (Step 3) |
| `User does not have permission to access` | Configure Storage rules (Step 3) |

## How to Fix

### Step 1: Go to Firebase Console
1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **barber-app-6993a**

### Step 2: Configure Firestore Rules (REQUIRED)
1. In Firebase Console, click **Firestore Database** in the left sidebar
2. If you don't see Firestore, click **Create Database** → **Start in test mode** → Select a region
3. Click the **Rules** tab at the top
4. Replace ALL existing rules with one of the options below:

### ✅ Option 1: Public Read, Authenticated Write (Recommended for Production)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read shops and barbers
    match /shops/{shop} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /barbers/{barber} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### ⚡ Option 2: Open Access (Quick Testing - Less Secure)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Warning**: Option 2 is only for testing. Use Option 1 for production!

### Step 3: Configure Storage Rules (REQUIRED for image uploads)
1. In Firebase Console, click **Storage** in the left sidebar
2. If you don't see Storage, click **Get Started** → **Start in test mode**
3. Click the **Rules** tab at the top
4. Replace ALL existing rules with one of the options below:

### ✅ Option 1: Public Read/Write for Shops (Quick Setup)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /shops/{allPaths=**} {
      allow read: if true;
      allow write: if true;  // Allows staff portal uploads without auth
    }
  }
}
```

### 🔐 Option 2: Authenticated Write Only (More Secure)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /shops/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;  // Requires Firebase sign-in
    }
  }
}
```

⚠️ **Note**: 
- Use **Option 1** if you want staff to upload without signing in (password 5234 only)
- Use **Option 2** if you want staff to sign in via Firebase Auth before uploading (more secure)

### Step 4: Publish Rules (DON'T FORGET THIS!)
1. Click the **Publish** button in both Firestore and Storage rules tabs
2. Wait 10 seconds for rules to propagate
3. **Hard refresh your app**: Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
4. ✅ The permission errors should be gone!

## What This Fixes

- ✅ Home page will load shops without errors
- ✅ Staff portal can add/delete shops and barbers
- ✅ Image uploads will work correctly
- ✅ No more "permission-denied" errors in console

## Authentication Note

Your app uses Firebase Authentication with:
- Email/Password sign-in
- Google sign-in
- Staff portal password: `5234`

The security rules ensure:
- Anyone can view shops and barbers (public home page)
- Only authenticated users can modify data (staff portal)

## Need Help?

If you encounter issues:
1. Make sure you're signed in to the correct Firebase project
2. Check that the rules are published (green "Published" badge)
3. Wait 1-2 minutes for rules to propagate
4. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
