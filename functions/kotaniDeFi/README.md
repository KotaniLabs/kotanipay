# KotaniSwap

KOTANI DEFI NETWORK: A DECENTRALIZED MOBILE MONEY SERVICE

The Kotani DeFi network is a decentralized mobile money service owned by Kotani Pay, wallet users and agents. It provides several advantages including:

  * Low cost transactions enabled by the blockchain
  * 24/7 availability for users and agents
  * Incentivization and ownership to contributors (agents and savers)
  * Interoperability to various local payment gateways e.g. MPESA and through the blockchain to the world. 

Main participants
 
Agents (Liquidity providers)

An agent’s main responsibility is to provide fiat liquidity for users in their locale. They fill in fiat liquidity requests received from Kotani Pay users looking to offramp to local currency from the blockchain. In exchange the agent receives stablecoin in the stablecoin blockchain account. For services offered the agent earns a percentage on transaction fees charged on users. In addition, the agent also earns a governance token in proportion to the amounts contributed in the pool, giving them a stake in the future direction of the network.

How to become an agent

 Anyone can become an agent into one of two ways: 

A. Contributing to existing pools

Here a user is required to deposit a pair of assets in given ratios. For example, 10000 Kenya Shillings and 10000 CUSD in the KSH/CUSD pool. Transaction fees charged on users utilizing this pool are distributed to liquidity providers based on their share of the pool. There will be fiat/stablecoin, crypto/stablecoin as well as stablecoin/stablecoin pools available on the Kotani Pay DeFi Network. 

B. Creating a new liquidity pool
A user can create a pool of their liking from the assets available in the Kotani Pay     Network e.g. Morocco/ETH pool. 

A blockchain-native liquidity protocol should take advantage of the trusted code execution environment, the autonomous and perpetually running virtual machine, and an open, permissionless, and inclusive access model that produces an exponentially growing ecosystem of virtual assets.

It is important to reiterate that a Pool is just a smart contract, operated by users calling functions on it. Providing liquidity is called deposit on a Pool contract instance.

User (Liquidity Takers) 

Users can swap their tokens for other tokens in the liquidity pool. Swapping tokens is calling swap on a Pool contract. The user is charged a transaction fee during the swap. For USSD users using their feature phone menu, the experience is seamless. A user can buy BTC simply by choosing the buy BTC option but in the background a swap is performed to exchange the asset provided by the user e.g. CUSD or Ksh in exchange for BTC. 

FEATURES OF THE KOTANI PAY DEFI NETWORK 

Automatic Market Maker Algorithm

While order books are foundational to finance and work great for certain use cases, they usually require intermediary infrastructure to host the orderbook and match orders. This creates points of control and adds additional layers of complexity. Kotani Pay’s AMM algorithm relies on mathematical formulas to set the price of a token. There are no buy or sell orders, and traders don’t need to find someone else to sell their coins to. Instead, a smart contract acts as the maker in an exchange transaction. 

In this new iteration of Kotani Pay, the company’s reserves are replaced with liquidity pools based on smart contracts.A liquidity pool contains two assets in a trading pair. The relative percentage of each token in that pool is what determines the theoretical price of a particular asset. 

Synthetic Representatives

The Kotani Pay DeFi Platform enables the creation of on-chain synthetic assets that track the value of assets in the real world. Current assets available are the synthetic fiat currencies. Synthetic assets allow you to receive the benefit of holding an asset without actually holding it while at the same time being able to transact on the blockchain with these assets. Users and agents of Kotani Pay who deposit their local currencies into pools, automatically create synthetic versions of the same which are tradable on the blockchain across countries and jurisdictions. 


Agency Network

This network will comprise merchants that can accept payments in Kotani PAy native digital assets e.g. DAI, CUSD quickly, easily, and securely for all sorts of goods and services starting with money money services first. Agents in this program will be on boarded by providing liquidity to a pool or starting their own pools, enabling them to accept, sell and/or buy digital assets directly from their customers.The network will also include exchange agents, who are entrepreneurs that are willing to make income buying and selling digital assets offering an easy way for ordinary african residents to start using the blockchain. 

GOVERNANCE 

Agents on Kotani Pays DeFi network in addition to commission on transaction amounts, also earn governance tokens. The Governance tokens enable agents to approve any new markets in high demand e.g. USD/CGLD approval. In future, the governance token will enable agents perform more roles within the network such as protocol changes needed for growth of the network.

https://kotanipay.com.

## Deployed Contracts / Hash

- KotaniToken - This is the KotaniPay Governance token Smartcontract.
- Minter - The Minter smartcontract is the Admin of the KotaniToken smartcontract, It generates new KVT tokens.
- UniswapV2Factory - Creates Market pairs
- UniswapV2Router02 - A utility contract which provides a variety of methods to safely swap to and from different assets
- UniswapV2Pair  - The Pair SC creates a
- InvestorsVault - Is a savings contract that allows users to earn fees and Governance tokens by locking their funds
- KotaniTreasury - It pays out the earned fees to the Agents

## License

MIT