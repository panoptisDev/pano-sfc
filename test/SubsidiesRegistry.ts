import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';

describe('SubsidiesRegistry', () => {
  const fixture = async () => {
    const [owner, sponsor] = await ethers.getSigners();

    // Deploy a stub SFC contract to copy code from and set at the SFC address
    const stubSfc = await ethers.deployContract('StubSFC', [owner]);
    await ethers.provider.send('hardhat_setCode', [
      '0xFC00FACE00000000000000000000000000000000',
      await stubSfc.getDeployedCode(),
    ]);

    const registry = await upgrades.deployProxy(await ethers.getContractFactory('SubsidiesRegistry'), [], {
      kind: 'uups',
    });

    // Impersonate the Pano node (address(0)) for testing purposes and fund it
    await ethers.provider.send('hardhat_impersonateAccount', ['0x0000000000000000000000000000000000000000']);
    const node = await ethers.getSigner('0x0000000000000000000000000000000000000000');
    await sponsor.sendTransaction({
      to: await node.getAddress(),
      value: ethers.parseEther('10'),
    });

    const cfg = await registry.getGasConfig();
    const config = {
      chooseFundGasLimit: cfg[0],
      deductFeesGasLimit: cfg[1],
      overheadCharge: cfg[2],
    };

    return {
      owner,
      sponsor,
      registry,
      node,
      config,
    };
  };

  beforeEach(async function () {
    Object.assign(this, await loadFixture(fixture));
  });

  it('Should succeed and initialize correctly', async function () {
    expect(await this.registry.owner()).to.equal(await this.owner);
  });

  it('Allows to sponsor and deduct fees', async function () {
    const fundId = '0x0000000000000000000000000000000000000000000000000000000000000015';
    await expect(this.registry.connect(this.sponsor).sponsor(fundId, { value: 100 }))
      .to.emit(this.registry, 'Sponsored')
      .withArgs(fundId, this.sponsor, 100);

    await this.registry.connect(this.node).deductFees(fundId, 90);

    // not enough funds already
    await expect(this.registry.connect(this.node).deductFees(fundId, 11)).to.be.revertedWithCustomError(
      this.registry,
      'NotSponsored',
    );
  });

  it('Allows proportional withdrawal after a partial spend', async function () {
    const fundId = '0x0000000000000000000000000000000000000000000000000000000000000024';
    const [sponsorA, sponsorB] = await ethers.getSigners();

    // Sponsor A deposits 100
    await this.registry.connect(sponsorA).sponsor(fundId, { value: 100 });
    // Sponsor B deposits 200
    await this.registry.connect(sponsorB).sponsor(fundId, { value: 200 });
    expect(await this.registry.getSponsorContribution(fundId, sponsorA)).to.equal(100);
    expect(await this.registry.getSponsorContribution(fundId, sponsorB)).to.equal(200);

    await this.registry.connect(this.node).deductFees(fundId, 30);

    // Now sponsorA should be able to withdraw max 90 (100 - 10% of 100)
    const withdrawableA = await this.registry.availableToWithdraw(fundId, sponsorA);
    expect(withdrawableA).to.equal(90);
    await this.registry.connect(sponsorA).withdraw(fundId, withdrawableA);
    expect(await this.registry.getSponsorContribution(fundId, sponsorA)).to.equal(0);

    // SponsorB should be able to withdraw max 180 (200 - 10% of 200)
    const withdrawableB = await this.registry.availableToWithdraw(fundId, sponsorB);
    expect(withdrawableB).to.equal(180);
    await this.registry.connect(sponsorB).withdraw(fundId, withdrawableB);
    expect(await this.registry.getSponsorContribution(fundId, sponsorB)).to.equal(0);
  });

  describe('chooseFund', async function () {
    it('Returns zero for unknown tx', async function () {
      const from = ethers.Wallet.createRandom();
      const to = ethers.Wallet.createRandom();
      const choosenFundId = await this.registry.connect(this.node).chooseFund(from, to, 5, 1, '0x', 5);
      const expectedFundId = '0x0000000000000000000000000000000000000000000000000000000000000000';
      expect(choosenFundId).to.equal(expectedFundId);
    });

    it('Calculates fundId for contract sponsorship', async function () {
      const from = ethers.Wallet.createRandom();
      const to = ethers.Wallet.createRandom();
      const expectedFundId = await this.registry.contractSponsorshipFundId(to);
      await this.registry.sponsor(expectedFundId, { value: 10 });
      const choosenFundId = await this.registry.chooseFund(from, to, 5, 1, '0x', 5);
      expect(choosenFundId).to.equal(expectedFundId);
    });
  });

  describe('deductFees', async function () {
    it('Decreases the balance', async function () {
      const fundId = '0x0000000000000000000000000000000000000000000000000000000000000123';
      await expect(this.registry.connect(this.sponsor).sponsor(fundId, { value: 100 }))
        .to.emit(this.registry, 'Sponsored')
        .withArgs(fundId, this.sponsor, 100);

      await this.registry.connect(this.node).deductFees(fundId, 90);

      expect(await this.registry.getAvailableFunds(fundId)).to.equal(10);

      await this.registry.connect(this.node).deductFees(fundId, 10);

      expect(await this.registry.getAvailableFunds(fundId)).to.equal(0);
    });
  });

  it('Enforce ownerOnly', async function () {
    const anyAddress = ethers.Wallet.createRandom();
    expect(this.registry.upgradeToAndCall(anyAddress, '0x')).to.be.revertedWithCustomError(
      this.registry,
      'OwnableUnauthorizedAccount',
    );
    expect(this.registry.setChooseFundGasLimit(123)).to.be.revertedWithCustomError(
      this.registry,
      'OwnableUnauthorizedAccount',
    );
    expect(this.registry.setDeductFeesGasLimit(123)).to.be.revertedWithCustomError(
      this.registry,
      'OwnableUnauthorizedAccount',
    );

    await this.registry.connect(this.owner).setChooseFundGasLimit(123);
    await this.registry.connect(this.owner).setDeductFeesGasLimit(123);
  });

  describe('getGasConfig', async function () {
    it('getGasConfig fits into GET_GAS_CONFIG_COST', async function () {
      await this.registry.getGasConfig({ gasLimit: 50_000 });
    });

    it('chooseFund fits into chooseFundGasLimit', async function () {
      const from = ethers.Wallet.createRandom();
      const to = ethers.Wallet.createRandom();
      await this.registry
        .connect(this.node)
        .chooseFund(
          from,
          to,
          5,
          1,
          '0x095ea7b300000000000000000000000011112222333344445555666677778888999900000000000000000000000000000000000000000000000000056bc75e2d63100000',
          5,
          { gasLimit: this.config.chooseFundGasLimit },
        );
    });

    it('deductFees fits into deductFeesGasLimit', async function () {
      const fundId = '0x0000000000000000000000000000000000000000000000000000000000000123';
      await this.registry.connect(this.sponsor).sponsor(fundId, { value: 100 });

      await this.registry.connect(this.node).deductFees(fundId, 90, { gasLimit: this.config.deductFeesGasLimit });
    });
  });
});
