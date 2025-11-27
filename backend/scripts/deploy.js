import hre from 'hardhat';
const { artifacts, ethers } = hre;
import fs from 'fs/promises';
import path from 'path';

function getCliArg(name) {
  // Support both --name value and --name=value formats
  const flag = `--${name}`;
  const eqPrefix = `${flag}=`;
  for (let i = 0; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === flag && i + 1 < process.argv.length) return process.argv[i + 1];
    if (a.startsWith(eqPrefix)) return a.slice(eqPrefix.length);
  }
  return undefined;
}

async function resolveDeployer() {
  const cliIndex = getCliArg('deployer-index');
  const cliAddress = getCliArg('deployer-address');
  const cliPk = getCliArg('deployer-pk');

  const envIndex = process.env.DEPLOYER_INDEX;
  const envAddress = process.env.DEPLOYER_ADDRESS;
  const envPk = process.env.DEPLOYER_PK;

  const indexStr = cliIndex ?? envIndex;
  const addressStr = (cliAddress ?? envAddress)?.trim();
  const pkStr = (cliPk ?? envPk)?.trim();

  if (pkStr) {
    return new ethers.Wallet(pkStr, ethers.provider);
  }

  const signers = await ethers.getSigners();

  if (addressStr) {
    // Find the address in known signers
    for (const s of signers) {
      const a = await s.getAddress();
      if (a.toLowerCase() === addressStr.toLowerCase()) return s;
    }
    // Try to get from provider (if current node supports it)
    try {
      const s = await ethers.getSigner(addressStr);
      return s;
    } catch {}
    throw new Error(`Specified deployer address not available: ${addressStr}`);
  }

  if (indexStr !== undefined) {
    const idx = Number(indexStr);
    if (!Number.isInteger(idx) || idx < 0 || idx >= signers.length) {
      throw new Error(`Invalid DEPLOYER_INDEX: ${indexStr}. Available range: 0..${signers.length - 1}`);
    }
    return signers[idx];
  }

  // Default to first signer
  return signers[0];
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function writeFrontendFiles(contractName, address, chainId) {
  const frontendAbiDir = path.resolve('../frontend/src/abi');
  await ensureDir(frontendAbiDir);

  const artifact = await artifacts.readArtifact(contractName);
  const abiPath = path.join(frontendAbiDir, `${contractName}ABI.json`);
  await fs.writeFile(abiPath, JSON.stringify(artifact.abi, null, 2));

  const addressesPath = path.join(frontendAbiDir, 'addresses.json');
  let addresses = {};
  try {
    const raw = await fs.readFile(addressesPath, 'utf-8');
    addresses = JSON.parse(raw);
  } catch {}
  if (!addresses[contractName]) addresses[contractName] = {};
  addresses[contractName][String(chainId)] = address;
  await fs.writeFile(addressesPath, JSON.stringify(addresses, null, 2));
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const deployer = await resolveDeployer();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log('Network chainId:', network.chainId.toString());
  console.log('Deployer:', deployerAddress);
  console.log('Deployer balance:', ethers.formatEther(balance), 'ETH');

  const Contract = await ethers.getContractFactory('GuestBook', deployer);
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`GuestBook deployed to ${address} on chainId ${network.chainId}`);

  await writeFrontendFiles('GuestBook', address, network.chainId);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

