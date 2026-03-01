# ConvergeX Pay - Hybrid Web3 Fintech Platform

ConvergeX Pay is a next-generation fintech application that bridges the gap between traditional banking (Web2) and cryptocurrency (Web3). It features a unique **Dual-Wallet System**, allowing users to seamlessly manage Fiat (INR) and Crypto (USDC, DAI, ETH) assets in a single, premium interface.

## 🚀 Core Architecture: The Dual-Wallet System

Every user on ConvergeX is assigned two distinct financial identities:
1.  **Universal Bank (Fiat/UPI)**: A simulated bank account for INR transactions, supporting UPI transfers and traditional banking features.
2.  **ConvergeX Vault (Crypto)**: A built-in, custodial crypto wallet automatically generated for every user (starts with `cx_`). It holds assets like USDC, DAI, and ETH.

### Key Features
*   **Atomic Bridge**: Instantly convert INR to Crypto and vice-versa using real-time (mocked) exchange rates.
*   **Crypto Transfers**: Send crypto assets to other ConvergeX users instantly with zero fees.
*   **MetaMask Integration**: Connect external DeFi wallets for broader Web3 access.
*   **Premium UI/UX**: A "Command Center" dashboard with glassmorphism design and fluid animations.

---

## 📂 Backend Architecture (`/backend`)
Built with **Node.js, Express, and MongoDB**.

| File | Description |
|------|-------------|
| **`server.js`** | Entry point. Configures Express app, connects to MongoDB, and registers route handlers. |
| **`src/models/User.js`** | **Critical**. Defines the Dual-Wallet schema. Automatically generates a unique `convergeXWallet` address (`cx_...`) using `uuid` on registration. Stores balances for both Fiat and Crypto. |
| **`src/models/Transaction.js`** | Unified transaction schema. Handles `paymentMethod` (UPI, CONVERGEX_WALLET) and strict validation rules (e.g., `min: 0` amount). |
| **`src/routes/wallet.routes.js`** | **Core Logic**. Handles the heavy lifting for the "Bridge" and Crypto features:<br>- `/transfer`: Internal zero-fee crypto transfers.<br>- `/convert/upi-to-crypto`: Debits Bank, Credits Vault.<br>- `/convert/crypto-to-upi`: Debits Vault, Credits Bank.<br>- `/find/:address`: Look up users by their `cx_` wallet address. |
| **`src/routes/payment.routes.js`** | Handles traditional UPI payments and transaction history fetching. |
| **`src/routes/auth.routes.js`** | User registration and login (JWT generation). |
| **`src/middleware/auth.middleware.js`** | Protects private routes by verifying JWT tokens and attaching the user to the request object. |

---

## 💻 Frontend Architecture (`/frontend`)
Built with **React, Vite, TailwindCSS, and Framer Motion**.

### 1. Pages (`src/pages/`)
| File | Description |
|------|-------------|
| **`Dashboard.jsx`** | **The Command Center**. Features a split-view design:<br>- **Left**: "Universal Bank" (Fiat) card.<br>- **Right**: "ConvergeX Vault" (Crypto) card with live token breakdown.<br>- **Hero**: Aggregated "Total Net Worth" display using `exchangeRates`. |
| **`CryptoPay.jsx`** | **The Hub**. Replaces standard forms with a premium "Swap Interface" (Uniswap-style) for converting funds and a step-by-step wizard for sending crypto. |
| **`Transactions.jsx`** | Displays unified history for both Bank and Crypto transactions with filtering capabilities. |
| **`SendMoney.jsx`** | Standard interface for sending Fiat/UPI payments. |

### 2. Context & State (`src/context/`)
| File | Description |
|------|-------------|
| **`CryptoContext.jsx`** | **The Brain**. Manages global crypto state:<br>- `activeWallet`: Toggles between ConvergeX Internal and MetaMask.<br>- `convertFunds()`: Calls backend bridge endpoints.<br>- `exchangeRates`: Fetches real-time valuations.<br>- Wallet connection logic (MetaMask & Internal). |
| **`AuthContext.jsx`** | Handles authentication state (Login/Register/Logout) and token storage. |

### 3. Components (`src/components/`)
*   **`ui/Navbar.jsx`**: Responsive navigation bar with active state highlighting.
*   **`ui/TransactionItem.jsx`**: Reusable component to render individual transaction rows with dynamic icons based on transaction type (Crypto vs Fiat).

---

## 🛠 Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   MongoDB (Local or Atlas)

### 1. Backend Setup
```bash
cd backend
npm install
# Create .env file with:
# MONGO_URI=your_mongodb_uri
# JWT_SECRET=your_jwt_secret
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Verification
*   Visit `http://localhost:5173`.
*   Register a new user (Wallet is auto-created).
*   Go to **Crypto Hub** -> **Convert** tab.
*   Swap some INR for USDC.
*   Go to **Dashboard** and see your "Vault" balance update instantly.

---

## 🔒 Security Notes
*   **Atomic Transactions**: Conversions are processed atomically to ensure funds are never lost during a swap.
*   **Validation**: Backend enforces strict non-negative balance checks and address verification (`cx_` prefix).
*   **JWT Auth**: All financial endpoints are protected via `auth.middleware.js`.
