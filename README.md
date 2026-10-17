# TransitEase — A Real-Time and Inclusive Public Transport Tracking System for Small Cities

**TransitEase** is an engineering-grade, secure, real-data-driven public transport tracking platform architected specifically for small cities and transit corridors. It bridges the digital divide by offering real-time smartphone GPS tracking for tech-enabled users while ensuring inclusive offline access via SMS and voice telephony for citizens using basic ₹1,000 keypad feature phones or lacking mobile internet.

---

## 🚌 Key Features & Engineering Modules

1. **Dual-Method Bus Search**:
   - **Search by Bus Number** (e.g. `UP16-1001`): Queries database for active trip, displays route, ordered stops, live speed, crowd occupancy, and real-time Leaflet map.
   - **Search by Driver's Registered Mobile Number** (e.g. `9876543210`): Validates verified driver, looks up assigned bus, retrieves smartphone GPS coordinates during active trips, masks private mobile number (`+91 98765*****`), and centers live tracking map.
2. **Real Driver Smartphone GPS Integration**:
   - Geolocation API (`navigator.geolocation.watchPosition` with `enableHighAccuracy: true`).
   - Validates authenticated driver, active trip authorization, and bounding box coordinates.
   - Broadcasts updates every 5 seconds over Socket.IO without page refreshes.
   - Detects stale GPS (> 3 minutes without satellite sync) and warns passengers transparently.
3. **A-to-B Journey Planner**:
   - Select origin and destination stops with 1-click swap.
   - Validates stop sequence along routes (prevents wrong-direction results).
   - Computes distance-based fares, scheduled frequencies, and live approaching bus boarding ETAs.
4. **Daily Commute Assistant & Background Arrival Alerts**:
   - Save regular morning/evening journeys with custom alert thresholds (5, 10, or 15 mins).
   - Autonomous backend worker runs every 15 seconds to evaluate approaching buses and dispatches automated SMS alerts even when passenger browsers are closed.
   - Duplicate prevention window prevents re-alerting within 25 minutes.
5. **Offline SMS for Passengers Without Internet (2G Feature Phones)**:
   - Built-in SMS gateway abstraction supporting Fast2SMS, Twilio, and a live Interactive Feature Phone Terminal Simulator.
   - Standard Telecom Command Parser:
     - `BUS <busNumber>` — e.g. `BUS UP16-1001` returns live speed, next stop ETA, and crowd level.
     - `STOP <stopCode>` — e.g. `STOP KNP01` returns approaching buses and arrival times.
     - `ROUTE <originCode> <destCode>` — e.g. `ROUTE KNP01 SRJ05` returns route info and fare.
     - `ALERT <bus> <stop> <mins>` — sets arrival SMS alerts without requiring an app.
     - `MYALERTS` — lists active alerts for sender's phone.
     - `CANCEL` / `STOP` — telecom-compliant unsubscribe and opt-out.
     - `HELP` — command menu.
6. **Accessible Voice Assistance & IVR Telephony**:
   - Interactive helpline (`1800-TRANSIT`) with DTMF keypad simulation and bilingual Web Speech synthesis in English and Hindi.
7. **QR Codes for Physical Bus Stop Signage**:
   - Pre-generated high-resolution QR codes for all registered stops.
   - Printable stop plates displaying short SMS codes (`KNP01`, `PRC02`), landmarks, and live arrival boards.
8. **Bilingual Hindi & English Inclusive Design**:
   - Seamless 1-click language switcher (`EN` / `हिन्दी`).
   - High-contrast toggle for low-vision passengers.
   - Text size scaling and low-bandwidth (text-only) mode for slow 2G mobile data connections.
   - Text-to-speech (TTS) announcement button on bus search results.
9. **Passenger Grievance Desk**:
   - Incident reporting for incorrect locations, missed stops, unsafe driving, or accessibility issues.
   - Generates unique tracking IDs (`REP-TE-XXXX-YYYY`) for passenger status tracking.
10. **Command Center Admin Fleet Dashboard**:
    - Real-time fleet overview map tracking all running buses simultaneously.
    - Driver verification desk (approve/reject driver accounts).
    - Driver-to-bus and route assignment.
    - Service disruption announcement publisher (route delays, diversions, emergency advisories).
    - Controllable GPS route simulator step button for classroom viva demonstrations.

---

## 🛠 Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React, Leaflet & OpenStreetMap, Web Speech Synthesis API.
- **Backend**: Node.js, Express.js, Socket.IO (WebSockets), JSON Web Tokens (JWT), Bcrypt password hashing.
- **Database**: MongoDB with Mongoose support, with automatic local persistent storage fallback (`./data/transit_db.json`) ensuring 100% functionality out-of-the-box.
- **Telecom & SMS**: Real webhook endpoints, command parser, Fast2SMS / Twilio provider integration, and interactive keypad terminal sandbox.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ installed.

### 2. Run the Full-Stack Application
```bash
npm run dev
```
The server will start on port `3000` (`http://localhost:3000`), mounting the Express API, Socket.IO WebSockets, and the Vite client simultaneously.

### 3. Demo Credentials
| Role | Identifier / Mobile | Password | Notes |
|---|---|---|---|
| **Passenger** | `9988776655` | `pass123` | Can search buses, plan journeys, and save commutes |
| **Driver** | `9876543210` | `driver123` | Approved driver assigned to Bus `UP16-1001` |
| **Admin** | `admin@transitease.city` | `admin123` | Fleet Controller Verma with full dispatch authority |

---

## 🧪 Testing the 12 Acceptance Criteria

1. **Driver GPS Sharing**: Sign in as Driver (`9876543210`), click "Start Trip & Share GPS". Your device's browser Geolocation API begins transmitting latitude, longitude, and accuracy to the server.
2. **Search by Bus Number**: Navigate to "Find Bus", search `UP16-1001`. The live bus marker will appear on the Leaflet map with upcoming stops, ETAs, and speed.
3. **Search by Driver Mobile Number**: Search `9876543210`. The system retrieves the assigned bus, centers on the driver's phone GPS, and masks the phone number (`+91 98765*****`) for privacy.
4. **Point A to Point B Journey Planning**: Select "Knowledge Park I Bus Stop" and "Surajpur Collectorate", click "Find Available Buses". Inspect eligible buses on Route 101 with boarding ETAs, travel duration, and ₹31 fare.
5. **Daily Commute Arrival Alerts**: In "Daily Commutes", configure a commute with a 10-minute threshold. The background worker evaluates approaching buses and registers SMS alerts.
6. **Offline SMS Simulator**: Click "Offline SMS" in the top navbar. Try commands like `BUS UP16-1001`, `STOP KNP01`, `ROUTE KNP01 SRJ05`, `ALERT UP16-1001 KNP01 10`, `MYALERTS`, and `CANCEL`.
7. **Voice IVR Telephony**: Click "Voice IVR" in the navbar, dial 1800-TRANSIT, press 1 for English (or 2 for Hindi), and hear spoken arrival estimates.
8. **Printable Bus Stop QR Codes**: Click any stop under "Bus Stops & QR Codes" to inspect or print the physical stop plate.
9. **Multilingual & Accessibility**: Click `हिन्दी` in the navbar to switch languages. Test the High Contrast and Low-Bandwidth modes.
10. **Admin Fleet Management**: Sign in as Admin (`admin@transitease.city`), navigate to "Admin Fleet" to approve pending drivers, review grievances, and publish service delays.
