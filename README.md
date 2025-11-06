# Web3 Job Marketplace

A decentralized job marketplace platform built on Solana blockchain, enabling secure and transparent freelance job postings, bidding, and payments. The platform combines the power of blockchain technology with a modern web interface to create a trustless environment for freelancers and employers.

## 🚀 Features

- **Blockchain-Powered**: Built on Solana for fast, low-cost transactions
- **Smart Contract Integration**: Secure job contracts and payments
- **User Authentication**: Wallet-based authentication system
- **Job Management**: Create, browse, and manage job listings
- **Profile System**: Comprehensive user profiles for freelancers and employers
- **Real-time Updates**: Live contract and payment status tracking
- **Responsive Design**: Modern UI built with React and Tailwind CSS

## 🛠 Tech Stack

### Frontend

- React.js with TypeScript
- Tailwind CSS for styling
- Web3 integration with Solana wallet adapters
- Modern component architecture

### Backend

- Node.js server
- Express.js framework
- MongoDB database (assumed based on models)
- JWT authentication

### Blockchain

- Solana Program (Smart Contract)
- Rust programming language
- Solana Web3.js for blockchain interactions

## 🏗 Project Structure

```
web3-project/
├── client/           # React frontend application
├── server/           # Node.js backend server
└── solana-program/   # Solana smart contract
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Rust and Cargo
- Solana CLI tools
- MongoDB

### Installation

1. Clone the repository:

   ```bash
   git clone 
   cd web3-project
   ```

2. Install frontend dependencies:

   ```bash
   cd client
   npm install
   ```

3. Install backend dependencies:

   ```bash
   cd ../server
   npm install
   ```

4. Build Solana program:

   ```bash
   cd ../solana-program
   cargo build
   ```

5. Set up environment variables:
   - Create `.env` files in both `client/` and `server/` directories
   - Add necessary environment variables (see `.env.example` files)

### Running the Application

1. Start the frontend:

   ```bash
   cd client
   npm start
   ```

2. Start the backend server:

   ```bash
   cd server
   npm start
   ```

3. Deploy Solana program (if needed):
   ```bash
   cd solana-program
   solana program deploy target/deploy/[program-name].so
   ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This project is in development and should not be used in production without proper security audits and testing.
