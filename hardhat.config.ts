import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.27',
    settings: {
      evmVersion: 'cancun',
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      allowBlocksWithSameTimestamp: true,
    },
    pano: {
      url: 'https://rpc.panolabs.com/',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY!!] : [],
    },
    testnet: {
      url: 'https://rpc.testnet.panolabs.com/',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY!!] : [],
    },
    blaze: {
      url: 'https://rpc.blaze.panolabs.com/',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY!!] : [],
    },
    local: {
      url: 'http://localhost:18545/',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY!!] : [],
    },
  },
  gasReporter: {
    currency: 'USD',
    enabled: !!process.env.REPORT_GAS,
    gasPrice: 50,
  },
  contractSizer: {
    runOnCompile: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY!!,
    customChains: [
      {
        network: 'pano',
        chainId: 146,
        urls: {
          apiURL: 'https://api.panoscan.org/api',
          browserURL: 'https://panoscan.org/',
        },
      },
      {
        network: 'testnet',
        chainId: 14601,
        urls: {
          apiURL: 'https://api-testnet.panoscan.org/api',
          browserURL: 'https://testnet.panoscan.org/',
        },
      },
    ],
  },
  ignition: {
    strategyConfig: {
      create2: {
        // To learn more about salts, see the CreateX documentation
        salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
    },
    requiredConfirmations: 1, // sufficient on pano
  },
};

export default config;
