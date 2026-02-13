# Statement of Work (SOW)
**Project:** Solana-Based Job Marketplace with Future EVM Expansion  

---

## 1. Project Overview

The objective of this engagement is to stabilize, refactor, and improve an existing **Solana-based decentralized job marketplace** with escrow, milestone payments, and wallet-based interactions.

The focus is on **security, maintainability, scalability**, and preparing the platform for **future multi-chain (EVM) expansion**.

This SOW prioritizes a **strong MVP foundation**, not a full rebuild unless required for correctness or security.

---

## 2. Smart Contract Scope (Solana)

### 2.1 Refactor & Architecture
- Refactor the existing Solana smart contract using the **Anchor framework**, maintaining compatibility with:
  - Current wallet logic
  - Existing API integrations
- Dockerized infrastructure with isolated services:
  - API gateway
  - Solana indexer
  - Database
  - Frontend
- If major limitations or security risks are identified, a **clean rebuild** is acceptable with:
  - Clear documentation
  - Migration notes
  - Explicit justification

### 2.2 Core Escrow Logic
- Anchor-based Solana programs implementing:
  - Job creation
  - Milestone funding and release
  - Escrow vaults using **PDA-controlled accounts**
  - Strict signer and authority validation
- Support for:
  - Partial or full milestone releases (as specified)
  - Refund and dispute resolution hooks
- Emit **on-chain events** for indexing and real-time updates

### 2.3 Security & Upgradeability
- Secure authority management
- Defined upgrade authority (single key or multisig, as agreed)
- Defensive checks to prevent double payouts or invalid state transitions

---

## 3. Backend Scope

### 3.1 Architecture & Refactor
- Maintain the existing **Node.js backend** (Express.js).
- Refactor code to address:
  - Tight coupling
  - Poor separation of concerns (SoC)
- Improve maintainability, readability, and testability without changing the core stack.

### 3.2 Backend Modules
Each module must be independently testable:
- User & Authentication
- Jobs & Proposals
- Contracts & Escrow State
- Admin / Arbitration logic

### 3.3 Blockchain Synchronization
- Backend responsibilities include:
  - Constructing transactions for user-signed flows
  - Handling **admin / arbitration transactions** (KMS-backed signing if required)
  - Syncing on-chain escrow state into **MongoDB**
- Backend acts as a **state mirror**, not a custodial wallet.

---

## 4. Frontend Scope

### 4.1 Design Goals
- **Light redesign only** (no full rebuild)
- Improve:
  - Layout clarity
  - UX flows
  - Performance
  - Mobile responsiveness
- Preserve existing structure and navigation

### 4.2 Current Status

**Completed:**
- Core pages render (Home, Login, Register, Dashboard)
- React Router navigation
- Registration and login forms

**To Be Completed:**
- Job posting with escrow integration
- Proposal submission with escrow funding
- Contract management UI with blockchain state

---

## 5. Blockchain Integration

### 5.1 Current Status

**Completed:**
- Escrow smart contract compiled
- Solana wallet connection (Phantom / Solflare)

**Required:**
- Complete UI → smart contract wiring for:
  - Escrow creation
  - Funding
  - Milestone submission
  - Approval and payout
- Proper handling of failed transactions and retries

---

## 6. Real-Time Updates

- Implement **WebSocket-based real-time updates** (Socket.io or equivalent)
- Initial scope limited to:
  - Job status changes
  - Escrow and payment updates
- Chat and messaging are **out of scope for Phase 1**, but architecture should allow future addition

---

## 7. Mobile Optimization

- Ensure responsive layouts
- Optimize wallet interactions and transaction flows for mobile users
- Improve performance on low-bandwidth devices

---

## 8. Environment & Infrastructure

### 8.1 Current
- Solana Devnet
- MongoDB instance

### 8.2 Required
- Setup a **staging environment** including:
  - Dockerized services
  - Environment configuration
  - CI-friendly deployment flow
- Clear separation between Devnet, staging, and future production
- Disaster recovery considerations (backups, redeployability)

---

## 9. Cross-Chain & EVM Expansion (Future Phase)

> This section defines **future scope**, not mandatory Phase 1 deliverables.

### 9.1 EVM Smart Contracts
- Design and implement **Solidity-based escrow contracts** on:
  - Ethereum
  - Polygon
- Escrow logic to mirror Solana behavior where feasible:
  - Jobs
  - Milestones
  - Funding
  - Release
  - Disputes

### 9.2 Bridged Escrow Architecture
- Explore integration with cross-chain protocols such as:
  - Wormhole
  - LayerZero
  - Equivalent messaging bridges
- Enable future capabilities such as:
  - Cross-chain job visibility
  - Unified backend state across chains
- No cross-chain fund transfers required in Phase 1

### 9.3 Backend Support
- Extend indexer and backend services to:
  - Monitor both Solana and EVM events
  - Normalize multi-chain escrow states
  - Keep chain-specific logic isolated

---

## 10. Non-Goals (Phase 1)

- No DAO governance
- No full UI redesign
- No production-grade chat system
- No cross-chain fund bridging unless explicitly approved

---

## 11. Success Criteria

- Secure, testable escrow flows on Solana Devnet
- Clean backend architecture with clear module boundaries
- Frontend fully integrated with blockchain flows
- Platform ready for controlled feature expansion and multi-chain growth