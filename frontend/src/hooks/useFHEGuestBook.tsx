import { ethers } from 'ethers';
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FhevmInstance } from '../fhevm/fhevmTypes';
import { FhevmDecryptionSignature } from '../fhevm/FhevmDecryptionSignature';
import { GenericStringStorage } from '../fhevm/GenericStringStorage';
import addresses from '../abi/addresses.json';
import abi from '../abi/GuestBookABI.json';

type Addresses = Record<string, Record<string, `0x${string}`>>;

function getGuestBookByChainId(chainId: number | undefined) {
  const entry = chainId ? (addresses as Addresses)?.GuestBook?.[String(chainId)] : undefined;
  return { address: entry as `0x${string}` | undefined, abi };
}

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

export const useFHEGuestBook = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<(ethersSigner: ethers.JsonRpcSigner | undefined) => boolean>;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = parameters;

  const [encTotalHandle, setEncTotalHandle] = useState<string | undefined>(undefined);
  const [clearTotal, setClearTotal] = useState<ClearValueType | undefined>(undefined);
  const clearTotalRef = useRef<ClearValueType>(undefined as any);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const contract = useMemo(() => getGuestBookByChainId(chainId), [chainId]);
  const isDeployed = useMemo(() => Boolean(contract.address), [contract.address]);
  const isDecrypted = encTotalHandle && encTotalHandle === clearTotal?.handle;

  const canGetEncTotal = useMemo(() => {
    return contract.address && ethersReadonlyProvider && !isRefreshing;
  }, [contract.address, ethersReadonlyProvider, isRefreshing]);

  const refreshEncTotalHandle = useCallback(() => {
    if (!contract.address || !ethersReadonlyProvider) {
      setEncTotalHandle(undefined);
      return;
    }
    setIsRefreshing(true);
    const c = new ethers.Contract(contract.address, contract.abi, ethersReadonlyProvider);
    c.getEncTotal()
      .then((value: string) => {
        const sameChainFn = sameChain.current ?? (() => true);
        if (sameChainFn(chainId) && contract.address === c.target) {
          setEncTotalHandle(value);
        }
      })
      .catch((e: any) => setMessage("getEncTotal() failed: " + String(e?.message || e)))
      .finally(() => setIsRefreshing(false));
  }, [contract.address, contract.abi, ethersReadonlyProvider, chainId, sameChain]);

  useEffect(() => {
    refreshEncTotalHandle();
  }, [refreshEncTotalHandle]);

  const canDecrypt = useMemo(() => {
    return (
      contract.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isDecrypting &&
      encTotalHandle &&
      encTotalHandle !== ethers.ZeroHash &&
      encTotalHandle !== clearTotal?.handle
    );
  }, [contract.address, instance, ethersSigner, isRefreshing, isDecrypting, encTotalHandle, clearTotal]);

  const decryptEncTotal = useCallback(() => {
    if (!contract.address || !instance || !ethersSigner) return;
    if (encTotalHandle === clearTotalRef.current?.handle) return;
    if (!encTotalHandle) {
      setClearTotal(undefined);
      clearTotalRef.current = undefined as any;
      return;
    }
    if (encTotalHandle === ethers.ZeroHash) {
      setClearTotal({ handle: encTotalHandle, clear: BigInt(0) });
      clearTotalRef.current = { handle: encTotalHandle, clear: BigInt(0) };
      return;
    }

    const thisChainId = chainId;
    const thisAddress = contract.address;
    const thisHandle = encTotalHandle;
    const thisSigner = ethersSigner;

    setIsDecrypting(true);
    setMessage("Start decrypt total");

    const isStale = () => {
      const sameChainFn = sameChain.current ?? (() => true);
      const sameSignerFn = sameSigner.current ?? (() => true);
      return thisAddress !== contract.address || !sameChainFn(thisChainId) || !sameSignerFn(thisSigner);
    };

    (async () => {
      try {
        console.log('[useFHEGuestBook] Starting decryption...', {
          contractAddress: thisAddress,
          handle: thisHandle,
          chainId: thisChainId
        });

        // First, ensure the user is authorized to decrypt by calling allowUserToDecrypt
        try {
          console.log('[useFHEGuestBook] Authorizing user for decryption...');
          const contract = new ethers.Contract(thisAddress, abi, thisSigner);
          const tx = await contract.allowUserToDecrypt(thisSigner.address);
          await tx.wait();
          console.log('[useFHEGuestBook] User authorized for decryption');
        } catch (authError: any) {
          // If authorization fails, continue anyway (user might already be authorized)
          console.warn('[useFHEGuestBook] Authorization warning (may already be authorized):', authError?.message);
        }

        let sig: FhevmDecryptionSignature | null = null;
        try {
          sig = await FhevmDecryptionSignature.loadOrSign(
            instance,
            [thisAddress as `0x${string}`],
            thisSigner,
            fhevmDecryptionSignatureStorage
          );
        } catch (signError: any) {
          console.error('[useFHEGuestBook] Signature creation error:', signError);
          let errorMsg = "Unable to build FHEVM decryption signature.";
          
          if (signError?.message) {
            if (signError.message.includes('rejected') || signError.message.includes('denied')) {
              errorMsg = "Signature request was rejected. Please approve the signature request in your wallet.";
            } else if (signError.message.includes('not support')) {
              errorMsg = "Your wallet does not support EIP712 signing. Please use MetaMask or another compatible wallet.";
            } else if (signError.message.includes('network') || signError.message.includes('connection')) {
              errorMsg = "Network error. Please check your connection and try again.";
            } else {
              errorMsg = `Signature error: ${signError.message}`;
            }
          }
          
          setMessage(errorMsg);
          setIsDecrypting(false);
          return;
        }
        
        if (!sig) {
          const errorMsg = "Unable to build FHEVM decryption signature. Please check your wallet connection and try again.";
          console.error('[useFHEGuestBook] Signature is null');
          setMessage(errorMsg);
          setIsDecrypting(false);
          return;
        }
        
        if (isStale()) {
          console.log('[useFHEGuestBook] Operation stale, aborting');
          setIsDecrypting(false);
          return;
        }

        console.log('[useFHEGuestBook] Calling userDecrypt...');
        const res = await instance.userDecrypt(
          [{ handle: thisHandle, contractAddress: thisAddress! }],
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        if (isStale()) {
          console.log('[useFHEGuestBook] Operation stale after decrypt, aborting');
          setIsDecrypting(false);
          return;
        }
        
        console.log('[useFHEGuestBook] Decryption result:', res);
        const clearValue = (res as Record<string, string | bigint | boolean>)[thisHandle];
        
        if (clearValue === undefined) {
          const errorMsg = "Decryption completed but no value found for this handle. The encrypted data may be invalid.";
          console.error('[useFHEGuestBook] No value in result:', res);
          setMessage(errorMsg);
          setIsDecrypting(false);
          return;
        }
        
        setClearTotal({ handle: thisHandle, clear: clearValue });
        clearTotalRef.current = { handle: thisHandle, clear: clearValue };
        setMessage("");
        console.log('[useFHEGuestBook] Decryption successful:', clearValue);
      } catch (error: any) {
        console.error('[useFHEGuestBook] Decryption error:', error);
        const errorMsg = error?.message 
          ? `Decryption failed: ${error.message}` 
          : "Decryption failed. Please check the console for details and ensure your wallet is connected.";
        setMessage(errorMsg);
      } finally {
        setIsDecrypting(false);
      }
    })();
  }, [contract.address, instance, ethersSigner, encTotalHandle, chainId, sameChain, sameSigner, fhevmDecryptionSignatureStorage]);

  return {
    contractAddress: contract.address,
    canGetEncTotal,
    refreshEncTotalHandle,
    canDecrypt,
    decryptEncTotal,
    isRefreshing,
    isDecrypting,
    isDecrypted,
    clear: clearTotal?.clear,
    handle: encTotalHandle,
    message,
    isDeployed
  };
};

