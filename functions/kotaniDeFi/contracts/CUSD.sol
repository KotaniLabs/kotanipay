// contracts/CUSDToken.sol
// SPDX-License-Identifier: MIT
// pragma solidity ^0.6.0;

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// contract CUSDToken is ERC20 {
//     constructor(uint256 initialSupply) public ERC20("Celo Dollar", "CUSD") {
//         _mint(msg.sender, initialSupply);
//     }
// }

pragma solidity =0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CUSD is ERC20, Ownable  {
    constructor() ERC20("Celo Dollar", "CUSD") public {}

    function mint(address account, uint256 amount) external onlyOwner {
      _mint(account, amount);
    }
         
    function burn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }
}