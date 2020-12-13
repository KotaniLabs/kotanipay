// "SPDX-License-Identifier: MIT"
pragma solidity ^0.7.4; 

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './Hash.sol';

// interface IERC20 {
//     function transfer(address recipient, uint256 amount) external returns (bool);
//     function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
// }

/**
abstract contract Proxy {
    function _delegate(address implementation) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    function _implementation() internal virtual view returns (address);

    function _fallback() internal {
        _beforeFallback();
        _delegate(_implementation());
    }

    fallback () external payable {
        _fallback();
    }

    receive () external payable {
        _fallback();
    }

    function _beforeFallback() internal virtual {
    }
}
*/


contract HTLC {
  uint public startTime;
  uint public lockTime = 1800 seconds;
  string public secret; //referenceCode 
  bytes32 public hash; = 0xfd69353b27210d2567bc0ade61674bbc3fc01a558a61c2a0cb2b13d96f9387cd;
  address public recipient;
  address public owner; 
  uint public amount; 
  IERC20 public token;

  constructor(address _recipient, address _token, uint _amount) { 
    recipient = _recipient;
    owner = msg.sender; 
    amount = _amount;
    token = IERC20(_token);
  } 

  function fund(string memory _secret) external {
    startTime = block.timestamp;
    secret = calculateHash(_secret)
    token.transferFrom(msg.sender, address(this), amount);
  }

  function withdraw(string memory _secret) external { 
    require(keccak256(abi.encodePacked(_secret)) == hash, 'wrong secret');
    secret = _secret; 
    token.transfer(recipient, amount); 
  } 

  function refund() external { 
    require(block.timestamp > startTime + lockTime, 'too early');
    token.transfer(owner, amount); 
  } 
}