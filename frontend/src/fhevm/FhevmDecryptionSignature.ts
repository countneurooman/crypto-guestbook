import { ethers } from "ethers";
import {
  EIP712Type,
  FhevmDecryptionSignatureType,
  FhevmInstance,
} from "./fhevmTypes";
import { GenericStringStorage } from "./GenericStringStorage";

function _timestampNow(): number {
  return Math.floor(Date.now() / 1000);
}

class FhevmDecryptionSignatureStorageKey {
  #contractAddresses: `0x${string}`[];
  #userAddress: `0x${string}`;
  #publicKey: string | undefined;
  #key: string;

  constructor(
    instance: FhevmInstance,
    contractAddresses: string[],
    userAddress: string,
    publicKey?: string
  ) {
    if (!ethers.isAddress(userAddress)) {
      throw new TypeError(`Invalid address ${userAddress}`);
    }

    const sortedContractAddresses = (
      contractAddresses as `0x${string}`[]
    ).sort();

    const emptyEIP712 = instance.createEIP712(
      publicKey ?? ethers.ZeroAddress,
      sortedContractAddresses,
      0,
      0
    );

    try {
      const hash = ethers.TypedDataEncoder.hash(
        emptyEIP712.domain,
        { UserDecryptRequestVerification: emptyEIP712.types.UserDecryptRequestVerification },
        emptyEIP712.message
      );

      this.#contractAddresses = sortedContractAddresses;
      this.#userAddress = userAddress as `0x${string}`;

      this.#key = `${userAddress}:${hash}`;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  get contractAddresses(): `0x${string}`[] {
    return this.#contractAddresses;
  }

  get userAddress(): `0x${string}` {
    return this.#userAddress;
  }

  get publicKey(): string | undefined {
    return this.#publicKey;
  }

  get key(): string {
    return this.#key;
  }
}

export class FhevmDecryptionSignature {
  #publicKey: string;
  #privateKey: string;
  #signature: string;
  #startTimestamp: number; // Unix timestamp in seconds
  #durationDays: number;
  #userAddress: `0x${string}`;
  #contractAddresses: `0x${string}`[];
  #eip712: EIP712Type;

  private constructor(parameters: FhevmDecryptionSignatureType) {
    if (!FhevmDecryptionSignature.checkIs(parameters)) {
      throw new TypeError("Invalid FhevmDecryptionSignatureType");
    }
    this.#publicKey = parameters.publicKey;
    this.#privateKey = parameters.privateKey;
    this.#signature = parameters.signature;
    this.#startTimestamp = parameters.startTimestamp;
    this.#durationDays = parameters.durationDays;
    this.#userAddress = parameters.userAddress;
    this.#contractAddresses = parameters.contractAddresses;
    this.#eip712 = parameters.eip712;
  }

  public get privateKey() {
    return this.#privateKey;
  }

  public get publicKey() {
    return this.#publicKey;
  }

  public get signature() {
    return this.#signature;
  }

  public get contractAddresses() {
    return this.#contractAddresses;
  }

  public get startTimestamp() {
    return this.#startTimestamp;
  }

  public get durationDays() {
    return this.#durationDays;
  }

  public get userAddress() {
    return this.#userAddress;
  }

  static checkIs(s: unknown): s is FhevmDecryptionSignatureType {
    if (!s || typeof s !== "object") {
      return false;
    }
    if (!("publicKey" in s && typeof (s as any).publicKey === "string")) {
      return false;
    }
    if (!("privateKey" in s && typeof (s as any).privateKey === "string")) {
      return false;
    }
    if (!("signature" in s && typeof (s as any).signature === "string")) {
      return false;
    }
    if (!("startTimestamp" in s && typeof (s as any).startTimestamp === "number")) {
      return false;
    }
    if (!("durationDays" in s && typeof (s as any).durationDays === "number")) {
      return false;
    }
    if (!("contractAddresses" in s && Array.isArray((s as any).contractAddresses))) {
      return false;
    }
    for (let i = 0; i < (s as any).contractAddresses.length; ++i) {
      if (typeof (s as any).contractAddresses[i] !== "string") return false;
      if (!(s as any).contractAddresses[i].startsWith("0x")) return false;
    }
    if (
      !(
        "userAddress" in s &&
        typeof (s as any).userAddress === "string" &&
        (s as any).userAddress.startsWith("0x")
      )
    ) {
      return false;
    }
    if (!("eip712" in s && typeof (s as any).eip712 === "object" && (s as any).eip712 !== null)) {
      return false;
    }

    // Partial type check
    if (!("domain" in (s as any).eip712 && typeof (s as any).eip712.domain === "object")) {
      return false;
    }
    if (
      !("primaryType" in (s as any).eip712 && typeof (s as any).eip712.primaryType === "string")
    ) {
      return false;
    }
    if (!("message" in (s as any).eip712)) {
      return false;
    }
    if (
      !(
        "types" in (s as any).eip712 &&
        typeof (s as any).eip712.types === "object" &&
        (s as any).eip712.types !== null
      )
    ) {
      return false;
    }

    return true;
  }

  toJSON() {
    return {
      publicKey: this.#publicKey,
      privateKey: this.#privateKey,
      signature: this.#signature,
      startTimestamp: this.#startTimestamp,
      durationDays: this.#durationDays,
      userAddress: this.#userAddress,
      contractAddresses: this.#contractAddresses,
      eip712: this.#eip712,
    };
  }

  static fromJSON(json: unknown) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    return new FhevmDecryptionSignature(data as FhevmDecryptionSignatureType);
  }

  equals(s: FhevmDecryptionSignatureType) {
    return s.signature === this.#signature;
  }

  isValid(): boolean {
    return (
      _timestampNow() < this.#startTimestamp + this.#durationDays * 24 * 60 * 60
    );
  }

  async saveToGenericStringStorage(
    storage: GenericStringStorage,
    instance: FhevmInstance,
    withPublicKey: boolean
  ) {
    try {
      const value = JSON.stringify(this);

      const storageKey = new FhevmDecryptionSignatureStorageKey(
        instance,
        this.#contractAddresses,
        this.#userAddress,
        withPublicKey ? this.#publicKey : undefined
      );
      await storage.setItem(storageKey.key, value);
      console.log(
        `signature saved! contracts=${this.#contractAddresses.length}`
      );
    } catch {
      console.error(
        `FhevmDecryptionSignature.saveToGenericStringStorage() failed!`
      );
    }
  }

  static async loadFromGenericStringStorage(
    storage: GenericStringStorage,
    instance: FhevmInstance,
    contractAddresses: string[],
    userAddress: string,
    publicKey?: string
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const storageKey = new FhevmDecryptionSignatureStorageKey(
        instance,
        contractAddresses,
        userAddress,
        publicKey
      );

      const result = await storage.getItem(storageKey.key);

      if (!result) {
        console.warn(`Could not load signature! key=${storageKey.key}`);
        return null;
      }

      try {
        const kps = FhevmDecryptionSignature.fromJSON(result);
        if (!kps.isValid()) {
          return null;
        }

        return kps;
      } catch {
        return null;
      }
    } catch {
      console.error(
        `FhevmDecryptionSignature.loadFromGenericStringStorage() failed!`
      );
      return null;
    }
  }

  static async new(
    instance: FhevmInstance,
    contractAddresses: string[],
    publicKey: string,
    privateKey: string,
    signer: ethers.Signer
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const userAddress = (await signer.getAddress()) as `0x${string}`;
      const startTimestamp = _timestampNow();
      const durationDays = 365;
      const eip712 = instance.createEIP712(
        publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );
      
      console.log('[FhevmDecryptionSignature] Creating EIP712 signature...', {
        userAddress,
        contractAddresses,
        domain: eip712.domain,
        signerType: signer.constructor.name
      });
      
      // Prepare typed data for signing
      const domain = eip712.domain;
      const types = { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification };
      const value = eip712.message;
      
      let signature: string;
      
      // Try signTypedData method (ethers v6 standard)
      if (typeof (signer as any).signTypedData === 'function') {
        console.log('[FhevmDecryptionSignature] Using signTypedData method');
        signature = await (signer as any).signTypedData(domain, types, value);
      }
      // Try provider.send with eth_signTypedData_v4 (for JsonRpcSigner)
      else if ((signer as any).provider && typeof (signer as any).provider.send === 'function') {
        console.log('[FhevmDecryptionSignature] Using provider.send(eth_signTypedData_v4)');
        const typedData = {
          domain,
          types,
          primaryType: 'UserDecryptRequestVerification',
          message: value
        };
        signature = await (signer.provider as any).send('eth_signTypedData_v4', [
          userAddress,
          JSON.stringify(typedData)
        ]);
      }
      // Fallback: try _signTypedData method (some older implementations)
      else if (typeof (signer as any)._signTypedData === 'function') {
        console.log('[FhevmDecryptionSignature] Using _signTypedData method');
        signature = await (signer as any)._signTypedData(domain, types, value);
      }
      else {
        const errorMsg = 'Wallet does not support EIP712 signing. Please use MetaMask or another compatible wallet that supports EIP-712 typed data signing.';
        console.error('[FhevmDecryptionSignature] No signing method available', {
          hasSignTypedData: typeof (signer as any).signTypedData === 'function',
          hasProvider: !!(signer as any).provider,
          hasProviderSend: !!(signer as any).provider && typeof (signer as any).provider.send === 'function',
          hasSignTypedDataUnderscore: typeof (signer as any)._signTypedData === 'function'
        });
        throw new Error(errorMsg);
      }
      
      console.log('[FhevmDecryptionSignature] Signature created successfully');
      
      return new FhevmDecryptionSignature({
        publicKey,
        privateKey,
        contractAddresses: contractAddresses as `0x${string}`[],
        startTimestamp,
        durationDays,
        signature,
        eip712: eip712 as EIP712Type,
        userAddress,
      });
    } catch (error: any) {
      console.error('[FhevmDecryptionSignature] Failed to create signature:', error);
      throw error; // Re-throw to get error message
    }
  }

  static async loadOrSign(
    instance: FhevmInstance,
    contractAddresses: string[],
    signer: ethers.Signer,
    storage: GenericStringStorage,
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const userAddress = (await signer.getAddress()) as `0x${string}`;

      const cached: FhevmDecryptionSignature | null =
        await FhevmDecryptionSignature.loadFromGenericStringStorage(
          storage,
          instance,
          contractAddresses,
          userAddress,
          keyPair?.publicKey
        );

      if (cached) {
        console.log('[FhevmDecryptionSignature] Using cached signature');
        return cached;
      }

      console.log('[FhevmDecryptionSignature] Generating new signature...');
      const { publicKey, privateKey } = keyPair ?? instance.generateKeypair();

      const sig = await FhevmDecryptionSignature.new(
        instance,
        contractAddresses,
        publicKey,
        privateKey,
        signer
      );

      if (!sig) {
        throw new Error('Failed to create signature: returned null');
      }

      await sig.saveToGenericStringStorage(
        storage,
        instance,
        Boolean(keyPair?.publicKey)
      );

      return sig;
    } catch (error: any) {
      console.error('[FhevmDecryptionSignature] loadOrSign failed:', error);
      throw error; // Re-throw to propagate error message
    }
  }
}

