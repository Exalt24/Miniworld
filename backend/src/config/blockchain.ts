import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

export const provider = new ethers.JsonRpcProvider(RPC_URL);

// Load contract ABI from artifacts
let contractABI: any[] = [];

function loadContractABI(): any[] {
  // Path 1: Docker production (copied during build)
  const dockerPath = join(__dirname, '../artifacts/contracts/MiniWorld.sol/MiniWorld.json');
  
  // Path 2: Docker dev (mounted volume)
  const dockerDevPath = '/app/artifacts/contracts/MiniWorld.sol/MiniWorld.json';
  
  // Path 3: Local development (relative path)
  const localPath = join(__dirname, '../../../contracts/artifacts/contracts/MiniWorld.sol/MiniWorld.json');

  const pathsToTry = [dockerPath, dockerDevPath, localPath];

  for (const path of pathsToTry) {
    try {
      const artifact = JSON.parse(readFileSync(path, 'utf8'));
      console.log(`✓ Loaded contract ABI from: ${path}`);
      return artifact.abi;
    } catch (error) {
      // Try next path
      continue;
    }
  }

  // If we get here, no ABI was found
  throw new Error(
    'Contract ABI not found! Paths tried:\n' +
    pathsToTry.map(p => `  - ${p}`).join('\n') +
    '\n\nMake sure contracts are compiled and deployed:\n' +
    '  cd contracts && npx hardhat compile'
  );
}

try {
  contractABI = loadContractABI();
} catch (error) {
  console.error('❌ CRITICAL ERROR:', error instanceof Error ? error.message : error);
  console.error('Backend cannot start without contract ABI.');
  process.exit(1); // Fail fast - don't start backend without ABI
}

export function getContract(address: string = CONTRACT_ADDRESS || '') {
  if (!address) {
    throw new Error('Contract address is required. Set CONTRACT_ADDRESS environment variable.');
  }
  
  if (!contractABI || contractABI.length === 0) {
    throw new Error('Contract ABI not loaded. Backend should have exited during startup.');
  }
  
  return new ethers.Contract(address, contractABI, provider);
}

export async function getBlockNumber(): Promise<number> {
  return await provider.getBlockNumber();
}

export async function waitForConnection(): Promise<void> {
  let retries = 0;
  const maxRetries = 10;
  
  while (retries < maxRetries) {
    try {
      await provider.getBlockNumber();
      console.log('✓ Connected to blockchain at', RPC_URL);
      return;
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        throw new Error(`Failed to connect to blockchain after ${maxRetries} attempts`);
      }
      console.log(`Blockchain connection attempt ${retries}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

export { contractABI };