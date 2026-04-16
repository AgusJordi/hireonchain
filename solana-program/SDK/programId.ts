import { PublicKey } from "@solana/web3.js";

/**
 * Get the program ID from environment variable
 * Throws an error if not configured
 */
export const getProgramId = (): PublicKey => {
    let programIdEnv: string | undefined;

    // Browser/Vite environment (import.meta.env) — wrapped in try/catch
    // so ts-node / CommonJS doesn't choke on the syntax at runtime.
    try {
        const importMeta = new Function('return import.meta')() as any;
        if (importMeta?.env?.VITE_SOLANA_PROGRAM_ID) {
            programIdEnv = importMeta.env.VITE_SOLANA_PROGRAM_ID;
        }
    } catch {
        // Not a browser/ESM environment — fall through to process.env
    }

    if (!programIdEnv && typeof process !== 'undefined') {
        programIdEnv = process.env?.SOLANA_PROGRAM_ID;
    }

    if (!programIdEnv) {
        throw new Error('Program ID not configured. Set SOLANA_PROGRAM_ID (server) or VITE_SOLANA_PROGRAM_ID (client) in environment variables.');
    }
    return new PublicKey(programIdEnv);
};

/**
 * The deployed program ID for the Freelance Marketplace
 * Lazily evaluated to allow environment variables to be loaded
 */
let _PROGRAM_ID: PublicKey | null = null;

export const PROGRAM_ID = new Proxy({} as PublicKey, {
    get(target, prop) {
        if (!_PROGRAM_ID) {
            _PROGRAM_ID = getProgramId();
        }
        const value = (_PROGRAM_ID as any)[prop];
        if (typeof value === 'function') {
            return value.bind(_PROGRAM_ID);
        }
        return value;
    },
    getOwnPropertyDescriptor(target, prop) {
        if (!_PROGRAM_ID) {
            _PROGRAM_ID = getProgramId();
        }
        return Object.getOwnPropertyDescriptor(_PROGRAM_ID, prop);
    },
    ownKeys() {
        if (!_PROGRAM_ID) {
            _PROGRAM_ID = getProgramId();
        }
        return Reflect.ownKeys(_PROGRAM_ID);
    },
    getPrototypeOf() {
        return PublicKey.prototype;
    }
}) as PublicKey;

/**
 * @deprecated Use PROGRAM_ID instead
 */
export const ESCROW_PROGRAM_ID = PROGRAM_ID;