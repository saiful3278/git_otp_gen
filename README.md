# TOTP Authenticator

A static web-based two-factor authentication app similar to Google Authenticator, designed to be hosted on GitHub Pages.

## Features

- ✅ Add, edit, and delete TOTP secret keys
- ✅ View live TOTP codes with countdown timer
- ✅ Copy codes to clipboard with one click
- ✅ Clean, minimal, mobile-friendly UI
- ✅ PWA support (can be installed on mobile devices)
- ✅ Firebase Firestore integration for data persistence
- ✅ No server required - fully client-side
- ✅ Compatible with Google Authenticator and other TOTP apps

## Setup Instructions

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Go to **Project Settings** > **General** > **Your apps**
4. Click **"Add app"** and select **Web** (</>)
5. Register your app with a nickname
6. Copy the configuration object

### 2. Enable Firestore Database

1. In the Firebase console, go to **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** for development
4. Select a location for your database

### 3. Update Configuration

Replace the Firebase configuration in `index.html` (around line 85) with your actual values:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

### 4. Deploy to GitHub Pages

1. Push this repository to GitHub
2. Go to your repository settings
3. Scroll down to **Pages** section
4. Select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save**

Your app will be available at: `https://yourusername.github.io/repository-name`

## Security Considerations

- This app stores TOTP secrets in plain text in Firestore (as specified in requirements)
- For production use, consider implementing:
  - Firestore security rules
  - Client-side encryption of secrets
  - User authentication

### Firestore Security Rules (Recommended)

Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to totpKeys collection
    // In production, add proper authentication
    match /totpKeys/{document} {
      allow read, write: if true; // Replace with proper auth rules
    }
  }
}
```

## Usage

1. **Add a new TOTP key**: Click the "➕ Add New Key" button
2. **Enter service details**: 
   - Service Name (e.g., "Google", "GitHub")
   - Account (optional, e.g., "user@example.com")
   - Secret Key (Base32 format provided by the service)
3. **View codes**: TOTP codes update every 30 seconds
4. **Copy codes**: Click on any code to copy it to clipboard
5. **Edit/Delete**: Use the edit (✏️) or delete (🗑️) buttons on each key

## Manual Secret Entry

When setting up 2FA on a service:
1. Choose "Enter code manually" instead of scanning QR
2. Copy the provided secret key
3. Paste it into this app's "Secret Key" field

## PWA Installation

This app can be installed as a Progressive Web App:
- **Mobile**: Use "Add to Home Screen" option in your browser
- **Desktop**: Look for the install icon in the address bar

## Technical Details

- **Frontend**: HTML, CSS, JavaScript (ES6+)
- **Authentication Library**: [otplib](https://github.com/yeojz/otplib)
- **Database**: Firebase Firestore
- **Hosting**: GitHub Pages compatible
- **PWA**: Service Worker for offline functionality

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Development

To run locally:
1. Set up Firebase configuration
2. Serve files using a local HTTP server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```
3. Open `http://localhost:8000`

## License

MIT License - feel free to use and modify as needed.