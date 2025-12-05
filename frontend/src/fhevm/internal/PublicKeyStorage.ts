export type StoredPublicData = {
  publicKey: { data: string | null; id: string | null } | null;
  publicParams: { bits: number; publicParams: string; publicParamsId: string } | null;
};

export type LoadedPublicData = {
  publicKey: { data: Uint8Array | null; id: string | null } | null;
  publicParams: Record<number, { publicParams: Uint8Array; publicParamsId: string }> | null;
};

const STORAGE_PREFIX = "fhevm_pubkey_";

function getStorageKey(aclAddress: `0x${string}`): string {
  return `${STORAGE_PREFIX}${aclAddress.toLowerCase()}`;
}

function u8ToB64(data: Uint8Array | null | undefined): string | null {
  if (!data || data.byteLength === 0) return null;
  let s = "";
  for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]);
  return btoa(s);
}

function b64ToU8(s: string | null | undefined): Uint8Array | null {
  if (!s) return null;
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function publicKeyStorageGet(aclAddress: `0x${string}`): Promise<LoadedPublicData> {
  try {
    const key = getStorageKey(aclAddress);
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { publicKey: null, publicParams: null };
    }
    const parsed = JSON.parse(raw) as StoredPublicData;
    const loadedPublicKey = parsed?.publicKey
      ? { id: parsed.publicKey.id ?? null, data: b64ToU8(parsed.publicKey.data) }
      : null;
    const loadedParams = parsed?.publicParams
      ? {
          [parsed.publicParams.bits]: {
            publicParams: b64ToU8(parsed.publicParams.publicParams) as Uint8Array,
            publicParamsId: parsed.publicParams.publicParamsId,
          },
        }
      : null;
    return { publicKey: loadedPublicKey, publicParams: loadedParams };
  } catch {
    return { publicKey: null, publicParams: null };
  }
}

export async function publicKeyStorageSet(
  aclAddress: `0x${string}`,
  publicKey: { publicKeyId: string; publicKey: Uint8Array } | null,
  publicParams: { publicParams: Uint8Array; publicParamsId: string } | null,
  bits: number = 2048
): Promise<void> {
  try {
    const key = getStorageKey(aclAddress);
    const payload: StoredPublicData = {
      publicKey: publicKey ? { id: publicKey.publicKeyId ?? null, data: u8ToB64(publicKey.publicKey) } : null,
      publicParams: publicParams
        ? { bits, publicParamsId: publicParams.publicParamsId, publicParams: u8ToB64(publicParams.publicParams) as string }
        : null,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore persistence errors
  }
}

