# Escrow SDK TypeScript Client

This SDK provides:

- High-level EscrowClient class
- Low-level instruction builders
- PDA utilities
- Borsh account decoding
- Deadline, acceptance, cancel, release flows
- Support for SOL and SPL tokens

It will be fully compatible with `@solana/web3.js` and `@solana/spl-token`

## Installation

```bash
npm install @solana/web3.js @solana/spl-token @coral-xyz/borsh
````

Then copy the `sdk` folder into the project.

## Configuration

```typescript
export const ESCROW_PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID_HERE");
````

## Quickstart 

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { EscrowClient, ESCROW_PROGRAM_ID } from "./sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const payer = Keypair.generate();

const client = new EscrowClient(connection, ESCROW_PROGRAM_ID);

// Example values
const initializer = payer.publicKey;
const freelancer = new PublicKey("FREELANCER_PUBKEY");
````

## Creating an Escrow

```typescript
await client.initializeSol(
  payer,
  initializer,
  freelancer,
  1_000_000_000n // 1 SOL
);
````
## Create an SOL Escrow with Deadline

```typescript
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1h from now

await client.initializeSolWithDeadline(
  payer,
  initializer,
  freelancer,
  2_000_000_000n, // 2 SOL
  deadline
);

## Create a Token Escrow

```typescript
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const mint = new PublicKey("TOKEN_MINT");

const initializerAta = getAssociatedTokenAddressSync(
  mint,
  initializer
);

await client.initializeToken(
  payer,
  initializer,
  freelancer,
  mint,
  initializerAta,
  500_000n // 500 tokens (depending on decimals)
);
````

## Freelancer Accepts Escrow

```typescript
await client.accept(
  payer,         // freelancer signs
  freelancer,
  initializer
);
````

## Release Funds (SOL)

```typescript
await client.releaseSol(
  payer,        // initializer signs
  initializer,
  freelancer
);
````
## Release SPL Tokens

```typescript
const freelancerAta = getAssociatedTokenAddressSync(
  mint,
  freelancer
);

await client.releaseToken(
  payer,
  initializer,
  freelancer,
  mint,
  freelancerAta
);
````
## Cancel Escrow

### SOL Refund
```typescript
await client.cancel(
  payer,
  initializer,
  freelancer
);
````
### Token Refund
```typescript
const initializerTokenAta = getAssociatedTokenAddressSync(mint, initializer);

await client.cancel(
  payer,
  initializer,
  freelancer,
  mint,
  initializerTokenAta
);
````
## Reading Escrow State

```typescript
import { fetchEscrowByParties } from "./sdk/utils";

const { pda, state } = await fetchEscrowByParties(
  connection,
  ESCROW_PROGRAM_ID,
  initializer,
  freelancer
);

console.log("Escrow PDA:", pda.toBase58());
console.log("State:", state);
````
## PDA Derivation 

```css
["escrow", initializer_pubkey, freelancer_pubkey]
````

you cab derive PDA using:

```typescript
const { pda, bump } = deriveEscrowPda(
  ESCROW_PROGRAM_ID,
  initializer,
  freelancer
);
````
## SDK Structure

```cpp
sdk/
  client.ts         // High-level interface
  instructions.ts   // Low-level tx builders
  pdas.ts           // PDA helpers
  types.ts          // Enums & interfaces
  utils.ts          // Fetch + decode helpers
  index.ts          // Export bundle
```
## Error Handling

Errors are returned as: 
```typescript
throw new EscrowClientError(code, logs);
````
### Codes include:

- DeadlineNotReached

- DeadlinePassed

- NotAccepted

### Catch example:

```typescript
try {
  await client.releaseSol(...);
} catch (err) {
  console.error("Escrow error:", err);
}
````


# To be continued...