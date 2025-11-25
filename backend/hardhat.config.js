import 'dotenv/config';
import '@nomicfoundation/hardhat-toolbox';
// Conditionally load FHEVM plugin (only enable on local networks to avoid errors on unsupported networks)
import { createRequire } from 'module';
const __require = createRequire(import.meta.url);
const networkArgIndex = process.argv.findIndex((a) => a === '--network');
const cliNetwork = networkArgIndex >= 0 && process.argv[networkArgIndex + 1] ? process.argv[networkArgIndex + 1] : undefined;
const selectedNetwork = process.env.HARDHAT_NETWORK || cliNetwork || 'hardhat';
if (['localhost', 'hardhat'].includes(selectedNetwork)) {
  try {
    __require('@fhevm/hardhat-plugin');
  } catch {}
}

const { SEPOLIA_RPC_URL, PRIVATE_KEY, MNEMONIC } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    version: '0.8.27',
    settings: {
      optimizer: { enabled: true, runs: 800 },
      evmVersion: 'cancun',
      metadata: { bytecodeHash: 'none' }
    }
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545'
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || '',
      // Prefer mnemonic, fallback to private key
      accounts: MNEMONIC ? { mnemonic: MNEMONIC } : (PRIVATE_KEY ? [PRIVATE_KEY] : [])
    }
  }
};

export default config;

