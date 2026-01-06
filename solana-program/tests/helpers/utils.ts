import { PublicKey, Connection } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export async function airdrop(connection: Connection, address: PublicKey, lamports: number) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const signature = await connection.requestAirdrop(address, lamports);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
}

export function derivePDAs(
  programId: PublicKey,
  client: PublicKey,
  jobId: BN,
  milestoneId: number
) {
  const [platformConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform_config")],
    programId
  );
  const [job] = PublicKey.findProgramAddressSync(
    [Buffer.from("job"), client.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
    programId
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), job.toBuffer()],
    programId
  );
  const [milestone] = PublicKey.findProgramAddressSync(
    [Buffer.from("milestone"), job.toBuffer(), Buffer.from([milestoneId])],
    programId
  );
  return { platformConfig, job, vault, milestone };
}
