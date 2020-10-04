// CElO init
const contractkit = require('@celo/contractkit');
const { isValidPrivate, privateToAddress, privateToPublic, pubToAddress, toChecksumAddress } = require ('ethereumjs-util');
const bip39 = require('bip39-light');
// const crypto = require('crypto');

const NODE_URL = 'https://celo-mainnet.datahub.figment.network/apikey/b2b43afb38d9a896335580452e687e53/'; 
const kit = contractkit.newKit(NODE_URL);
kit.setFeeCurrency(contractkit.CeloContract.StableToken);
const ethers = require('ethers');
const provider = new ethers.providers.JsonRpcProvider(NODE_URL);
const axios = require("axios");

const trimLeading0x = (input) => (input.startsWith('0x') ? input.slice(2) : input);
const ensureLeading0x = (input) => (input.startsWith('0x') ? input : `0x${input}`);
const hexToBuffer = (input) => Buffer.from(trimLeading0x(input), 'hex');

// const prettyjson = require('prettyjson');
// var options = { noColor: true };

function getContractKit(){
    return kit;
}

async function transfercGOLD(senderId, recipientId, amount){
    try{
      let senderInfo = await getSenderDetails(senderId);
      console.log('Sender Adress: ',  senderInfo.data().SenderAddress);
      //console.log('Sender seedkey: ', senderInfo.seedKey);
      let senderprivkey =  `${await generatePrivKey(senderInfo.data().seedKey)}`;
      // console.log('Sender Private Key: ',senderprivkey)
      let receiverInfo = await getReceiverDetails(recipientId);
      console.log('Receiver Adress: ', receiverInfo.data().publicAddress);      
      // let cGLDAmount = `${amount*10000000}`;
      console.log('CELO Amount: ', amount)
      sendcGold(`${senderInfo.data().publicAddress}`, `${receiverInfo.data().publicAddress}`, amount, senderprivkey)
    }
    catch(err){console.log(err)}
}

async function transfercUSD(sender, receiver, amount, senderprivkey){
  try{
    // console.log('Sender Private Key: ',senderprivkey);    
    // console.log('Sender Adress: ', sender);
    // console.log('Receiver Adress: ', receiver);
    let cUSDAmount = parseFloat(amount);  //Kes to CUSD Conversion 
    cusdamount = cUSDAmount*0.01
    // console.log('cUSD Amount: ', cusdamount);
    return await sendcUSD(`${sender}`, `${receiver}`, cusdamount, `${senderprivkey}`);
  }
  catch(err){console.log(err)}
} 

  //CELOKIT FUNCTIONS
  async function getPublicAddress(mnemonic){
    // console.log('Getting your account Public Address:....')
    let privateKey = await generatePrivKey(mnemonic);
    return new Promise(resolve => { 
       resolve (getAccAddress(getPublicKey(privateKey)));
    });
  }
  
  async function generatePrivKey(mnemonic){
      return bip39.mnemonicToSeedHex(mnemonic).substr(0, 64);
  }
  
  function getPublicKey(privateKey){
      let privToPubKey = hexToBuffer(privateKey);
      privToPubKey = privateToPublic(privToPubKey).toString('hex');
      privToPubKey = ensureLeading0x(privToPubKey);
      privToPubKey = toChecksumAddress(privToPubKey);
      return privToPubKey;
  }
  
  function getAccAddress(publicKey){
      let pubKeyToAddress = hexToBuffer(publicKey);
      pubKeyToAddress = pubToAddress(pubKeyToAddress).toString('hex');
      pubKeyToAddress = ensureLeading0x(pubKeyToAddress);
      pubKeyToAddress = toChecksumAddress(pubKeyToAddress)
      return pubKeyToAddress;   
  }

  //0xe0c194103add2db24233f84e2ee7dd549fd79c39a0b23aa12b7b136a251ed304
  async function getTxAmountFromHash(hash){
    let _tx = await kit.web3.eth.getTransaction(hash);
    let amount = await weiToDecimal(_tx.value);
    console.log(amount);
    return amount;
  }

  function checksumAddress(address){
    let checksumAddress = toChecksumAddress(address)
    return checksumAddress;   
  }
  
  async function sendcGold(sender, receiver, amount, privatekey){
      kit.addAccount(privatekey)
      // const _amount = amount*1e+18    //kit.web3.utils.toWei(amount.toString(), 'ether')

      const celotoken = await kit.contracts.getGoldToken()
      const balance = await celotoken.balanceOf(sender)

      let _balance = balance/1e+18;      //weiToDecimal(balance); 
      console.log('CELO Balance: ',_balance)


      //const oneGold = kit.web3.utils.toWei('1', 'ether')
      _balance = parseFloat(_balance);
      if(amount < _balance){
        console.log(`${_balance} CELO balance is sufficient`);
        let _amount = await decimaltoWei(amount);
        const tx = await celotoken.transfer(receiver, _amount).send({ from: sender, });

        const hash = await tx.getHash();
        const receipt = await tx.waitReceipt();

        console.log('CELO Transaction ID:..... ', JSON.stringify(hash));
  
        //let balance = await goldtoken.balanceOf(receiver)

        return receipt;
      }else{
        console.log('Insufficient CELO Balance');
        return 'failed';
      }


  
      // let goldtoken = await kit.contracts.getGoldToken()
      // let tx = await goldtoken.transfer(receiver, weiTransferAmount).send({from: sender})
      // let receipt = await tx.waitReceipt()
      // console.log('Transaction Details......................\n',JSON.stringify(receipt))

  }

  async function getTransactionBlock(txhash){
    let _res = await kit.web3.eth.getTransaction(txhash)
    return _res.blockNumber;
}
  
  async function weiToDecimal(value){
      return kit.web3.utils.fromWei(value.toString(), 'ether'); //value/1e+18 
  }
  //console.log('W2D: ',weiToDecimal('10000000000000'))

  async function decimaltoWei(value){
      return kit.web3.utils.toWei(value.toString(), 'ether'); //value*1e+18    
  }  
  //console.log('D2W: ',decimaltoWei(25))

  async function sendcUSD(sender, receiver, amount, privatekey){        
      const cusdtoken = await kit.contracts.getStableToken()
      let cusdbalance = await cusdtoken.balanceOf(sender) // In cUSD
      // console.log(`Raw Value balance: ${cusdbalance}`);

      let _balance = cusdbalance/1e+18;      //weiToDecimal(balance); 
      console.log('USD Balance: ',_balance)


      //const oneGold = kit.web3.utils.toWei('1', 'ether')
      _balance = parseFloat(_balance);
      if(amount < _balance){
        kit.addAccount(privatekey)
        console.log(`${_balance} USD balance is sufficient`);
        let _amount = await decimaltoWei(amount);
        const tx = await cusdtoken.transfer(receiver, _amount).send({ from: sender, });

        const hash = await tx.getHash();
        const receipt = await tx.waitReceipt();

        console.log('USD Transaction ID:..... ', JSON.stringify(hash));
  
        //let balance = await goldtoken.balanceOf(receiver)

        return receipt;
      }else{
        console.log('Insufficient CUSD Balance');
        return 'failed';
      }

      // // console.log(`Webkit: ${kit.web3.utils.fromWei(cusdbalance.toString(), 'ether')}`);
      // let _senderbalance = await weiToDecimal(cusdbalance)      ///1e+18  //formated to decimal
      // console.log('W2D Sender Balance: ', _senderbalance)

      // if (amount < _senderbalance) {
      //   console.info(`sender balance of ${_senderbalance} cUSD is sufficient to fulfill ${amount} cUSD`)
  
      //   kit.addAccount(privatekey)
      //   // const stableTokenContract = await kit._web3Contracts.getStableToken()
      //   //const oneGold = kit.web3.utils.toWei('1', 'ether')
      //   // const gasPriceMinimumContract = await kit.contracts.getGasPriceMinimum()
      //   // const gasPriceMinimum = await gasPriceMinimumContract.getGasPriceMinimum(cusdtoken)
      //   // const gasPrice = Math.ceil(gasPriceMinimum * 1.3) // Wiggle room if gas price minimum changes before tx is sent
      //   // contractkit.setFeeCurrency(CeloContract.StableToken) // Default to paying fees in cUSD
      //   let _amount = await decimaltoWei(amount)

      //   const tx = await cusdtoken.transfer(receiver, _amount).send({ from: sender, })
      
      //   const hash = await tx.getHash()
      //   const receipt = await tx.waitReceipt()

      //   // const txo = await stableTokenContract.methods.transfer(receiver, weiTransferAmount)
      //   // const tx = await kit.sendTransactionObject(txo, { from: sender })
      //   // console.info(`Sent tx object`)
      //   // const hash = await tx.getHash()
      //   // const receipt = await tx.waitReceipt()
      //   console.info(`Transferred ${amount} dollars to ${receiver}. Hash: ${hash}`)
      //   return receipt
      // }else{        
      //     console.error(`Not enough funds in sender balance to fulfill request: ${amount} > ${_senderbalance}`)
      //     return 0
      // }
  }

  async function usd2celoSwap(myAddress, amount){
    const cusd = await this.contracts.getStableToken()
    const exchange = await this.contracts.getExchange()
    
    const cusdbalance = await cusd.balanceOf(myAddress)
    
    const approveTx = await cusd.approve(exchange.address, cusdbalance).send()
    const approveReceipt = await approveTx.waitReceipt()
    
    const celoAmount = await exchange.quoteUsdSell(cusdbalance)

    const sellTx = await exchange.sellDollar(cusdbalance, celoAmount).send()
    const sellReceipt = await sellTx.waitReceipt()
  }

  async function celo2usdSwap(amount){
    const favorableCUSDAmount = 2.05
    const amountToExchange = decimaltoWei('10')
    const oneGold = decimaltoWei('1')
    const exchange = await kit.contracts.getExchange()

    const amountOfcUsd = await exchange.quoteGoldSell(oneGold)

    if (amountOfcUsd > favorableCUSDAmount) {
      const goldToken = await kit.contracts.getGoldToken()
      const approveTx = await goldToken.approve(exchange.address, amountToExchange).send()
      const approveReceipt = await approveTx.waitReceipt()

      const usdAmount = await exchange.quoteGoldSell(amountToExchange)
      const sellTx = await exchange.sellGold(amountToExchange, usdAmount).send()
      const sellReceipt = await sellTx.waitReceipt()
    }    
  }
  // getLatestBlock().then(_res=>console.log(_res.number))
  //working
  async function getLatestBlock() {
    return await kit.web3.eth.getBlock('latest');
  }

  async function validateWithdrawHash(hash, escrowAddress){
    // let hash = '0xe27cf9def976382639789d6465872947b6212649f5e64bf0acabcb4d3d8c1563';
    try{
      const tx = await provider.getTransactionReceipt(hash);
      console.log('FROM: ',tx.from)
      
      let response  = await axios.get(`https://explorer.celo.org/api?module=account&action=tokentx&address=${tx.from}#`)
      // console.log(response.data.result.hash);
      let txhashes = response.data.result;
      var kotanitxns =  await txhashes.filter(function(txns) {
          return txns.hash == hash;
      });
      var tokotani =  await kotanitxns.filter(function(txns) {
          return txns.to == escrowAddress;
      });
      // console.log(tokotani);

      let txvalues = {
        "status" : "ok",
        "from" : tokotani[0].from,
        "to": tokotani[0].to,
        "value" : kit.web3.utils.fromWei(tokotani[0].value),
        "txblock" : tokotani[0].blockNumber
      };

      // console.log(txvalues);

      return txvalues;
        
    }catch(e){
      console.log("Cant process Invalid Hash");
      let txvalues = {
        "status" : "invalid",
        "message" : "Cant process Invalid Hash"
      }
      return txvalues;
    }
  }
  

 module.exports = { 
    transfercGOLD,
    transfercUSD,
    getPublicAddress,
    generatePrivKey,
    getPublicKey,
    getAccAddress,
    getTxAmountFromHash,
    checksumAddress,
    sendcGold,
    getTransactionBlock,
    weiToDecimal,
    decimaltoWei,
    getContractKit,
    sendcUSD,
    getLatestBlock,
    validateWithdrawHash
 }