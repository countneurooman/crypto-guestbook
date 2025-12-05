//////////////////////////////////////////////////////////////////////////
//
// WARNING!!
// ALWAY USE DYNAMICALLY IMPORT THIS FILE TO AVOID INCLUDING THE ENTIRE 
// FHEVM MOCK LIB IN THE FINAL PRODUCTION BUNDLE!!
//
//////////////////////////////////////////////////////////////////////////

import { JsonRpcProvider, Contract } from "ethers";
import { MockFhevmInstance } from "@fhevm/mock-utils";
import { FhevmInstance } from "../../fhevmTypes";

export const fhevmMockCreateInstance = async (parameters: {
  rpcUrl: string;
  chainId: number;
  metadata: {
    ACLAddress: `0x${string}`;
    InputVerifierAddress: `0x${string}`;
    KMSVerifierAddress: `0x${string}`;
  };
}): Promise<FhevmInstance> => {
  const provider = new JsonRpcProvider(parameters.rpcUrl);
  
  // Query InputVerifier contract's EIP712 domain to get the correct chainId
  const inputVerifierContract = new Contract(
    parameters.metadata.InputVerifierAddress,
    ["function eip712Domain() external view returns (bytes1, string, string, uint256, address, bytes32, uint256[])"],
    provider
  );
  const domain = await inputVerifierContract.eip712Domain();
  
  // EIP712 domain structure:
  // [0] bytes1 fields
  // [1] string name
  // [2] string version
  // [3] uint256 chainId (this is the gatewayChainId we need)
  // [4] address verifyingContract
  // [5] bytes32 salt
  // [6] uint256[] extensions
  const gatewayChainId = Number(domain[3]); // Get chainId from EIP712 domain
  const verifyingContractAddressInputVerification = domain[4]; // index 4 is the verifyingContract address

  console.log('[fhevmMock] EIP712 domain info:', {
    chainId: gatewayChainId,
    verifyingContract: verifyingContractAddressInputVerification,
    name: domain[1],
    version: domain[2]
  });

  const instance = await MockFhevmInstance.create(
    provider,
    provider,
    {
      aclContractAddress: parameters.metadata.ACLAddress,
      chainId: parameters.chainId,
      gatewayChainId: gatewayChainId, // Use chainId from EIP712 domain
      inputVerifierContractAddress: parameters.metadata.InputVerifierAddress,
      kmsContractAddress: parameters.metadata.KMSVerifierAddress,
      verifyingContractAddressDecryption:
        "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
      verifyingContractAddressInputVerification: verifyingContractAddressInputVerification,
    },
    {
      // v0.3.0 requires the 4th parameter: properties
      inputVerifierProperties: {},
      kmsVerifierProperties: {},
    }
  );
  
  // Type assertion: MockFhevmInstance → FhevmInstance
  return instance as unknown as FhevmInstance;
};

