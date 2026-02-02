import { ethers } from 'hardhat';

/**
 * Deploy script for CTOTreasuryVesting
 *
 * Usage (env or args):
 *  - TOKEN_ADDRESS (or first arg): ERC20 token address (18 decimals assumed)
 *  - CTO_ADDRESS (or second arg): CTO address (will be owner)
 *
 * Example:
 * npx hardhat run scripts/deployCTOTreasury.ts --network local --TOKEN_ADDRESS=0x... --CTO_ADDRESS=0x...
 * or
 * npx hardhat run scripts/deployCTOTreasury.ts --network local 0xTokenAddr 0xCtoAddr
 */

async function main() {
  const argToken = process.argv[2];
  const argCto = process.argv[3];
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || argToken;
  const CTO_ADDRESS = process.env.CTO_ADDRESS || argCto;

  if (!TOKEN_ADDRESS || !CTO_ADDRESS) {
    console.error('Usage: set TOKEN_ADDRESS and CTO_ADDRESS (env or args)');
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  // Deploy CTOTreasuryVesting
  const Factory = await ethers.getContractFactory('CTOTreasuryVesting');
  const deployed = await Factory.deploy(TOKEN_ADDRESS, CTO_ADDRESS);
  await deployed.waitForDeployment?.();
  const contractAddress = await deployed.getAddress();
  console.log('CTOTreasuryVesting deployed to', contractAddress);

  // Fund contract with 75_000_000 native tokens (18 decimals assumed)
  const FUND_AMOUNT = ethers.parseUnits('75000000', 18);
  const deployerBalance = await deployer.getBalance();
  console.log('Deployer native balance:', ethers.formatEther(deployerBalance));

  if (deployerBalance < FUND_AMOUNT) {
    console.warn('Deployer has insufficient native token balance to fully fund the treasury. Transfer tokens manually or fund partially.');
  }

  try {
    const tx = await deployer.sendTransaction({ to: contractAddress, value: FUND_AMOUNT });
    await tx.wait();
    console.log('Transferred', FUND_AMOUNT.toString(), 'native tokens to', contractAddress);
  } catch (err) {
    console.warn('Native transfer failed or partial funding required:', (err as Error).message);
  }

  console.log('\nNext steps:');
  console.log('- Ensure the CTO (owner) calls `startVesting()` once ready (only owner can start).');
  console.log('- CTO can call `release()` to claim vested tokens each month.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
