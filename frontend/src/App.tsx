import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import addresses from './abi/addresses.json';
import abi from './abi/GuestBookABI.json';
import { useFhevm } from './fhevm/useFhevm';
import { GenericStringInMemoryStorage } from './fhevm/GenericStringStorage';
import { ethers } from 'ethers';
import { useFHEGuestBook } from './hooks/useFHEGuestBook';

type Addresses = Record<string, Record<string, `0x${string}`>>;

function useContractAddress() {
  const chainId = useChainId();
  const addr = (addresses as Addresses)?.GuestBook?.[String(chainId)];
  return addr as `0x${string}` | undefined;
}

function formatAddress(a?: string) {
  if (!a) return '';
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

// Icon Components
const WalletIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
  </svg>
);

const MessageIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const UsersIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const ChainIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const PauseIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </svg>
);

const PlayIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5,3 19,12 5,21"/>
  </svg>
);

const RefreshIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23,4 23,10 17,10"/>
    <polyline points="1,20 1,14 7,14"/>
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
  </svg>
);

const LockIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function App() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const contractAddress = useContractAddress();
  const publicClient = usePublicClient({ chainId });
  const { connectors, connect, status: connectStatus, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const isConnectorReady = (c: any) => {
    if (typeof c?.ready === 'boolean') return c.ready;
    const id = (c?.id ?? c?.type ?? c?.name ?? '').toString().toLowerCase();
    if (id.includes('metamask') || id.includes('injected')) {
      return typeof window !== 'undefined' && Boolean((window as any).ethereum?.isMetaMask);
    }
    if (id.includes('walletconnect')) return true;
    return true;
  };
  const noConnectorReady = useMemo(() => connectors.length > 0 && connectors.every((c) => !isConnectorReady(c as any)), [connectors]);
  const [content, setContent] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const { data: paused } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'paused',
    query: { enabled: Boolean(contractAddress) }
  }) as { data: boolean | undefined };

  const { data: owner } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'owner',
    query: { enabled: Boolean(contractAddress) }
  }) as { data: `0x${string}` | undefined };

  const { data: total } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'totalMessages',
    query: { enabled: Boolean(contractAddress) }
  }) as { data: bigint | undefined };

  const { data: myMsg } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'getMyMessage',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: Boolean(contractAddress && address) }
  }) as { data: readonly [boolean, `0x${string}`, bigint, string] | undefined };

  const { data: pageData, refetch: refetchPage } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'getMessages',
    args: [BigInt(offset), BigInt(limit)],
    query: { enabled: Boolean(contractAddress) }
  }) as { data: readonly [`0x${string}`[], bigint[], string[]] | undefined; refetch: () => any };

  const isOwner = useMemo(() => owner && address && owner.toLowerCase() === address.toLowerCase(), [owner, address]);

  const { writeContract, data: txHash, error: writeError, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({ chainId, hash: txHash, confirmations: 1, timeout: 15000 });

  const [isEstimatingGas, setIsEstimatingGas] = useState(false);
  const [lastTransactionType, setLastTransactionType] = useState<'submit' | 'pause' | 'unpause' | null>(null);
  const handleSubmit = async () => {
    if (!contractAddress || !content.trim()) return;
    setLastTransactionType('submit');
    try {
      setIsEstimatingGas(true);
      const sim = await publicClient?.simulateContract({
        address: contractAddress,
        abi,
        functionName: 'submitMessage',
        args: [content.trim()],
        account: address,
      });
      if (sim?.request) {
        writeContract(sim.request as any);
        return;
      }
      writeContract({ address: contractAddress, abi, functionName: 'submitMessage', args: [content.trim()] });
    } catch (e) {
      writeContract({ address: contractAddress, abi, functionName: 'submitMessage', args: [content.trim()] });
    } finally {
      setIsEstimatingGas(false);
    }
  };

  const handlePause = (doPause: boolean) => {
    if (!contractAddress) return;
    setLastTransactionType(doPause ? 'pause' : 'unpause');
    writeContract({ address: contractAddress, abi, functionName: doPause ? 'pause' : 'unpause' });
  };

  // ---------------- FHEVM integration (Relayer SDK on public nets / mock on localhost) ----------------
  const [ethersProvider, setEthersProvider] = useState<ethers.BrowserProvider | undefined>(undefined);
  const [ethersSigner, setEthersSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);
  const [ethersReadonly, setEthersReadonly] = useState<ethers.JsonRpcProvider | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const p = new ethers.BrowserProvider((window as any).ethereum, 'any');
      setEthersProvider(p);
      p.getSigner().then(setEthersSigner).catch(() => setEthersSigner(undefined));
    } else {
      setEthersProvider(undefined);
      setEthersSigner(undefined);
    }
  }, [isConnected]);

  useEffect(() => {
    const url = (publicClient as any)?.transport?.url as string | undefined;
    if (url) {
      setEthersReadonly(new ethers.JsonRpcProvider(url));
    } else {
      setEthersReadonly(undefined);
    }
  }, [publicClient]);

  const sameChainRef = useRef<(cid: number | undefined) => boolean>(() => true);
  const sameSignerRef = useRef<(s: ethers.JsonRpcSigner | undefined) => boolean>(() => true);
  sameChainRef.current = (cid: number | undefined) => cid === chainId;
  sameSignerRef.current = (s: ethers.JsonRpcSigner | undefined) => !!(s && ethersSigner && s.address === ethersSigner.address);

  const { instance: fhevm, status: fheStatus } = useFhevm({
    provider: (publicClient as any)?.transport?.url ?? (ethersProvider as any),
    chainId,
    initialMockChains: { 31337: 'http://localhost:8545' },
    enabled: true,
  });
  const storage = useMemo(() => new GenericStringInMemoryStorage(), []);

  const {
    contractAddress: fheContractAddress,
    canGetEncTotal,
    refreshEncTotalHandle,
    canDecrypt,
    decryptEncTotal,
    isRefreshing: fheRefreshing,
    isDecrypting: fheDecrypting,
    isDecrypted: fheDecrypted,
    clear: fheClear,
    handle: fheHandle,
    message: fheMessage,
  } = useFHEGuestBook({
    instance: fhevm,
    fhevmDecryptionSignatureStorage: storage,
    eip1193Provider: (ethersProvider as any),
    chainId,
    ethersSigner,
    ethersReadonlyProvider: ethersReadonly,
    sameChain: sameChainRef,
    sameSigner: sameSignerRef,
  });

  const getFhevmStatusText = (status: string) => {
    switch (status) {
      case 'idle': return 'Initializing';
      case 'loading': return 'Loading encryption system';
      case 'ready': return 'Encryption ready';
      case 'error': return 'Connection failed';
      default: return 'Checking connection';
    }
  };

  const getConnectionStatusText = (connected: boolean, status: string) => {
    if (connected) return 'Wallet connected';
    if (status === 'pending') return 'Connecting wallet';
    return 'No wallet connected';
  };

  if (!contractAddress) {
    return (
      <div className="app">
        <div className="main-content">
          <div className="card">
            <div style={{textAlign: 'center', padding: '2rem'}}>
              <ChainIcon />
              <h1 style={{margin: '1rem 0', fontSize: '2rem'}}>Crypto Guestbook</h1>
              <p style={{fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: '1rem'}}>Network: Chain {chainId}</p>
              <p style={{color: 'var(--error)'}}>Contract not deployed on this network. Please check your connection or deploy the contract first.</p>
              {fheStatus !== 'ready' && (
                <p style={{marginTop: '0.5rem', color: 'var(--text-muted)'}}>Encryption status: {getFhevmStatusText(fheStatus)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">
          <LockIcon />
          <h1>Crypto Guestbook</h1>
        </div>
        
        <div className="status-section">
          <div className="status-item">
            <span className="status-label">Network</span>
            <span className="status-value">Chain {chainId}</span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Contract</span>
            <span className="status-value font-mono">{formatAddress(contractAddress)}</span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Encryption</span>
            <span className={`status-value ${fheStatus === 'ready' ? 'text-success' : ''}`}>
              {getFhevmStatusText(fheStatus)}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Guestbook</span>
            <span className={`status-value ${paused === true ? 'text-warning' : paused === false ? 'text-success' : ''}`}>
              {paused === undefined ? 'Loading...' : paused ? 'Paused' : 'Active'}
            </span>
          </div>
        </div>
        
        <div className="wallet-section">
          <div className="connection-status">
            <div className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
              <WalletIcon />
              {getConnectionStatusText(isConnected, connectStatus)}
            </div>
            
            {isConnected && address && (
              <div style={{marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)'}}>
                <span className="font-mono">{formatAddress(address)}</span>
              </div>
            )}
          </div>
          
          {isConnected ? (
            <button className="btn btn-secondary" onClick={() => disconnect()}>
              Disconnect Wallet
            </button>
          ) : (
            <div className="wallet-connectors">
              {connectors.map((c) => (
                <button
                  key={c.uid}
                  className="btn btn-primary"
                  onClick={() => {
                    const ready = isConnectorReady(c as any);
                    if (!ready) {
                      const id = (c as any)?.id ?? (c as any)?.type ?? c.name;
                      const idStr = String(id).toLowerCase();
                      if (idStr.includes('metamask') || idStr.includes('injected')) {
                        window.open('https://metamask.io/download/', '_blank');
                        return;
                      }
                      return;
                    }
                    connect({ connector: c });
                  }}
                  disabled={connectStatus === 'pending'}
                >
                  <WalletIcon />
                  {connectStatus === 'pending' ? 'Connecting...' : `Connect ${c.name}`}
                </button>
              ))}
            </div>
          )}
          
          {connectStatus === 'error' && (
            <div className="alert alert-error">
              Failed to connect wallet: {String(connectError?.message?.split('.')[0] || 'Please try again')}
            </div>
          )}
          
          {noConnectorReady && (
            <div className="alert alert-warning">
              No wallet detected. Please install{' '}
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask</a>.
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">


        {/* Admin Section */}
        {isOwner && (
          <div className="card">
            <h2>Admin Controls</h2>
            <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>
              You are the contract owner. You can pause or resume message submissions.
            </p>
            <div className="status-grid">
              <button 
                className="btn btn-warning" 
                onClick={() => handlePause(true)} 
                disabled={paused !== false || isPending || isConfirming}
              >
                <PauseIcon />
                {isPending && paused === false ? 'Pausing...' : 'Pause Guestbook'}
              </button>
              <button 
                className="btn btn-success" 
                onClick={() => handlePause(false)} 
                disabled={paused !== true || isPending || isConfirming}
              >
                <PlayIcon />
                {isPending && paused === true ? 'Resuming...' : 'Resume Guestbook'}
              </button>
            </div>
            
            {isConfirmed && lastTransactionType === 'pause' && (
              <div className="alert alert-success" style={{marginTop: '1rem'}}>
                Success! The guestbook has been paused. New message submissions are now disabled.
              </div>
            )}
            
            {isConfirmed && lastTransactionType === 'unpause' && (
              <div className="alert alert-success" style={{marginTop: '1rem'}}>
                Success! The guestbook has been resumed. Users can now submit messages again.
              </div>
            )}
            
            {writeError && lastTransactionType && (lastTransactionType === 'pause' || lastTransactionType === 'unpause') && (
              <div className="alert alert-error" style={{marginTop: '1rem'}}>
                Failed to {lastTransactionType === 'pause' ? 'pause' : 'resume'} guestbook: {writeError.message?.includes('rejected') ? 'Transaction was rejected' : 'Please try again'}
              </div>
            )}
            
            {!writeError && confirmError && lastTransactionType && (lastTransactionType === 'pause' || lastTransactionType === 'unpause') && (
              <div className="alert alert-error" style={{marginTop: '1rem'}}>
                Transaction failed to complete. Please check your network connection and try again.
              </div>
            )}
          </div>
        )}

        {/* Submit Message Section */}
        <div className="card">
          <h2>
            <MessageIcon />
            Share Your Thoughts
          </h2>
          {!isConnected ? (
            <div className="empty-state">
              <WalletIcon />
              <p>Connect your wallet to leave a message on the blockchain.</p>
            </div>
          ) : paused === true ? (
            <div className="empty-state">
              <PauseIcon />
              <p>The guestbook is currently paused. New messages cannot be submitted at this time.</p>
            </div>
          ) : myMsg && myMsg[0] ? (
            <div className="empty-state">
              <MessageIcon />
              <p>You have already submitted your message. Each address can only leave one message.</p>
            </div>
          ) : (
            <div className="submit-form">
              <textarea
                className="content-input"
                placeholder="What's on your mind? Share your thoughts with the world... (1-280 characters)"
                maxLength={280}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
              <div className="form-footer">
                <span className="char-count">{content.length}/280 characters</span>
                <button 
                  className="btn btn-primary btn-large" 
                  onClick={handleSubmit} 
                  disabled={!content.trim() || isPending || isConfirming || isEstimatingGas}
                >
                  {isPending ? 'Waiting for confirmation...' : 
                   isConfirming ? 'Processing transaction...' : 
                   isEstimatingGas ? 'Preparing transaction...' : 
                   'Publish Message'}
                </button>
              </div>
            </div>
          )}
          {writeError && (
            <div className="alert alert-error">
              Failed to submit message: {writeError.message?.includes('rejected') ? 'Transaction was rejected' : 'Please try again'}
            </div>
          )}
          {!writeError && confirmError && (
            <div className="alert alert-error">
              Transaction failed to complete. Please check your network connection and try again.
            </div>
          )}
          {isConfirmed && lastTransactionType === 'submit' && (
            <div className="alert alert-success">
              Success! Your message has been published to the blockchain and will appear below.
            </div>
          )}
        </div>

        {/* My Message Section */}
        {myMsg && myMsg[0] && (
          <div className="card">
            <h2>Your Message</h2>
            <div className="message-card my-message">
              <div className="message-header">
                <span className="address font-mono">{formatAddress(myMsg[1])}</span>
                <span className="timestamp">
                  Published {new Date(Number(myMsg[2]) * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="message-content">{myMsg[3]}</div>
            </div>
          </div>
        )}

        {/* Message Board */}
        <div className="card">
          <div className="section-header">
            <h2>Community Messages</h2>
            <div style={{display: 'flex', gap: '1rem'}}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setOffset(0);
                  setTimeout(() => refetchPage(), 0);
                }}
                style={{width: 'auto'}}
              >
                <RefreshIcon />
                Refresh
              </button>
            </div>
          </div>
          
          <div className="messages-grid">
            {pageData && pageData[0].length > 0 ? (
              pageData[0].map((addr, i) => (
                <div className="message-card" key={`${addr}-${i}`}>
                  <div className="message-header">
                    <span className="address font-mono">{formatAddress(addr)}</span>
                    <span className="timestamp">
                      {new Date(Number(pageData[1][i]) * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="message-content">{pageData[2][i]}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <UsersIcon />
                <p>No messages have been shared yet. Be the first to leave your mark!</p>
              </div>
            )}
          </div>
          
          {pageData && pageData[0].length > 0 && total && offset + limit < Number(total) ? (
            <div className="pagination">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const next = offset + limit;
                  setOffset(next);
                  setTimeout(() => refetchPage(), 0);
                }}
                style={{width: 'auto'}}
              >
                Load More Messages ({Number(total) - offset - limit} remaining)
              </button>
            </div>
          ) : null}
        </div>

        {/* FHEVM Encryption Demo */}
        {fheContractAddress && (
          <div className="card">
            <h2>
              <LockIcon />
              Encrypted Message Counter
            </h2>
            <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>
              This demonstrates FHEVM's encrypted computation. The message count is stored encrypted on-chain and can be decrypted using your private key.
            </p>
            
            <div className="status-grid">
              <div className="stat-card">
                <span className="stat-label">Encrypted Data</span>
                <div style={{fontSize: '0.875rem', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace', marginTop: '0.5rem'}}>
                  {fheHandle ? `${String(fheHandle).slice(0, 20)}...` : 'Not loaded'}
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-number">{typeof fheClear === 'bigint' ? Number(fheClear) : (fheClear ? String(fheClear) : '?')}</span>
                <span className="stat-label">Decrypted Count</span>
              </div>
            </div>
            
            <div className="status-grid" style={{marginTop: '1.5rem'}}>
              <button
                className="btn btn-secondary"
                onClick={refreshEncTotalHandle}
                disabled={!canGetEncTotal || fheRefreshing}
                style={{width: 'auto'}}
              >
                <RefreshIcon />
                {fheRefreshing ? 'Loading...' : 'Refresh Data'}
              </button>
              <button
                className="btn btn-primary"
                onClick={decryptEncTotal}
                disabled={!canDecrypt || fheDecrypting}
                style={{width: 'auto'}}
              >
                <LockIcon />
                {fheDecrypting ? 'Decrypting...' : 'Decrypt Count'}
              </button>
            </div>
            
            {!fheHandle && canGetEncTotal && (
              <div className="alert alert-warning" style={{marginTop: '1rem'}}>
                Click "Refresh Data" to load the encrypted message counter from the blockchain.
              </div>
            )}
            
            {fheMessage && (
              <div className={`alert ${fheMessage.includes('failed') || fheMessage.includes('Unable') || fheMessage.includes('invalid') ? 'alert-error' : 'alert-warning'}`} style={{marginTop: '1rem'}}>
                {fheMessage}
              </div>
            )}
            
            {!canDecrypt && fheHandle && fheHandle !== ethers.ZeroHash && (
              <div className="alert alert-warning" style={{marginTop: '1rem'}}>
                {!fhevm ? 'Encryption system not ready. Please wait...' :
                 !ethersSigner ? 'Please connect your wallet to decrypt the message count.' :
                 fheDecrypting ? 'Decrypting...' :
                 fheRefreshing ? 'Loading encrypted data...' :
                 'Ready to decrypt. Click the button above.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

