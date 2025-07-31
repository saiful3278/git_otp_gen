// Firebase Configuration Template
// Replace these values with your actual Firebase project configuration

const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456789"
};

// Instructions to set up Firebase:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select an existing one
// 3. Go to Project Settings > General > Your apps
// 4. Click "Add app" and select Web (</>) 
// 5. Register your app with a nickname
// 6. Copy the configuration object and replace the values above
// 7. Go to Firestore Database in the Firebase console
// 8. Click "Create database"
// 9. Choose "Start in test mode" for development (you can secure it later)
// 10. Select a location for your database
// 11. Update the firebaseConfig object in index.html with your actual values

export default firebaseConfig;