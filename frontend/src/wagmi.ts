import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';

// localhost chain definition (Hardhat):
export const localhost = {
  id: 31337,
  name: 'Hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] }
  }
} as const;

const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID as string | undefined;

export const config = createConfig({
  chains: [localhost, sepolia],
  transports: {
    [localhost.id]: http(localhost.rpcUrls.default.http[0]),
    [sepolia.id]: http()
  },
  connectors: [
    injected({ target: 'metaMask', shimDisconnect: true, unstable_shimAsyncInject: 1000 }),
    ...(wcProjectId
      ? [walletConnect({ projectId: wcProjectId, metadata: { name: 'CryptoGuestbook', url: 'https://localhost', description: 'Encrypted On-Chain Guestbook', icons: [] } })]
      : [])
  ]
});

export const queryClient = new QueryClient();

