
//                Default Escrow Program ID
//
// Replace this with your deployed program ID once ready.
// Until then, this placeholder prevents accidental errors.
//
import { PublicKey } from "@solana/web3.js";

export const ESCROW_PROGRAM_ID = new PublicKey(
"11111111111111111111111111111111"
);



//                       Core Client

export { EscrowClient } from "./client";



//                       Instructions

export * from "./instructions";



//                       PDA Derivation

export * from "./pdas";



//                       Types & Errors

export * from "./types";



//                       Utility Helpers

export * from "./utils";



//                    Default Export (Optional)
//
// Some projects prefer a single default export.
// You can remove this block if you don't want it.
//
import * as EscrowSdk from "."; // circular-safe due to TS hoisting

export default {
EscrowClient: EscrowSdk.EscrowClient,
ESCROW_PROGRAM_ID,
...EscrowSdk,
};
