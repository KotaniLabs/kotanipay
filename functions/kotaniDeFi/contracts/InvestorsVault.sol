pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

// InvestorsVault is the coolest bar in town. You come in with some Kvt, and leave with more! The longer you stay, the more Kvt you get.
//
// This contract handles swapping to and from xKvt, KvtSwap's staking token.
contract InvestorsVault is ERC20("InvestorsVault", "xSUSHI"){
    using SafeMath for uint256;
    IERC20 public kvt;

    // Define the Kvt token contract
    constructor(IERC20 _kvt) public {
        kvt = _kvt;
    }

    // Enter the bar. Pay some SUSHIs. Earn some shares.
    // Locks Kvt and mints xKvt
    function enter(uint256 _amount) public {
        // Gets the amount of Kvt locked in the contract
        uint256 totalKvt = kvt.balanceOf(address(this));
        // Gets the amount of xKvt in existence
        uint256 totalShares = totalSupply();
        // If no xKvt exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalKvt == 0) {
            _mint(msg.sender, _amount);
        } 
        // Calculate and mint the amount of xKvt the Kvt is worth. The ratio will change overtime, as xKvt is burned/minted and Kvt deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalShares).div(totalKvt);
            _mint(msg.sender, what);
        }
        // Lock the Kvt in the contract
        kvt.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the bar. Claim back your SUSHIs.
    // Unclocks the staked + gained Kvt and burns xKvt
    function leave(uint256 _share) public {
        // Gets the amount of xKvt in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of Kvt the xKvt is worth
        uint256 what = _share.mul(kvt.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        kvt.transfer(msg.sender, what);
    }
}