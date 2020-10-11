const { ChainId, Fetcher, WETH, Route, Trade, TokenAmount, TradeType, Percent } = require('@uniswap/sdk');
const ethers = require('ethers');

// const chainId = ChainId.MAINNET;
const chainId = 5777;
const tokenAddress = '0xDc43272A6fA7EAB268f0D8748A515B540C0C4C0f';
const wethAddress = '0x08949816bc36E76c6cf3D6f28bda098337A0Ac49';

const url = "http://localhost:7545";

const provider = new ethers.providers.JsonRpcProvider(url);

// Getting the accounts
const signer0 = provider.getSigner(0);
const signer1 = provider.getSigner(1);

const init = async () => {
  const kes = await Fetcher.fetchTokenData(chainId, tokenAddress);
  //const weth = WETH[chainId];
  const weth = await Fetcher.fetchTokenData(chainId, wethAddress);
  const pair = await Fetcher.fetchPairData(kes, weth);
  const route = new Route([pair], weth);
  const trade = new Trade(route, new TokenAmount(weth, '100000000000000000'), TradeType.EXACT_INPUT);
  console.log(route.midPrice.toSignificant(6));
  console.log(route.midPrice.invert().toSignificant(6));
  console.log(trade.executionPrice.toSignificant(6));
  console.log(trade.nextMidPrice.toSignificant(6));

  const slippageTolerance = new Percent('50', '10000');
  const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
  const path = [weth.address, kes.address];
  const to = '';
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  const value = trade.inputAmount.raw;

//   const provider = ethers.getDefaultProvider('mainnet', {
//     infura: 'https://mainnet.infura.io/v3/ba14d1b3cfe5405088ee3c65ebd1d4db' 
//   });



//   const signer = new ethers.Wallet(PRIVATE_KEY);
//   const account = signer.connect(provider);
  const account = signer0.connect(provider);
  const uniswap = new ethers.Contract(
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    ['function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'],
    account
  );
  const tx = await uniswap.sendExactETHForTokens(
    amountOutMin,
    path,
    to,
    deadline,
    { value, gasPrice: 20e9 }
  );
  console.log(`Transaction hash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction was mined in block ${receipt.blockNumber}`);
}

init();