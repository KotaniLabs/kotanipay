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
  const celotoken = await kit.contracts.getGoldToken();
  const balance = await celotoken.balanceOf(sender);
  let _balance = kit.web3.utils.fromWei(balance);      //weiToDecimal(balance); 
  console.log('CELO Balance: ',_balance);

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

async function sendcUSD(sender, receiver, cusdAmount, privatekey){        
  const cusdtoken = await kit.contracts.getStableToken()
  let cusdbalance = await cusdtoken.balanceOf(sender) // In cUSD
  let _cusdbalance = kit.web3.utils.fromWei(`${cusdbalance}`, 'ether');      //weiToDecimal(balance); 
  console.log('CUSD Balance: ',_cusdbalance);

  //let _kesAmount = parseFloat(cusdAmount);
  //const oneGold = kit.web3.utils.toWei('1', 'ether')
  _cusdbalance = parseFloat(_cusdbalance, 4);
  if(cusdAmount < _cusdbalance){
    kit.addAccount(privatekey)
    // console.log(`${_cusdbalance} USD balance is sufficient to fulfil ${cusdAmount}`);
    let _cusdAmount = await decimaltoWei(cusdAmount);
    const tx = await cusdtoken.transfer(receiver, _cusdAmount).send({ from: sender, });

    const hash = await tx.getHash();
    const receipt = await tx.waitReceipt();
    console.log('USD Transaction ID:..... ', JSON.stringify(hash));
    return receipt;
  }else{
    console.log('Insufficient CUSD Balance');
    return 'failed';
  }    
}

async function buyCelo(address, cusdAmount, privatekey){
  kit.setFeeCurrency(contractkit.CeloContract.StableToken);
  kit.addAccount(privatekey)

  const cusdtoken = await kit.contracts.getStableToken()
  const exchange = await kit.contracts.getExchange()

  cusdbalance = `${await cusdtoken.balanceOf(address)}`
  console.log(`CUSD Balance: ${kit.web3.utils.fromWei(cusdbalance)}`)

  const tx = await cusdtoken.approve(exchange.address, cusdAmount).send({ from: address, })
  // console.log(tx)
  const receipt = await tx.waitReceipt()
  // console.log(receipt)

  const celoAmount = `${await exchange.quoteUsdSell(cusdAmount)}`
  console.log(`You will receive ${kit.web3.utils.fromWei(celoAmount, 'ether')} CELO`)
  const buyCeloTx = await exchange.sellDollar(cusdAmount, celoAmount).send({ from: address, })
  const buyCeloReceipt = await buyCeloTx.waitReceipt()
  console.log(buyCeloReceipt)
}

async function sellCelo(address, celoAmount, privatekey){
  kit.setFeeCurrency(contractkit.CeloContract.StableToken);
  kit.addAccount(privatekey)
  // const _amount = amount*1e+18    //kit.web3.utils.toWei(amount.toString(), 'ether')

  const celotoken = await kit.contracts.getGoldToken()
  const cusdtoken = await kit.contracts.getStableToken()
  const exchange = await kit.contracts.getExchange()
  
  const celobalance = `${await celotoken.balanceOf(address)}`
  console.log(`CELO Balance: ${kit.web3.utils.fromWei(celobalance, 'ether')}`)

  const tx = await celotoken.approve(exchange.address, celoAmount).send({ from: address, })
  // console.log(tx)
  const receipt = await tx.waitReceipt()
  // console.log(receipt)

  const cusdAmount = `${await exchange.quoteGoldSell(celoAmount)}`
  console.log(`You will receive ${kit.web3.utils.fromWei(cusdAmount)} CUSD`)
  const sellCeloTx = await exchange.sellGold(celoAmount, cusdAmount).send({ from: address, })
  const sellCeloReceipt = await sellCeloTx.waitReceipt()
  console.log(sellCeloReceipt)
  //}
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
    buyCelo,
    sellCelo,
    getLatestBlock,
    validateWithdrawHash
 }