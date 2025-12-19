import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { WagmiProvider } from 'wagmi';
import { config, queryClient } from './wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import './style.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);

