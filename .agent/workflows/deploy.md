---
description: Steps to deploy the Med Tracker application to Firebase
---

1. **Configure Firebase Project:**
    - Go to the [Firebase Console](https://console.firebase.google.com/).
    - Create a new project (e.g., `my-med-tracker`).
    - Enable **Firestore Database** in the "Build" menu. Choose "Production mode" and a location near you.
    - Enable **Cloud Functions** (requires Blaze plan, but you can use direct Firestore access if you prefer).
    - Enable **Hosting**.

2. **Add Firebase Configuration:**
    - In Firebase Console, go to **Project Settings**.
    - Find the **Web App** section (add one if it doesn't exist).
    - Copy the `firebaseConfig` object.
    - Open `src/firebase.js` in your project and replace the placeholder config with your copied values.

3. **Update Project ID:**
    - Open `.firebaserc` and replace `my-med-tracker-app` with your actual Firebase Project ID.

4. **Login to Firebase CLI:**

    ```bash
    firebase login
    ```

5. **Deploy Everything:**

    ```bash
    npm run deploy
    ```

// turbo
6.  **Verify Backend Health (Optional):**
    After deployment, you can check if your backend is alive by visiting `https://<YOUR_REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/health`.
