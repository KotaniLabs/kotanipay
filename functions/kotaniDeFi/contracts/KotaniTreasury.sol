pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./uniswapv2/interfaces/IUniswapV2ERC20.sol";
import "./uniswapv2/interfaces/IUniswapV2Pair.sol";
import "./uniswapv2/interfaces/IUniswapV2Factory.sol";

// KotaniTreasury is Minter's left hand and kinda a wizard. He can cook up Kvt from pretty much anything!
//
// This contract handles "serving up" rewards for xKvt holders by trading tokens collected from fees for Kvt.

contract KotaniTreasury {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IUniswapV2Factory public factory;
    address public bar;
    address public kvt;
    address public weth;

    constructor(IUniswapV2Factory _factory, address _bar, address _kvt, address _weth) public {
        factory = _factory;
        kvt = _kvt;
        bar = _bar;
        weth = _weth;
    }

    function convert(address token0, address token1) public {
        // At least we try to make front-running harder to do.
        require(msg.sender == tx.origin, "do not convert from contract");
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(token0, token1));
        pair.transfer(address(pair), pair.balanceOf(address(this)));
        pair.burn(address(this));
        // First we convert everything to WETH
        uint256 wethAmount = _toWETH(token0) + _toWETH(token1);
        // Then we convert the WETH to Kvt
        _toKVT(wethAmount);
    }

    // Converts token passed as an argument to WETH
    function _toWETH(address token) internal returns (uint256) {
        // If the passed token is Kvt, don't convert anything
        if (token == kvt) {
            uint amount = IERC20(token).balanceOf(address(this));
            _safeTransfer(token, bar, amount);
            return 0;
        }
        // If the passed token is WETH, don't convert anything
        if (token == weth) {
            uint amount = IERC20(token).balanceOf(address(this));
            _safeTransfer(token, factory.getPair(weth, kvt), amount);
            return amount;
        }
        // If the target pair doesn't exist, don't convert anything
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(token, weth));
        if (address(pair) == address(0)) {
            return 0;
        }
        // Choose the correct reserve to swap from
        (uint reserve0, uint reserve1,) = pair.getReserves();
        address token0 = pair.token0();
        (uint reserveIn, uint reserveOut) = token0 == token ? (reserve0, reserve1) : (reserve1, reserve0);
        // Calculate information required to swap
        uint amountIn = IERC20(token).balanceOf(address(this));
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        uint amountOut = numerator / denominator;
        (uint amount0Out, uint amount1Out) = token0 == token ? (uint(0), amountOut) : (amountOut, uint(0));
        // Swap the token for WETH
        _safeTransfer(token, address(pair), amountIn);
        pair.swap(amount0Out, amount1Out, factory.getPair(weth, kvt), new bytes(0));
        return amountOut;
    }

    // Converts WETH to Kvt
    function _toKVT(uint256 amountIn) internal {
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(weth, kvt));
        // Choose WETH as input token
        (uint reserve0, uint reserve1,) = pair.getReserves();
        address token0 = pair.token0();
        (uint reserveIn, uint reserveOut) = token0 == weth ? (reserve0, reserve1) : (reserve1, reserve0);
        // Calculate information required to swap
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        uint amountOut = numerator / denominator;
        (uint amount0Out, uint amount1Out) = token0 == weth ? (uint(0), amountOut) : (amountOut, uint(0));
        // Swap WETH for Kvt
        pair.swap(amount0Out, amount1Out, bar, new bytes(0));
    }

    // Wrapper for safeTransfer
    function _safeTransfer(address token, address to, uint256 amount) internal {
        IERC20(token).safeTransfer(to, amount);
    }
}
