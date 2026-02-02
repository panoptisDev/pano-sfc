// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CTOTreasuryVesting
 * @dev A vesting contract that holds 75 million native tokens for the CTO.
 * Releases 120,000 tokens every 30 days for 3 years, then unlocks remaining tokens.
 */
contract CTOTreasuryVesting is Ownable {
    address public immutable CTO;

    uint256 public constant TOTAL_TOKENS = 75_000_000 * 10**18; // 18 decimals assumed
    uint256 public constant MONTHLY_RELEASE = 120_000 * 10**18;
    uint256 public constant VESTING_DURATION = 36; // 3 years in months
    uint256 public constant SECONDS_PER_MONTH = 30 days;

    uint256 public startTime;
    uint256 public totalReleased;

    // Custom errors
    error VestingAlreadyStarted();
    error NoTokensAvailable();
    error VestingNotComplete();
    error OnlyCTOOrOwner();
    error OnlyCTO();
    error TransferFailed();

    event TokensReleased(address indexed to, uint256 amount);
    event VestingStarted(uint256 startTime);

    /// @param _cto beneficiary address
    /// @param _owner contract owner who can start vesting
    constructor(address _cto, address _owner) Ownable(_owner) {
        CTO = _cto;
    }

    /**
     * @dev Start the vesting period. Can only be called once.
     */
    function startVesting() external onlyOwner {
        if (startTime != 0) revert VestingAlreadyStarted();
        startTime = block.timestamp;
        emit VestingStarted(startTime);
    }

    /**
     * @dev Allow contract to receive native tokens (funding)
     */
    receive() external payable {}

    /**
     * @dev Calculate vested amount available for release
     */
    function vestedAmount() public view returns (uint256) {
        if (startTime == 0) return 0;

        uint256 elapsed = block.timestamp - startTime;
        uint256 monthsElapsed = elapsed / SECONDS_PER_MONTH;

        if (monthsElapsed >= VESTING_DURATION) {
            return TOTAL_TOKENS - totalReleased;
        }

        uint256 vested = monthsElapsed * MONTHLY_RELEASE;
        return vested - totalReleased;
    }

    /**
     * @dev Release vested native tokens to CTO
     */
    function release() external {
        if (msg.sender != CTO && msg.sender != owner()) revert OnlyCTOOrOwner();
        uint256 amount = vestedAmount();
        if (amount == 0) revert NoTokensAvailable();

        totalReleased += amount;
        if (totalReleased > TOTAL_TOKENS) revert NoTokensAvailable();

        (bool ok, ) = CTO.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit TokensReleased(CTO, amount);
    }

    /**
     * @dev Emergency function to recover native tokens after vesting period
     */
    function emergencyWithdraw() external {
        if (msg.sender != CTO) revert OnlyCTO();
        if (block.timestamp < startTime + (VESTING_DURATION * SECONDS_PER_MONTH)) revert VestingNotComplete();

        uint256 remaining = TOTAL_TOKENS - totalReleased;
        if (remaining > 0) {
            totalReleased = TOTAL_TOKENS;
            (bool ok, ) = CTO.call{value: remaining}("");
            if (!ok) revert TransferFailed();
            emit TokensReleased(CTO, remaining);
        }
    }

    /**
     * @dev Get contract token balance
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
