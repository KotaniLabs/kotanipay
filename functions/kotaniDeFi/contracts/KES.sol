// contracts/KESToken.sol
// SPDX-License-Identifier: MIT
pragma solidity =0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract KES is ERC20, Ownable  {
    constructor() ERC20("Kenya Shillings", "KES") public {}

    function mint(address account, uint256 amount) external onlyOwner {
      _mint(account, amount);
    }
         
    function burn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }
}