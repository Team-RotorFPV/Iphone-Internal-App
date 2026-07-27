# RFV Web — Team Rotor FPV (iPhone-ready web app)

A mobile-first React recreation of the RFV native app (Expo/React Native), built to open in
Safari on an iPhone without needing TestFlight or an Apple Developer subscription. It talks to
the **same Firebase project** as the native app and the deployed sites, so all data is shared.

Feature parity with the native app:

- **Google sign-in** (same flow as `teamrotorfpv.com/admin` / `inventory.teamrotorfpv.com`)
- **Inventory** — lists → inventories → folders → items, holds/custody, audit log, move, and
  CSV/Excel export
- **Admin** — dashboard + Gallery, Sponsors, Home Page, Achievements, Board, Events, Messages,
  and Team Members (all permission-gated by role)
- **Profile** — edit details, avatar upload, tags, email migration, sign out

## Run it (local, over Wi-Fi)

```bash
npm install
npm run dev
```

Vite prints two URLs:

- **Local:** `http://localhost:5173` — open on the same PC
- **Network:** `http://<your-PC-IP>:5173` — open this one on the **iPhone** (must be on the same
  Wi-Fi). On the iPhone you can then use Safari's **Share → Add to Home Screen** to get an
  app-like, full-screen icon.

## Google sign-in on the iPhone — one-time Firebase step

Firebase only allows sign-in from **authorized domains**. `localhost` works out of the box, but
your PC's LAN address (e.g. `192.168.1.42`) does not, so sign-in on the phone will fail with an
`auth/unauthorized-domain` error until you add it:

1. Firebase Console → project **teamrotor-fpv-website** → **Authentication → Settings →
   Authorized domains → Add domain**.
2. Add the host shown in the Vite "Network" URL (the IP or hostname, no port).
3. Reload the page on the phone and sign in.

The login screen surfaces this exact error and remedy if it happens.

## Configuration

`.env` holds the public Firebase client config and the backend URL (same values as the native
app's `EXPO_PUBLIC_*` keys). These are public client keys, not secrets.

- `VITE_FIREBASE_*` — Firebase Web SDK config
- `VITE_API_URL` — backend for Cloudinary asset ops + admin claim management
  (`https://team-rotorfpv-website.onrender.com`)

## Build / preview a production bundle

```bash
npm run build     # outputs to dist/
npm run preview   # serves dist/ (also with --host for the phone)
```

## Notes

- Excel/CSV export downloads the file in the browser (native used the iOS share sheet).
- Image/video pickers use the browser file dialog (native used expo-image-picker).
- No native-only features: OTA updates and push notifications are intentionally omitted.
- Tech stack: Vite + React 19, react-router-dom, zustand, firebase, xlsx, lucide-react.
