To deploy the SFC (Special Fee Contract) system for Pano Chain at genesis, you need to pre-deploy the contracts in the blockchain's genesis block. This involves setting up the contracts at specific fixed addresses with their bytecode and initial storage state. Based on the codebase, here's how to do it:

Prerequisites
Compile the contracts:

npx hardhat compile

This generates the bytecode in artifacts/contracts/.

Get the bytecode for each contract:

SFC implementation
NodeDriver implementation
NodeDriverAuth implementation
ConstantsManager
SubsidiesRegistry
ERC1967Proxy (for the proxies)
NetworkInitializer
Genesis Deployment Addresses
From the scripts and ignition modules, the contracts must be deployed at these specific addresses:

NodeDriver proxy: 0xd100a01e00000000000000000000000000000000
NodeDriverAuth proxy: 0xd100ae0000000000000000000000000000000000
SFC proxy: 0xfc00face00000000000000000000000000000000
SubsidiesRegistry proxy: 0x7d0E23398b6CA0eC7Cdb5b5Aad7F1b11215012d2
Deployment Steps

1. Deploy Implementation Contracts
First, deploy the implementation contracts at genesis. You'll need to choose addresses for them (they don't have to be fixed).

2. Deploy Proxy Contracts
Deploy ERC1967Proxy contracts at the fixed addresses above, with the constructor pointing to their respective implementations.

For each proxy, the constructor takes:

_logic: Address of the implementation contract
_data: Initialization data (can be empty 0x since initialization happens later)

3. Set Up Genesis Alloc
In your genesis JSON file, add these to the alloc section:
{
  "alloc": {
    "0xd100a01e00000000000000000000000000000000": {
      "balance": "0x0",
      "code": "0x<ERC1967Proxy_bytecode_with_constructor_args>"
    },
    "0xd100ae0000000000000000000000000000000000": {
      "balance": "0x0", 
      "code": "0x<ERC1967Proxy_bytecode_with_constructor_args>"
    },
    "0xfc00face00000000000000000000000000000000": {
      "balance": "0x0",
      "code": "0x<ERC1967Proxy_bytecode_with_constructor_args>"
    },
    "0x7d0E23398b6CA0eC7Cdb5b5Aad7F1b11215012d2": {
      "balance": "0x0",
      "code": "0x<ERC1967Proxy_bytecode_with_constructor_args>"
    },
    "<implementation_address_1>": {
      "balance": "0x0",
      "code": "0x<NodeDriver_implementation_bytecode>"
    },
    "<implementation_address_2>": {
      "balance": "0x0", 
      "code": "0x<NodeDriverAuth_implementation_bytecode>"
    },
    "<implementation_address_3>": {
      "balance": "0x0",
      "code": "0x<SFC_implementation_bytecode>"
    },
    "<implementation_address_4>": {
      "balance": "0x0",
      "code": "0x<SubsidiesRegistry_implementation_bytecode>"
    },
    "<network_initializer_address>": {
      "balance": "0x0",
      "code": "0x<NetworkInitializer_bytecode>"
    }
  }
}

4. Initialize the Contracts
After genesis, call the NetworkInitializer.initializeAll() function with the appropriate parameters:

initializeAll(
    sealedEpoch,      // Starting sealed epoch (usually 0)
    totalSupply,      // Initial total supply
    sfcAddress,       // SFC proxy address
    authAddress,      // NodeDriverAuth proxy address  
    driverAddress,    // NodeDriver proxy address
    evmWriterAddress, // EVM writer contract address
    ownerAddress      // Owner address
)

This will:

Initialize NodeDriver, NodeDriverAuth, and SFC
Create and configure ConstantsManager with default parameters
Set up the staking system

5. Additional Setup
Deploy and initialize SubsidiesRegistry separately if needed
Set up any additional contracts (EVMWriter, etc.)
Notes

The contracts use UUPS upgradeability, so they can be upgraded after deployment.

Make sure the EVM version in genesis supports the contract features (Cancun for this codebase).
Test thoroughly on a local network before mainnet deployment.

---
genesis info!
The total supply from genesis creation is distributed to accounts specified in the alloc section of your genesis JSON file. Here's how it works:

Genesis Total Supply Distribution
In the genesis block, the native token supply is allocated to specific addresses in the alloc section:

{
  "alloc": {
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e": {
      "balance": "1000000000000000000000000"
    },
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44f": {
      "balance": "500000000000000000000000"
    }
  }
}


The total supply is the sum of all balances in this alloc section.

SFC Total Supply Tracking
The SFC contract maintains its own totalSupply variable, which is initialized during the NetworkInitializer.initializeAll() call:
// In SFC.initialize()
totalSupply = _totalSupply;  // This matches the genesis total supply

This SFC totalSupply is used for:

Reward calculations: Determining validator rewards based on total staked amount
Fee burning: Tracking when fees are burned from the total supply
Supply management: Monitoring changes via issueTokens() function

Key Points
Genesis alloc → Actual token balances in EVM state
SFC totalSupply → Contract's tracking variable for calculations
Initial sync: SFC totalSupply should match the sum of all genesis balances
Dynamic changes: SFC totalSupply can increase via issueTokens() or decrease via fee burning

The SFC doesn't "hold" the total supply - it just tracks it for staking/reward logic. The actual tokens exist as balances on user accounts from genesis.