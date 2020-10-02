'use strict';

// Firebase init
 const functions = require('firebase-functions');
 const admin = require('firebase-admin');

 //const firebase-admin = require('firebase-admin');

 const serviceAccount = require("./config/serviceAccountKey.json");

 admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://kotanimac.firebaseio.com"
 });

 const firestore = admin.firestore();
// require('dotenv').config();
const crypto = require('crypto');
const bip39 = require('bip39-light');

// Express and CORS middleware init
const express = require('express');
 const cors = require('cors');
 const bodyParser = require('body-parser');
 const bearerToken = require('express-bearer-token');
 const jwt = require('jsonwebtoken');
 const fs = require('fs')
 // const { createFirebaseAuth } = require ('./middlewares/express_firebase_auth');
 const { ussdRouter } = require ('ussd-router');

 const app = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));
 const jengaApi = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));
 var restapi = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }), bearerToken());

// Initialize the firebase auth
// const firebaseAuth = createFirebaseAuth({ ignoredUrls: ['/ignore'], serviceAccount, admin });

const getAuthToken = (req, res, next) => {
  if ( req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer' ) {
    req.authToken = req.headers.authorization.split(' ')[1];
    console.log("Auth Token",req.headers.authorization);
  } else {
    // req.authToken = null;
    return res.status(201).json({
      message: 'Not Allowed'
    });
  }
  next();
};

const requireAuth = (req, res, next) => {
  if(!req.token){
    res.send('401 - Not authenticated!');
    return;
  }
  next();
}

// app.use(authenticate);
 // jengaApi.use(authenticate);
 // restapi.use(requireAuth);

const PNF = require('google-libphonenumber').PhoneNumberFormat;
 const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const axios = require("axios");
const jenga = require('./jengakit');

// const prettyjson = require('prettyjson');
// var options = { noColor: true };

var randomstring = require("randomstring");
// var tinyURL = require('tinyurl');
var { getTxidUrl,
      getAddressUrl,
      getPinFromUser,
      getEncryptKey,
      createcypher,
      decryptcypher,      
      sendMessage,
      arraytojson,
      stringToObj,
      parseMsisdn 
} = require('./utilities');

//ENV VARIABLES
const iv = functions.config().env.crypto_iv.key;
 const enc_decr_fn = functions.config().env.algo.enc_decr;
 const  phone_hash_fn = functions.config().env.algo.msisdn_hash;
 const escrowMSISDN = functions.config().env.escrow.msisdn;

//@task imports from celokit

const { transfercGOLD,
        transfercUSD,
        getPublicAddress,
        generatePrivKey,
        getPublicKey,
        getAccAddress,
        getTxAmountFromHash,
        checksumAddress,
        getTransactionBlock,
        sendcGold,
        weiToDecimal,
        decimaltoWei,
        sendcUSD,
        getContractKit,
        getLatestBlock
} = require('./celokit');

const { getIcxUsdtPrice } = require('./iconnect');
const { resolve } = require('path');

const kit = getContractKit();

  // GLOBAL VARIABLES
   // let publicAddress = '';
   let senderMSISDN = '';
   let receiverMSISDN = '';
   var recipientId = '';
   var senderId = '';
   let amount = '';
   let withdrawId = '';
   let depositId = '';
   let escrowId = '';
   let newUserPin = '';
   let confirmUserPin = '';
   let documentType = '';
   let documentNumber = '';
   let idnumber = '';
   let firstname = '';
   let lastname = '';
   let dateofbirth = '';
   let email = '';
   
   // let text = '';
  // var data = [];


// USSD API 
app.post("/", async (req, res) => {
  // const { sessionId, serviceCode, phoneNumber, text } = req.body;
  const { body: { phoneNumber: phoneNumber } } = req;
  const { body: { text: rawText } } = req;  
  const text = ussdRouter(rawText);
  const footer = '\n0: Home 00: Back';
  let msg = ''; 
  res.set('Content-Type: text/plain');
  senderMSISDN = phoneNumber.substring(1);
  senderId = await getSenderId(senderMSISDN)
  // console.log('senderId: ', senderId);   
  var data = text.split('*'); 
  let userExists = await checkIfSenderExists(senderId);
  // console.log("Sender Exists? ",userExists);
  if(userExists === false){         
    let userCreated = await createNewUser(senderId, senderMSISDN);     
    console.log('Created user with userID: ', userCreated); 
    // msg += `END Creating your account on KotaniPay`;    
  }

  let isverified = await checkIfUserisVerified(senderId);    
  if(isverified === false){       //  && data[0] !== '7' && data[1] !== '4'
    // console.log("User: ", senderId, "is NOT VERIFIED!");
    // msg += `END Verify your account by dialing *483*354*7*4#`;
    
    if ( data[0] == null || data[0] == ''){ //data[0] !== null && data[0] !== '' && data[1] == null

      msg = `CON Welcome to KotaniPay. \nKindly Enter your details to verify your account.\n\nEnter new PIN`;
      res.send(msg);
     }else if ( data[0] !== '' && data[1] == null ){ //data[0] !== null && data[0] !== '' && data[1] == null
      newUserPin = data[0];
      // console.log('New PIN ', newUserPin);

      msg = `CON Reenter PIN to confirm`;
      res.send(msg);
     }else if ( data[0] !== '' && data[1] !== ''  && data[2] == null ) {
      confirmUserPin = data[1];
      // console.log('confirmation PIN ', confirmUserPin);

      msg = `CON Enter ID Document Type:\n1. National ID \n2. Passport \n3. AlienID`;
      res.send(msg);
     }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] == null){ 
      if(data[2]==='1'){documentType = 'ID'}
      else if (data[2]==='2'){documentType = 'Passport'}
      else if (data[2]==='3'){documentType = 'AlienID'}
      else{documentType = 'ID'}

      msg = `CON Enter ${documentType} Number`;
      res.send(msg);
     }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] == null){ //data[0] !== null && data[0] !== '' && data[1] == null
      documentNumber = data[3];
      // console.log(`${documentType} Number: `, documentNumber);

      msg = `CON Enter First Name`;
      res.send(msg);
     }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] !== ''  && data[5] == null){ //data[0] !== null && data[0] !== '' && data[1] == null
      firstname = data[4];
      // console.log('Firstname: ', firstname);

      msg = `CON Enter Last Name`;
      res.send(msg);
     }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] !== ''  && data[5] !== '' && data[6] == null){ //data[0] !== null && data[0] !== '' && data[1] == null
      lastname = data[5];
      // console.log('Lastname: ', lastname);

      msg = `CON Enter Date of Birth.\nFormat: YYYY-MM-DD`;
      res.send(msg);
     }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] !== '' && data[5] !== '' && data[6] !== '' && data[7] == null){ //data[0] !== null && data[0] !== '' && data[1] == null
      dateofbirth = data[6];
      // console.log('DateOfBirth: ', dateofbirth);

      msg = `CON Enter Email Address`;
      res.send(msg);
     }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] !== '' && data[5] !== '' && data[6] !== ''  && data[7] !== ''){ //data[0] !== null && data[0] !== '' && data[1] == null
      email = data[7];
      let userMSISDN = phoneNumber.substring(1);
      let userId = await getSenderId(userMSISDN);  
      let enc_loginpin = await createcypher(newUserPin, userMSISDN, iv);

      // console.log(`User Details=>${userId} : ${newUserPin} : ${confirmUserPin} : ${documentType} : ${documentNumber} : ${firstname} : ${lastname} : ${dateofbirth} : ${email} : ${enc_loginpin}`);
      
      if(newUserPin === confirmUserPin && newUserPin.length >= 4 ){
        msg = `END Thank You. \nYour Account Details will be verified shortly`;
        res.send(msg);
        // msg += `END ${newUserPin}: ${confirmUserPin} Account Details will be verified shortly`;

        //KYC USER
        let merchantcode = '9182506466';
        let countryCode = 'KE';
        let kycData = await jenga.getUserKyc(merchantcode, documentType, documentNumber, firstname, lastname, dateofbirth, countryCode);
        console.log('KYC DATA:\n ',JSON.stringify(kycData));
        // console.log('ID From Jenga: ',kycData.identity.additionalIdentityDetails[0].documentNumber )
        if (kycData !== null && kycData.identity.additionalIdentityDetails[0].documentNumber === documentNumber){
          //Update User account and enable
          let updateinfo = await verifyNewUser(userId, email, enc_loginpin, firstname, lastname, dateofbirth, idnumber, userMSISDN);

          await firestore.collection('hashfiles').doc(userId).set({'enc_pin' : `${enc_loginpin}`}); 

          console.log('User data updated successfully: \n',JSON.stringify(updateinfo));
          //save KYC data to KYC DB
          let newkycdata = await addUserKycToDB(userId, kycData);
          // console.log('KYC Data: ', JSON.stringify(newkycdata));
        }
        // else{ console.log('KYC Failed: No data received') }
        // return;
      }
      else if (newUserPin.length < 4 ){
        msg = `END PIN Must be atleast 4 characters,\n RETRY again`;
        res.send(msg);
      }
      else if (newUserPin !== confirmUserPin){
        msg = `END Your access PIN does not match,\n RETRY again`; //${newUserPin}: ${confirmUserPin}
        res.send(msg);
      }
    }
  }    

  else if (text === '' ) {
    msg = 'CON Welcome to Kotanipay:';
    msg += '\n1: Send Money';
    msg += '\n2: Deposit Funds';
    msg += '\n3: Withdraw Cash';
    msg += '\n5: Kotani Dex';
    msg += '\n6: PayBill or Buy Goods';
    msg += '\n7: My Account';
    res.send(msg);
  }     
    
 //  1. TRANSFER FUNDS #SEND MONEY
  else if ( data[0] == '1' && data[1] == null) { 
    msg = `CON Enter Recipient`;
    msg += footer;
    res.send(msg);
  } else if ( data[0] == '1' && data[1]!== '' && data[2] == null) {  //  TRANSFER && PHONENUMBER
    msg = `CON Enter Amount to Send:`;
    msg += footer;
    res.send(msg);
      
  } else if ( data[0] == '1' && data[1] !== '' && data[2] !== '' ) {//  TRANSFER && PHONENUMBER && AMOUNT
    senderMSISDN = phoneNumber.substring(1);
    // console.log('sender: ', senderMSISDN);
    try {
      const recnumber = phoneUtil.parseAndKeepRawInput(`${data[1]}`, 'KE');
      receiverMSISDN = phoneUtil.format(recnumber, PNF.E164);
    } catch (error) { console.log(error); }

    receiverMSISDN = receiverMSISDN.substring(1);       
    amount = data[2];
    senderId = await getSenderId(senderMSISDN)
    console.log('senderId: ', senderId);
    recipientId = await getRecipientId(receiverMSISDN)
    console.log('recipientId: ', recipientId);

    let recipientstatusresult = await checkIfRecipientExists(recipientId);
    console.log("Recipient Exists? ",recipientstatusresult);
    if(recipientstatusresult == false){ 
      let recipientUserId = await createNewUser(recipientId, receiverMSISDN); 
      console.log('New Recipient', recipientUserId);
    }  
    
    // Retrieve User Blockchain Data
    let senderInfo = await getSenderDetails(senderId);
    // console.log('Sender Info: ', JSON.stringify(senderInfo.data()))
    let senderprivkey = await getSenderPrivateKey(senderInfo.data().seedKey, senderMSISDN, iv)

    let receiverInfo = await getReceiverDetails(recipientId);
    while (receiverInfo.data() === undefined || receiverInfo.data() === null || receiverInfo.data() === ''){
      await sleep(1000);
      receiverInfo = await getReceiverDetails(recipientId);
      // console.log('Receiver:', receiverInfo.data());
    }

    let senderName = '';
    await admin.auth().getUser(senderId).then(user => {
      senderName = user.displayName;
      return;
    }).catch(e => {console.log(e)})  
    console.log('Sender fullName: ', senderName);

    let receiverName = '';
    await admin.auth().getUser(recipientId).then(user => {
      receiverName = user.displayName;
      return;
    }).catch(e => {console.log(e)})  
    console.log('Receiver fullName: ', receiverName);
    let _receiver = '';
    

    let receipt = await transfercUSD(senderInfo.data().publicAddress, receiverInfo.data().publicAddress, amount, senderprivkey);
    if(receipt === 'failed'){
      msg = `END Your transaction has failed due to insufficient balance`;  
      res.send(msg); 
    }

    if(receiverName==undefined || receiverName==''){_receiver=receiverMSISDN; } else{ _receiver=receiverName;}

    let url = await getTxidUrl(receipt.transactionHash);
    let message2sender = `KES ${amount}  sent to ${_receiver}.\nTransaction URL:  ${url}`;
    let message2receiver = `You have received KES ${amount} from ${senderName}.\nTransaction Link:  ${url}`;
    console.log('tx URL', url);
    msg = `END KES ${amount} sent to ${_receiver}. \nTransaction Details: ${url}`;  
    res.send(msg);

    sendMessage("+"+senderMSISDN, message2sender);
    sendMessage("+"+receiverMSISDN, message2receiver);        
  } 
    
 //  2. DEPOSIT FUNDS
  else if ( data[0] == '2' && data[1] == null) { 
    msg = `CON Deposit funds through Mpesa \nPaybill: 763766\nAccount Number: 915170 \nor\nEazzyPay\nTill Number: 915170\nYour transaction will be confirmed in approx 5mins.`;
    msg += footer;
    res.send(msg);
   }
   // else if ( data[0] == '2' && data[1] == null) { 
   //     msg += `CON Enter Amount to Deposit`;
   //     msg += footer;
   // } else if ( data[0] == '2' && data[1]!== '') {  //  DEPOSIT && AMOUNT
   //   let depositMSISDN = phoneNumber.substring(1);  // phoneNumber to send sms notifications
   //   amount = `${data[1]}`;
   //   // mpesaSTKpush(depositMSISDN, data[1]);   //calling mpesakit library 
   //   jenga.receiveMpesaStkDeposit(depositMSISDN, data[1]);
   //   console.log('callling STK push');
   //   msg += `END Depositing KES:  `+amount+` to `+depositMSISDN+` Celo Account`;
  // }

 //  3. WITHDRAW FUNDS
  else if ( data[0] == '3'  && data[1] == null) {
    msg = `CON Enter Amount to Withdraw\nMinimum KES. 10`;
    msg += footer;
    res.send(msg);
   }else if ( data[0] == '3' && data[1]!== ''  && data[2] == null) { //&& data[1].value <= 10
    msg += `CON Enter your PIN:`;
    msg += footer;
    res.send(msg);
   }else if ( data[0] == '3' && data[1]!== '' && data[2]!== '') {  //  WITHDRAW && AMOUNT && FULLNAME
    let withdrawMSISDN = phoneNumber.substring(1);  // phoneNumber to send sms notifications
    // console.log('Phonenumber: ', withdrawMSISDN); 
    let amount = data[1];
    console.log('Amount to Withdraw: KES.', amount); 
    let access_pin =  `${data[2]}`;
    let displayName = '';
    // msg += `END Thank you..Processing your transaction:`;

    withdrawId = await getSenderId(withdrawMSISDN);
    console.log('withdrawId: ', withdrawId);
    // if(withdrawId==='745ae6b3d37c6bfc3c310214ce5ea804d1ccc6cc'){admin.auth().setCustomUserClaims('1c9724f4f6420de3a93dbc87f3472f94fd863b1d', {verifieduser: true})}
    
    let saved_access_pin = await getLoginPin(withdrawId); 
    console.log('Access PIN: ', saved_access_pin)
    let _access_pin = await createcypher(access_pin, withdrawMSISDN, iv);
    console.log('User supplied Access PIN: ', _access_pin)
    // msg += `END Processing your transaction:`; 

    if(_access_pin === saved_access_pin){
      let senderInfo = await getSenderDetails(withdrawId);

      // @todo: verify that user has enough balance
      let userbalance = await getWithdrawerBalance(senderInfo.data().publicAddress); 
      console.log(`${withdrawMSISDN} balance: ${userbalance} CUSD`);
      if(number_format(amount, 2) < userbalance){
        msg = `END Thank you. \nWe're processing your transaction:`;
        res.send(msg);
        console.log(`USSD: Thank you. Were processing your transaction:`);

        await admin.auth().getUser(withdrawId).then(user => { displayName = user.displayName; return; }).catch(e => {console.log(e)}) 
        console.log('Withdrawer fullName: ', displayName);        
        
        // const escrowMSISDN = functions.config().env.escrow.msisdn;
        escrowId = await getRecipientId(escrowMSISDN);
        let escrowInfo = await getReceiverDetails(escrowId);

        let senderprivkey = await getSenderPrivateKey(senderInfo.data().seedKey, withdrawMSISDN, iv)
        let txreceipt = await transfercUSD(senderInfo.data().publicAddress, escrowInfo.data().publicAddress, amount, senderprivkey);
        console.log('withdraw tx receipt: ', JSON.stringify(txreceipt));
        // mpesa2customer(withdrawMSISDN, data[1])    //calling mpesakit library
        // if(txreceipt.transactionHash !== null || txreceipt.transactionHash !== undefined && txreceipt !== 'failed'){
        // msg = `END Thank you. \nWe're processing your transaction:`;
        // res.send(msg);
        // console.log('USSD: ', msg);
        // msg = `END You have withdrawn KES: ${amount} from your Celo account.`;
        // console.log('392: Tx Hash: ', JSON.stringify(txreceipt.transactionHash));

        let currencyCode = 'KES';
        let countryCode = 'KE';
        let recipientName = `${displayName}`;
        let mobileNumber = '';
        try {
          const number = phoneUtil.parseAndKeepRawInput(`${withdrawMSISDN}`, 'KE');
          mobileNumber = '0'+number.getNationalNumber();
        } catch (error) { console.log(error); }
        console.log('Withdrawer MobileNumber', mobileNumber);

        let withdrawToMpesa = await jenga.sendFromJengaToMobileMoney(amount, currencyCode, countryCode, recipientName, mobileNumber);
        console.log('Sending From Jenga to Mpesa Status => ', JSON.stringify(withdrawToMpesa.status));

        // jenga.sendFromJengaToMobileMoney(data[1], 'KES', 'KE',`${fullname}`, withdrawMSISDN) 
        let message2receiver = `You have Withdrawn KES ${amount} from your Celo Account.`;
        sendMessage("+"+withdrawMSISDN, message2receiver); 
      }else{
        msg = `CON You have insufficient funds to withdraw KES: ${amount} from your Celo account.`;        //+phoneNumber.substring(1)
        res.send(msg);
      } 
    }else{
      msg = `CON The PIN you have provided is invalid.`;
      res.send(msg);
    }
       
  }

 //  5. KOTANI DEX
  else if ( data[0] == '5' && data[1] == null) {
    // Business logic for first level msg
    msg = `CON Choose Investment Option
    1. Buy/Sell CELO
    2. Buy/Sell BTC
    3. Buy/Sell ETH
    4. Buy/Sell ICX`;
    msg += footer;
    res.send(msg);
   }else if ( data[0] == '5' && data[1] == '1' && data[2] == null) {
      let userMSISDN = phoneNumber.substring(1);      
      msg = `CON CELO Trading Coming soon`;    //await getAccDetails(userMSISDN);   
      msg += footer;  
      res.send(msg);   
   }else if ( data[0] == '5'  && data[1] == '2' && data[2] == null) {
      let userMSISDN = phoneNumber.substring(1);
      msg = `CON BTC Trading Coming soon`;
      msg += footer; 
      res.send(msg);
   }else if ( data[0] == '5'  && data[1] == '3' && data[2] == null) {
    let userMSISDN = phoneNumber.substring(1);
    msg = `CON ETH Trading Coming soon`; 
    msg += footer;   
    res.send(msg);    
   }else if ( data[0] == '5'  && data[1] == '4' && data[2] == null) {
    let userMSISDN = phoneNumber.substring(1);
    msg = `CON Choose ICX Option
        1. Check ICX/USD Current Price
        2. Market Buy ICX
        3. Limit Buy ICX
        4. Market Sell ICX
        5. Limit Sell ICX`;
    msg += footer;   
    res.send(msg);     
  }
  //1. Get ICX Current Price
  else if ( data[0] == '5'  && data[1] == '4' && data[2] == '1' ) {
    let userMSISDN = phoneNumber.substring(1);

    let icxprice = await getIcxUsdtPrice();
      console.log('Todays ICX Price=> ', icxprice);

    msg = `CON Current ICX Price is:\nUSD ${icxprice.price}`;
    msg += footer;
    res.send(msg);
  }
  //2. Market Buy ICX
  else if ( data[0] == '5'  && data[1] == '4' && data[2] == '2' && data[3] == null ) {
    let userMSISDN = phoneNumber.substring(1);

    let icxprice = await getIcxUsdtPrice();
      console.log('Todays ICX Price=> ', icxprice);
    msg = `CON Enter ICX Amount:`;
    msg += footer;
    res.send(msg);

   }else if ( data[0] == '5'  && data[1] == '4' && data[2] == '2' && data[3] !== '') { //2.1: Market Buy amount
    let userMSISDN = phoneNumber.substring(1);
    let amount = data[3]
    let icxprice = await getIcxUsdtPrice();
      console.log('Todays ICX Price=> ', icxprice);
    msg = `CON Buying ${amount} ICX @ USD ${icxprice.price}`;
    msg += footer;
    res.send(msg);
  }
  //3. Limit Buy ICX
  else if ( data[0] == '5'  && data[1] == '4' && data[2] == '3' && data[3] == null ) {
    let userMSISDN = phoneNumber.substring(1);

    //let icxprice = await getIcxUsdtPrice();
      //console.log('Todays ICX Price=> ', icxprice);
    msg = `CON Enter ICX Amount:`;
    msg += footer;
    res.send(msg);

   }else if ( data[0] == '5'  && data[1] == '4' && data[2] == '3' && data[3] !== '' && data[4] == null) { //3. Limit Buy ICX
    let userMSISDN = phoneNumber.substring(1);
    let amount = data[3];
    let icxprice = await getIcxUsdtPrice();
      console.log('Todays ICX Price=> ', icxprice);

    msg = `CON Current ICX mean Price: USD ${icxprice.price} \nBuying ${amount} ICX \n Enter your Price in USD`;
    msg += footer;
    res.send(msg);
   }else if ( data[0] == '5'  && data[1] == '4' && data[2] == '3' && data[3] !== '' && data[4] !== '') { //3.1. Limit Buy ICX
    let userMSISDN = phoneNumber.substring(1);
    let amount = data[3];

    // let icxprice = await getIcxUsdtPrice();
    let limitbuyprice = data[4];
      // console.log('Todays ICX Price=> ', icxprice);

    msg = `END Buying ${amount} ICX @ USD ${limitbuyprice}`;
    res.send(msg);
  }

 //  6. PAYBILL or BUY GOODS
  else if ( data[0] == '6' && data[1] == null) {
    // Business logic for first level msg
    msg = `CON Select Option:`;
    msg += `\n1. Buy Airtime`;
    msg += `\n2. PayBill`;
    msg += `\n3. Buy Goods`;
    msg += footer;
    res.send(msg);
  }
 //  6.1: BUY AIRTIME
  else if ( data[0] == '6' && data[1] == '1' && data[2] == null) { //  REQUEST && AMOUNT
    msg += `CON Enter Amount:`; 
    msg += footer;  
    res.send(msg);  
   }else if ( data[0] == '6' && data[1] == '1' && data[2]!== '') { 
    msg += `END Buying KES ${data[2]} worth of airtime for: `+phoneNumber;
    res.send(msg);        
  }

 //  6.2: PAY BILL  
  else if ( data[0] == '6' && data[1] == '2') {
      msg = `CON PayBill feature Coming soon`;
      msg += footer; 
      res.send(msg);      
  }

 //  6.1: BUY GOODS
  else if ( data[0] == '6'  && data[1] == '3') {
      let userMSISDN = phoneNumber.substring(1);
      msg = `CON BuyGoods feature Coming soon`;
      msg += footer; 
      res.send(msg);       
  }        

 //  7. ACCOUNT DETAILS
  else if ( data[0] == '7' && data[1] == null) {
    // Business logic for first level msg
    msg = `CON Choose account information you want to view
    1. Account Details
    2. Account balance
    3. Account Backup`;
    msg += footer;
    res.send(msg);
  }else if ( data[0] == '7' && data[1] == '1') {
    let userMSISDN = phoneNumber.substring(1);
    msg = await getAccDetails(userMSISDN);  
    res.send(msg);      
  }else if ( data[0] == '7'  && data[1] == '2') {
    let userMSISDN = phoneNumber.substring(1);
    msg = await getAccBalance(userMSISDN);  
    res.send(msg);      
  }else if ( data[0] == '7'  && data[1] == '3') {
    let userMSISDN = phoneNumber.substring(1);
    msg = await getSeedKey(userMSISDN); 
    res.send(msg);       
  }else if ( data[0] == '7'  && data[1] == '4') {
    let userMSISDN = phoneNumber.substring(1);
    let userId = await getSenderId(userMSISDN)
    await admin.auth().setCustomUserClaims(userId, {verifieduser: false});
    await firestore.collection('hashfiles').doc(userId).delete()
    await firestore.collection('kycdb').doc(userId).delete()
    msg = 'END Password reset was successful.\n Dial *483*354# to verify your details'; 
    res.send(msg);       
  }
   else{
    msg = `CON Sorry, I dont understand your option`;
    msg += 'SELECT:';
    msg += '\n1: Send Money';
    msg += '\n2: Deposit Funds';
    msg += '\n3: Withdraw Cash';
    msg += '\n5: Kotani Dex';
    msg += '\n6: PayBill or Buy Goods';
    msg += '\n7: My Account';
    res.send(msg);
 }

  
  //res.send(msg);
  // DONE!!!
});


// KOTANI RESTFUL API
restapi.post("/", async (req, res) => {  //{:path}/{:descr}
  if (req.method !== "POST"){
    return res.status(500).json({
      message: 'Not Allowed'
    });
  }
  console.log(JSON.stringify(req.body));

  let message = `Kindly use the following urls\n
    uri: sendfunds, parameters: {"phoneNumber" : "E.164 number" , "amount" : "value"} to transfer funds to the user's KotaniPay wallet\n
    uri: getbalance, parameter: {"phoneNumber" : "E.164 number" } to get the balance of an address associated with the phoneNumber\n
    uri: transactions, parameter: {"phoneNumber" : "E.164 number" } to get a list of transfers on the account associated with the phoneNumber\n
    uri: withdrawfiat, parameters: {"phoneNumber" : "E.164 number" , "amount" : "value"} to withdraw funds to your fiat mobile money wallet \n
    uri: depositfunds, parameters: {celloAddress, phoneNumber, amount} to deposit funds (cUSD) directly to a supported wallet e.g. Valora`;
  res.status(200).send(message); 
});

function isAuthenticated(req, res, next) {
  if (typeof req.headers.authorization !== "undefined") {
      // retrieve the authorization header and parse out the
      // JWT using the split function
      let token = req.headers.authorization.split(" ")[1];
      let privateKey = fs.readFileSync('jenga-api/privatekey.pem', 'utf-8');
      // Here we validate that the JSON Web Token is valid and has been 
      // created using the same private pass phrase
      jwt.verify(token, privateKey, { algorithm: "HS256" }, (err, user) => {
          
          // if there has been an error...
          if (err) {  
              // shut them out!
              res.status(500).json({ error: "Not Authorized" });
              throw new Error("Not Authorized");
          }
          // if the JWT is valid, allow them to hit
          // the intended endpoint
          return next();
      });
  } else {
      // No authorization header exists on the incoming
      // request, return not authorized and throw a new error 
      res.status(500).json({ error: "Not Authorized" });
      throw new Error("Not Authorized");
  }
}

restapi.post('/jwt', async(req, res) => {
  const privateKey = fs.readFileSync('jenga-api/privatekey.pem', 'utf-8');
  let token = jwt.sign({"body" : "stuff"}, privateKey, {algorithm: 'HS256'});
  res.send(token);
});


//parameters: {"phoneNumber" : "E.164 number" , "amount" : "value"}
restapi.post('/sendfunds', async (req, res) => {  //isAuthenticated,
  //console.log('Token: ', req.token)
  let userMSISDN = req.body.phoneNumber;
  try {
    const recnumber = phoneUtil.parseAndKeepRawInput(`${userMSISDN}`, 'KE');
    userMSISDN = phoneUtil.format(recnumber, PNF.E164);
  } catch (error) {
    console.log(error); 
  }
  userMSISDN = userMSISDN.substring(1);

  let userId  = await getSenderId(userMSISDN)
  console.log('UserId: ', userId)

  let userstatusresult = await checkIfSenderExists(userId);
  console.log("User Exists? ",userstatusresult);
  if(userstatusresult === false){ 
    await addUserDataToDB(userId, userMSISDN); 
    console.log('creating user acoount');
  }    
  
  let userInfo = await getSenderDetails(userId);
  console.log('User Address => ', userInfo.data().publicAddress);

  let message = {       
    "phoneNumber": `${userMSISDN}`, 
    "address": `${userInfo.data().publicAddress}`      
  };

  res.json(message);
});

//parameter: {"phoneNumber" : "E.164 number" }
restapi.post('/getbalance', async (req, res) => {
  let userMSISDN = req.body.phoneNumber;
  try {
    const recnumber = phoneUtil.parseAndKeepRawInput(`${userMSISDN}`, 'KE');
    userMSISDN = phoneUtil.format(recnumber, PNF.E164);
  } catch (error) {
    console.log(error); 
  }
  userMSISDN = userMSISDN.substring(1);

  let userId  = await getSenderId(userMSISDN)
  console.log('UserId: ', userId)

  let userstatusresult = await checkIfSenderExists(userId);
  console.log("User Exists? ",userstatusresult);
  if(userstatusresult == false){ 
    await addUserDataToDB(userId, userMSISDN); 
    console.log('creating user acoount');
  }    
  
  let userInfo = await getSenderDetails(userId);
  console.log('User Address => ', userInfo.data().publicAddress);
  
  const cusdtoken = await kit.contracts.getStableToken()
  let cusdBalance = await cusdtoken.balanceOf(userInfo.data().publicAddress) // In cUSD
  console.log(`CUSD Balance Before: ${cusdBalance}`)
  //cusdBalance = kit.web3.utils.fromWei(cusdBalance.toString(), 'ether');
  console.info(`Account balance of ${await weiToDecimal(cusdBalance)} CUSD`)

  const celotoken = await kit.contracts.getGoldToken()
  let celoBalance = await celotoken.balanceOf(userInfo.data().publicAddress) // In cGLD
  //console.log(`CELO Balance Before: ${celoBalance}`)
  //celoBalance = kit.web3.utils.fromWei(celoBalance.toString(), 'ether');    
  console.info(`Account balance of ${await weiToDecimal(celoBalance)} CELO`);
  //@TODO: Apply localization to the balance values

  let message = {       
    "Address": `${userInfo.data().publicAddress}`, 
    "Balance": {
      "cusd" : `${await weiToDecimal(cusdBalance)}`, 
      "celo" : `${await weiToDecimal(celoBalance)}`,
    }   
  };

  res.json(message);
});

//parameter: {"phoneNumber" : "E.164 number" }
restapi.post('/transactions', async (req, res) => { 
  let userMSISDN = req.body.phoneNumber;
  // let amount = request.body.amount;
  try {
    const recnumber = phoneUtil.parseAndKeepRawInput(`${userMSISDN}`, 'KE');
    userMSISDN = phoneUtil.format(recnumber, PNF.E164);
  } catch (error) {
    console.log(error); 
  }
  userMSISDN = userMSISDN.substring(1);

  let userId  = await getSenderId(userMSISDN)
  console.log('UserId: ', userId)

  let userstatusresult = await checkIfSenderExists(userId);
  console.log("User Exists? ",userstatusresult);
  if(userstatusresult == false){ 
    await addUserDataToDB(userId, userMSISDN); 
    console.log('creating user acoount');
  }    
  
  let userInfo = await getSenderDetails(userId);
  console.log('User Address => ', userInfo.data().publicAddress);

  let response  = await axios.get(`https://explorer.celo.org/api?module=account&action=tokentx&address=${userInfo.data().publicAddress}#`)
  // console.log(response.data.result);  

  let message = {       
    "phoneNumber": `${userMSISDN}`, 
    "transactions": response.data.result
  };

  res.json(message);
});

restapi.post("/getkotanipayescrow", async (req, res) => { 
  let escrowId  = await getSenderId(escrowMSISDN);
  let escrowInfo = await getSenderDetails(escrowId);
  console.log('User Address => ', escrowInfo.data().publicAddress);

  //@task Add CUSD to KES conversion rate:
  let message = {
    "kotanipayEscrowAddress": `${escrowInfo.data().publicAddress}`,
    "conversionRate" : { "cusdToKes" : `100` }
  };

  res.json(message);
});

//parameters: {"phoneNumber" : "E.164 number" , "amount" : "value", "txhash" : "value"}
restapi.post("/withdraw", async (req, res) => {
  let userMSISDN = req.body.phoneNumber;
  // let amount = req.body.amount;
  let txhash = req.body.txhash;
  try {
    const recnumber = phoneUtil.parseAndKeepRawInput(`${userMSISDN}`, 'KE');
    userMSISDN = phoneUtil.format(recnumber, PNF.E164);
  } catch (error) {console.log(error); }
  userMSISDN = userMSISDN.substring(1);
  let userId  = await getSenderId(userMSISDN)

  //txid = "0x80e793600fd6e04fde61e4b0815a3d96f8205ce79c6a388226e60b7b184f472b"
  if(txhash !== null && txhash !==''){  //Check for empty or null tx hash  0xd3625b379fbe8fd5d36906c618f61b53dd8f546e6255a189a7f8be4cc8c00634
    var txreceipt = await validateCeloTransaction(txhash)
    var tx = await kit.web3.eth.getTransaction(txhash)
    if(txreceipt !== null){  //check for a null tx receipt due to invalid hash
      console.log('Txn Receipt=> ', JSON.stringify(txreceipt))
      // console.log('Status: ', txreceipt.status)
      console.log('To: ', tx.to)
      console.log('To checksum', checksumAddress(txreceipt.to))
  
      let escrowId  = await getSenderId(escrowMSISDN)
      let escrowInfo = await getSenderDetails(escrowId);
      // console.log('User Address => ', escrowInfo.data().publicAddress);

      let txblock = await getTransactionBlock(txhash);
      console.log('Tx Block', txblock);
      let validblocks = txblock+1440
      console.log('Valid Block', validblocks);
      let latestblock = await getLatestBlock();
      console.log('Tx Block', txblock);

      //  && validblocks >= latestblock 
      // address = 0xe6b8f07271b97be93d95b18bbe891860b0b7e07f
      // && checksumAddress(tx.to) === escrowInfo.data().publicAddress
      if(txreceipt.status === true ){   //check that the tx TO: address if the kotaniEscrow Address  //"0xe6b8f07271b97be93d95b18bbe891860b0b7e07f"
        console.log('Tx Receipt Status: ',txreceipt.status)
        let _amount = await getTxAmountFromHash(txhash);
        console.log('amount: ', _amount)
        try{
          //Forward Tx to Jenga API
          // let existstatus = await checkIfUserAccountExist(userId, userMSISDN);
          let userExists = await checkIfSenderExists(userId);
          if(userExists === false){         
            let userCreated = await createNewUser(userId, userMSISDN);     
            console.log('Created user with userID: ', userCreated); 
          }
          // console.log('Exists: ',existstatus)
          // let isVerified = await checkIsUserVerified(senderId)
          // console.log('Verified: ',isVerified)
          let isverified = await checkIfUserisVerified(userId);    
          if(isverified === false){     //  && data[0] !== '7' && data[1] !== '4'
            // console.log("User: ", senderId, "is NOT VERIFIED!");
            // msg += `END Verify your account by dialing *483*354*7*4#`;
            res.json({
              "status": 'unverified',
              "message": "user account is not verified",
              "comment" : "Access https://europe-west3-kotanimac.cloudfunctions.net/restapi/kyc to verify your account"
            })    
          }else{
            let isProcessed = await getProcessedTransaction(txhash);
            if(isProcessed == true){
              let message = {
                "status": `failed`,
                "message": `Transaction Hash is already processed`
              };
              res.json(message);

            }else{
              let txdetails = {
                "blockNumber" : await getTransactionBlock(txhash),
                "value" : _amount,
                "from" : checksumAddress(tx.from),
                "to" : checksumAddress(tx.to)
              }
              await processApiWithdraw(userMSISDN, "10");
              await setProcessedTransaction(txhash, txdetails)
              console.log(txhash, ' Transaction processing successful')
            }  
          }
        }catch(e){console.log(e)}
      }else{
        let message = {
          "status": `failed`,
          "message": `Invalid Transaction`
        };
        res.json(message);
      }

    }else{
      let message = {
        "status": `failed`,
        "message": `Invalid Transaction Receipt`
      };
      res.json(message);
    }
  }else{  
  let message = {
    "status": `failed`,
    "message": `Invalid Hash`
  };
  res.json(message);
}
});

restapi.post('/kyc', async (req, res) => {
  const { body: { phoneNumber: phoneNumber } } = req;
  const { body: { phoneNumber: documentType } } = req;
  const { body: { phoneNumber: documentNumber } } = req;
  const { body: { phoneNumber: firstname } } = req;
  const { body: { phoneNumber: lastname } } = req;
  const { body: { phoneNumber: dateofbirth } } = req;
  const { body: { phoneNumber: email } } = req;
  // const { body: { phoneNumber: phoneNumber } } = req;


  let userMSISDN = '';  
  if(phoneNumber !== null){
    try {
      const recnumber = phoneUtil.parseAndKeepRawInput(`${phoneNumber}`, 'KE');
      userMSISDN = phoneUtil.format(recnumber, PNF.E164);
    } catch (err) { console.log(err); }
    userMSISDN = userMSISDN.substring(1);
  }else{
    let message = {       
      "Status": `error`, 
      "Comment": `phoneNumber cannot be empty` 
    };    
    res.json(message);
  } 
  console.log('userMSISDN: ', userMSISDN)
  let userId  = await getSenderId(userMSISDN)
  console.log('UserId: ', userId)

  let userstatusresult = await checkIfSenderExists(userId);
  console.log("User Exists? ",userstatusresult);
  if(userstatusresult == false){ 
    await addUserDataToDB(userId, userMSISDN); 
    console.log('creating user acoount');
  } 

  let isKyced = await checkisUserKyced(userId);
  if(isKyced == true){  //Already KYC'd
    let message = {     
      "Status": `active`, 
      "Comment": `KYC Document already exists` 
    };    
    res.json(message);
  }else{  //NOT KYC'd

     
  
  // let userInfo = await getSenderDetails(userId);
  // console.log('User Address => ', userInfo.data().publicAddress);

  //check if KYC data already exists
  //let alreadykyced = await 
 
    // let documentType = req.body.documentType;
    // let documentNumber = req.body.documentNumber;
    // let firstname = req.body.firstname;
    // let lastname = req.body.lastname;
    // let dateofbirth = req.body.dateofbirth;
    // let email = req.body.emailAddress;
    let newUserPin = "0000";
    let enc_loginpin = await createcypher(newUserPin, userMSISDN, iv);

    if(documentType == null || documentType !== "AlienID" || documentType !== "Passport" || documentType !== "ID"){
      let message = {       
        "Status": `error`, 
        "Comment": `documentType must be either ID or Passport or AlienID` 
      };    
      res.json(message);
    }

    if(documentNumber == null || documentNumber == ""){
      let message = {       
        "Status": `error`, 
        "Comment": `provide your ${documentType} number` 
      };    
      res.json(message);
    }

    if(firstname == null || firstname == ""){
      let message = {       
        "Status": `error`, 
        "Comment": `provide your firstname as in the ${documentType}` 
      };    
      res.json(message);
    }

    if(lastname == null || lastname == ""){
      let message = {       
        "Status": `error`, 
        "Comment": `provide your lastname as in the ${documentType}` 
      };    
      res.json(message);
    }

    if(dateofbirth == null || dateofbirth == ""){
      let message = {       
        "Status": `error`, 
        "Comment": `provide your date of birth in the format YYYY-MM-DD` 
      };    
      res.json(message);
    }

    if(email == null || email == ""){
      let message = {       
        "Status": `error`, 
        "Comment": `provide a valid email address` 
      };    
      res.json(message);
    }
 


    console.log(`User Details=>${userId} : ${newUserPin} : ${documentType} : ${documentNumber} : ${firstname} : ${lastname} : ${dateofbirth} : ${email} : ${enc_loginpin}`);
  

    //KYC USER
    let merchantcode = '9182506466';
    let countryCode = 'KE';
    let kycData = await jenga.getUserKyc(merchantcode, documentType, documentNumber, firstname, lastname, dateofbirth, countryCode);
    console.log('KYC DATA:\n ',JSON.stringify(kycData));
    // console.log('ID From Jenga: ',kycData.identity.additionalIdentityDetails[0].documentNumber )
    if (kycData !== null && kycData.identity.additionalIdentityDetails[0].documentNumber === documentNumber){
      // //Update User account and enable
      // let updateinfo = await verifyNewUser(userId, email, enc_loginpin, firstname, lastname, dateofbirth, idnumber, userMSISDN);

      // await firestore.collection('hashfiles').doc(userId).set({'enc_pin' : `${enc_loginpin}`}); 

      // console.log('User data updated successfully: \n',JSON.stringify(updateinfo));
      // //save KYC data to KYC DB
      // let newkycdata = await addUserKycToDB(userId, kycData);
      // // console.log('KYC Data: ', JSON.stringify(newkycdata));

      let message = {       
        "status": `success`, 
        "Details": `KYC completed successfully`   
      };
    
      res.json(message);

    } }
});

//parameters: {celloAddress, phoneNumber, amount} 
restapi.post("/depositfunds", async (req, res) => { 
  const data = req.body;
  console.log('B2C Data: ',data);
  res.send(`Funds deposit coming soon: ${data}`); 
});

async function validateCeloTransaction(txhash){    
  var receipt = await kit.web3.eth.getTransactionReceipt(txhash)
  // .then(console.log);
  return receipt;
}

async function processApiWithdraw(withdrawMSISDN, amount){
    // let withdrawMSISDN = phoneNumber.substring(1); 

    console.log('Amount to Withdraw: KES.', amount);

    let displayName = '';
    withdrawId = await getSenderId(withdrawMSISDN);
    console.log('withdrawId: ', withdrawId);
    
    await admin.auth().getUser(withdrawId).then(user => { displayName = user.displayName; return; }).catch(e => {console.log(e)}) 
    console.log('Withdrawer fullName: ', displayName);

    let currencyCode = 'KES';
    let countryCode = 'KE';
    let recipientName = `${displayName}`;
    let mobileNumber = '';
    try {
      const number = phoneUtil.parseAndKeepRawInput(`${withdrawMSISDN}`, 'KE');
      mobileNumber = '0'+number.getNationalNumber();
    } catch (error) { console.log(error); }
    console.log('Withdrawer MobileNumber', mobileNumber);

    let withdrawToMpesa = await jenga.sendFromJengaToMobileMoney(amount, currencyCode, countryCode, recipientName, mobileNumber);
    console.log('Sending From Jenga to Mpesa Status => ', JSON.stringify(withdrawToMpesa.status));

    // jenga.sendFromJengaToMobileMoney(data[1], 'KES', 'KE',`${fullname}`, withdrawMSISDN) 
    let message2receiver = `You have Withdrawn KES ${amount} to your Mpesa account.`;
    sendMessage("+"+withdrawMSISDN, message2receiver);  

    let message = {
      "status": `success`,
      "recipientName": displayName,
      "message": `Withdraw via Kotanipay successful`,
      "recipient": `${withdrawMSISDN}`,
      "amount": `${amount} CUSD`
    };
    return message
    
}

async function checkisUserKyced(userId){
  let docRef = firestore.collection('kycdb').doc(userId);
  let isKyced = false;
  
  let doc = await docRef.get();
  if (!doc.exists) {
    isKyced = false;  // Run KYC
    console.log('No such document!');
  } else {
    isKyced = true; // do nothing
    console.log('KYC Document Exists => ', JSON.stringify(doc.data()));
  }
  return isKyced;
}


async function getProcessedTransaction(txhash){
  let docRef = firestore.collection('processedtxns').doc(txhash);
  let processed = false;
  
  let doc = await docRef.get();
  if (!doc.exists) {
    processed = false;  // create the document
    console.log('No such document!');
  } else {
    processed = true; // do nothing
    console.log('Document data:', doc.data());
  }
  return processed;
}

async function setProcessedTransaction(txhash, txdetails){
  try {
    let db = firestore.collection('processedtxns').doc(txhash);
    db.set(txdetails).then(newDoc => {console.log("Transaction processed: => ", newDoc.data().id)})
    
  } catch (err) { console.log(err) }
}


async function checkIfUserAccountExist(userId, userMSISDN){
  let userExists = await checkIfSenderExists(userId);
  if(userExists === false){         
    let userCreated = await createNewUser(userId, userMSISDN);     
    console.log('Created user with userID: ', userCreated); 
  }
}

async function checkIsUserVerified(senderId){
  let isverified = await checkIfUserisVerified(senderId);    
  if(isverified === false){     //  && data[0] !== '7' && data[1] !== '4'
    // console.log("User: ", senderId, "is NOT VERIFIED!");
    // msg += `END Verify your account by dialing *483*354*7*4#`;
    res.json({
      "status": 'unverified',
      "message": "user account is not verified",
      "comment" : "Access"
    })    
  }    
}


//MPESA's CALLBACK API

//JENGA CALLBACK API
jengaApi.post("/", async (req, res) => {
  let data = req.body
  //data = data.JSON
  // console.log(JSON.stringify(data));
  // console.log('Transaction Details: \nTx Info: ',data.transaction.additionalInfo);
  // console.log('billNumber: ',data.transaction.billNumber);
  // console.log('orderAmount: ',data.transaction.amount);
  // console.log('reference: ',data.transaction.reference);
  if(data.bank.transactionType === "C"){

    console.log('Deposit details: ',JSON.stringify(data));

    console.log('Deposit Transaction Details: ',data.transaction.additionalInfo);
    let depositAditionalInfo = data.transaction.additionalInfo;
    let amount = data.transaction.amount;

    var depositDetails = depositAditionalInfo.split('/');
    //console.log('Depositor PhoneNumber: ',depositDetails[1]);
    let depositMSISDN = depositDetails[1];

    //DEPOSIT VIA EQUITY PAYBILL or TILL NUMBER
    const escrowMSISDN = functions.config().env.escrow.msisdn;
    let escrowId = await getRecipientId(escrowMSISDN);
    // console.log('escrowId: ', escrowId);
  
    let depositId = await getSenderId(depositMSISDN)
    // console.log('depositId: ', depositId);

    await admin.auth().getUser(depositId)
    .then(user => {
      console.log('Depositor fullName: ',user.displayName); 
      // displayName = user.displayName;
      return;
    })
    .catch(e => {console.log(e)})
  
    // Retrieve User Blockchain Data
    let depositInfo = await getSenderDetails(depositId);
    // console.log('Sender Info: ', JSON.stringify(depositInfo.data()))
    //let senderprivkey = await getSenderPrivateKey(depositInfo.data().seedKey, depositMSISDN, iv)

    let escrowInfo = await getReceiverDetails(escrowId);
    let escrowprivkey = await getSenderPrivateKey(escrowInfo.data().seedKey, escrowMSISDN, iv)

  

    let receipt = await transfercUSD(escrowInfo.data().publicAddress, depositInfo.data().publicAddress, amount, escrowprivkey);
    let url = await getTxidUrl(receipt.transactionHash);
    let message2depositor = `You have deposited KES ${amount} to your Celo Account.\nReference: ${data.transaction.billNumber}\nTransaction Link:  ${url}`;
    console.log('tx URL', url);
    sendMessage("+"+depositMSISDN, message2depositor);
    //res.send('Jenga API Callback Successful!');
    //return
  }

  else if(data.bank.transactionType === "D"){
    console.log('Withdraw tx Details:', JSON.stringify(data));
  }

  else{
    console.log('ERROR: ',JSON.stringify(data));
  }

  res.send('Jenga API Callback Successful!');
});

jengaApi.post("/deposit", async (req, res) => {
  let data = req.body
  //data = data.JSON
  console.log(JSON.stringify(data));
  console.log('Transaction Details: \nTx Info: ',data.transaction.additionalInfo);
  // console.log('billNumber: ',data.transaction.billNumber);
  // console.log('orderAmount: ',data.transaction.amount);
  // console.log('reference: ',data.transaction.reference);


  // jengaDeposit();
  
  let depositAditionalInfo = data.transaction.additionalInfo;
  let amount = data.transaction.amount;

  var depositDetails = depositAditionalInfo.split('/');
  console.log('Depositor PhoneNumber: ',depositDetails[1]);
  let depositMSISDN = depositDetails[1];

  //DEPOSIT VIA EQUITY PAYBILL or TILL NUMBER
  const escrowMSISDN = functions.config().env.escrow.msisdn;
  escrowId = await getRecipientId(escrowMSISDN);
  console.log('escrowId: ', escrowId);
  
  depositId = await getSenderId(depositMSISDN)
  console.log('depositId: ', depositId);

  await admin.auth().getUser(depositId)
  .then(user => {
    console.log('Depositor fullName: ',user.displayName); 
    // displayName = user.displayName;
    return;
  })
  .catch(e => {console.log(e)})
  
  // Retrieve User Blockchain Data
  let depositInfo = await getSenderDetails(depositId);
  // console.log('Sender Info: ', JSON.stringify(depositInfo.data()))
  //let senderprivkey = await getSenderPrivateKey(depositInfo.data().seedKey, depositMSISDN, iv)

  let escrowInfo = await getReceiverDetails(escrowId);
  let escrowprivkey = await getSenderPrivateKey(escrowInfo.data().seedKey, escrowMSISDN, iv)
  // console.log('pk:',escrowprivkey);

  

  let receipt = await transfercUSD(escrowInfo.data().publicAddress, depositInfo.data().publicAddress, amount, escrowprivkey);
  let url = await getTxidUrl(receipt.transactionHash);
  let message2depositor = `You have deposited KES ${amount} to your Celo Account.\nReference: ${data.transaction.billNumber}\nTransaction Link:  ${url}`;
  console.log('tx URL', url);
  sendMessage("+"+depositMSISDN, message2depositor);

  //var options = { noColor: true };
  // Read variables sent via POST from our SDK
  
  // const data = req.body;
  // console.log(data);
  res.send('Jenga API Callback Successful!');
});

//USSD APP
async function getAccDetails(userMSISDN){
  // console.log(userMSISDN);
  let userId = await getSenderId(userMSISDN);
  
  let userInfo = await getSenderDetails(userId);
  console.log('User Address => ', userInfo.data().publicAddress);
  let url = await getAddressUrl(`${userInfo.data().publicAddress}`)
  console.log('Address: ',url);            
  return `CON Your Account Number is: ${userMSISDN} \nAccount Address is: ${url}`;
}

async function getSenderPrivateKey(seedCypher, senderMSISDN, iv){
  try {
    let senderSeed = await decryptcypher(seedCypher, senderMSISDN, iv);
    // console.log('Sender seedkey=>',senderSeed);
    let senderprivkey =  `${await generatePrivKey(senderSeed)}`;
    return new Promise(resolve => {  
      resolve (senderprivkey)        
    }); 
  }catch(err){console.log('Unable to decrypt cypher')}
}

async function getSeedKey(userMSISDN){
  let userId = await getSenderId(userMSISDN);
  console.log('User Id: ', userId)
  
  let userInfo = await getSenderDetails(userId);
  // console.log('SeedKey => ', userInfo.data().seedKey);
  let decr_seed = await decryptcypher(userInfo.data().seedKey, userMSISDN, iv)
          
  return `END Your Backup Phrase is:\n ${decr_seed}`;
}

function getPinFromUser(){
  return new Promise(resolve => {    
    let loginpin = randomstring.generate({ length: 5, charset: 'numeric' });
    resolve (loginpin);
  });
}

async function addUserKycToDB(userId, kycdata){ 
  try {
    let db = firestore.collection('kycdb').doc(userId);
    db.set(kycdata).then(newDoc => {console.log("KYC Document Created:\n", newDoc.data().id)})
    
  } catch (err) { console.log(err) }
}
  
async function addUserDataToDB(userId, userMSISDN){ 
  try {
    
    // console.log('user ID: ', userId);
    let mnemonic = await bip39.generateMnemonic(256);
    // console.log('mnemonic seed=> ', mnemonic);
    var enc_seed = await createcypher(mnemonic, userMSISDN, iv);
    // console.log('Encrypted seed=> ', enc_seed);
    let publicAddress = await getPublicAddress(mnemonic);
    console.log('Public Address: ', publicAddress); 
    let initdepohash = await signupDeposit(publicAddress);
    console.log('Signup Deposit', JSON.stringify(initdepohash));

    // let message2receiver = `Welcome to Kotanipay.\nYour account has been created.\nDial *483*354# to verify your account`;
    // console.log('Send SMS to user: \n',JSON.stringify(message2receiver));

    //@task : Enable once done testing
    // sendMessage("+"+userMSISDN, message2receiver);

    const newAccount = {
        'seedKey' : `${enc_seed}`,
        'publicAddress' : `${publicAddress}`
    };
    // ,'userLoginPin' : enc_loginpin

    let db = firestore.collection('accounts').doc(userId);    
    db.set(newAccount).then(newDoc => { console.log("Document Created: ", newDoc.data().id) })
    
  } catch (err) { console.log('accounts db error: ',err) }

  //return true; 
}

async function signupDeposit(publicAddress){
  const escrowMSISDN = functions.config().env.escrow.msisdn;
  let escrowId = await getSenderId(escrowMSISDN);
  let escrowInfo = await getSenderDetails(escrowId);
  let escrowPrivkey = await getSenderPrivateKey(escrowInfo.data().seedKey, escrowMSISDN, iv);

  let receipt = await transfercUSD(escrowInfo.data().publicAddress, publicAddress, '2', escrowPrivkey);  
  let celohash = await sendcGold(escrowInfo.data().publicAddress, publicAddress, '0.01', escrowPrivkey);
  console.log(`Signup deposit tx hash: ${receipt.transactionHash}`);
  return receipt.transactionHash;
}       
  
async function getSenderDetails(senderId){
  let db = firestore.collection('accounts').doc(senderId);
  let result = await db.get();
  return result;    
}

async function getLoginPin(userId){
  let db = firestore.collection('hashfiles').doc(userId);
  let result = await db.get();
  return result.data().enc_pin;    
}
    
async function getReceiverDetails(recipientId){    
  let db = firestore.collection('accounts').doc(recipientId);
  let result = await db.get();
  return result;
}

function number_format(val, decimals){
  //Parse the value as a float value
  val = parseFloat(val);
  //Format the value w/ the specified number
  //of decimal places and return it.
  return val.toFixed(decimals);
}

async function getWithdrawerBalance(publicAddress){
  const cusdtoken = await kit.contracts.getStableToken();
  const cusdbalance = await cusdtoken.balanceOf(publicAddress); // In cUSD 
  //cUSDBalance = kit.web3.utils.fromWei(cUSDBalance.toString(), 'ether'); 
  let _cusdbalance = await weiToDecimal(cusdbalance);
  console.info(`Account balance of ${_cusdbalance} CUSD`);
  _cusdbalance = number_format(_cusdbalance, 4)
  return _cusdbalance*100;
}

async function getAccBalance(userMSISDN){

  // console.log(userMSISDN);
  let userId  = await getSenderId(userMSISDN);
  // console.log('UserId: ', userId);   
  
  let userInfo = await getSenderDetails(userId);
  //console.log('User Address => ', userInfo.data().publicAddress);
  
  const cusdtoken = await kit.contracts.getStableToken();
  const cusdbalance = await cusdtoken.balanceOf(userInfo.data().publicAddress); // In cUSD 
  //cUSDBalance = kit.web3.utils.fromWei(cUSDBalance.toString(), 'ether'); 
  let _cusdbalance = await weiToDecimal(cusdbalance);
  console.info(`Account balance of ${_cusdbalance} CUSD`);
  _cusdbalance = number_format(_cusdbalance, 4)

  const celotoken = await kit.contracts.getGoldToken()   
  let celobalance = await celotoken.balanceOf(userInfo.data().publicAddress) // In cGLD
  let _celobalance = await weiToDecimal(celobalance);
  //cGoldBalance = kit.web3.utils.fromWei(celoBalance.toString(), 'ether');    
  console.info(`Account balance of ${_celobalance} CELO`)
  return `CON Your Account Balance is:\n Kenya Shillings: ${_cusdbalance*100} \n0:Home 00:Back`;
}

function getSenderId(senderMSISDN){
  return new Promise(resolve => {
    let senderId = crypto.createHash(phone_hash_fn).update(senderMSISDN).digest('hex');
    resolve(senderId);
  });
} 
  
function getRecipientId(receiverMSISDN){
  return new Promise(resolve => {
      let recipientId = crypto.createHash(phone_hash_fn).update(receiverMSISDN).digest('hex');
      resolve(recipientId);
  });
} 

async function checkIfSenderExists(senderId){      
  return await checkIfUserExists(senderId);
}

async function checkIfRecipientExists(recipientId){    
  return await checkIfUserExists(recipientId);
}

async function checkIfUserisVerified(userId){
  var isVerified;         
  return new Promise(resolve => {
    admin.auth().getUser(userId)
      .then(function(userRecord) {          
          if (userRecord.customClaims['verifieduser'] === true) {
              console.log(userRecord.customClaims['verifieduser']);
              isVerified = true;
              resolve (isVerified);
          } else {
            console.log("User: ", userId, "is NOT VERIFIED!:\n");
            isVerified = false;
            resolve (isVerified);
          }
      })
      .catch(function(error) {
          // console.log('Error fetching user data:', userId, "does not EXIST:\n");
          isVerified = false;
          resolve (isVerified);
      });
  });    
} 

async function checkIfUserExists(userId){
  var exists;         
  return new Promise(resolve => {
    admin.auth().getUser(userId)
      .then(function(userRecord) {          
        if (userRecord) {
            console.log('Successfully fetched user data:', userRecord.uid);
            exists = true;
            resolve (exists);
        } else {
          console.log("Document", userId, "does not exists:\n");
          exists = false;
          resolve (exists);
        }
      })
      .catch(function(error) {
          console.log('Error fetching user data:', userId, "does not exists:\n");
          exists = false;
          resolve (exists);
      });
  });    
} 


function sleep(ms){
  return Promise(resolve => setTimeout(resolve, ms));
}

//.then(admin.auth().setCustomUserClaims(userId, {verifieduser: false}))
function createNewUser(userId, userMSISDN){
  return new Promise(resolve => {
      admin.auth().createUser({
          uid: userId,
          phoneNumber: `+${userMSISDN}`,
          disabled: true
      })
      .then(userRecord => {
        admin.auth().setCustomUserClaims(userRecord.uid, {verifieduser: false})
        console.log('Successfully created new user:', userRecord.uid);
        resolve (userRecord.uid);
      })
      .catch(function(error) {
          console.log('Error creating new user:', error);
      });
  });  
}

async function verifyNewUser(userId, email, password, firstname, lastname, idnumber, dateofbirth, userMSISDN){
  return new Promise(resolve => {
      admin.auth().updateUser(userId, { 
          email: `${email}`,
          password: `${password}`,
          emailVerified: false,
          displayName: `${firstname} ${lastname}`,
          idnumber: `${idnumber}`,
          dateofbirth: `${dateofbirth}`,
          disabled: false
      })
      .then(userRecord => {
        admin.auth().setCustomUserClaims(userRecord.uid, {verifieduser: true})
          // console.log('Successfully updated user:', userRecord.toJSON());
          
          //Inform user that account is now verified
          let message2sender = `Welcome to Kotanipay.\nYour account details have been verified.\nDial *483*354# to access the KotaniPay Ecosytem`;
          // let message2receiver = `Welcome to Kotanipay.\nYour account has been created.\nDial *483*354# to verify your account`;
          // console.log('Send SMS to user: \n',JSON.stringify(message2receiver));

          // @task : Enable once done testing
          // sendMessage("+"+userMSISDN, message2receiver);
          console.log('Sending SMS to users => ', JSON.stringify(message2sender));
          //@task Enable once done testing
          sendMessage("+"+userMSISDN, message2sender);
          resolve (userRecord.uid);
      })
      .catch(function(error) {
          console.log('Error updating user:', error);
      });
  });  
}
        
function generateLoginPin(){
  return new Promise(resolve => {
    resolve (randomstring.generate({ length: 5, charset: 'numeric' }));
  });
}

// TELEGRAM BOT API
app.post('/kotanibot', async (req, res) => {
    /*
      You can put the logic you want here
      the message receive will be in this
      https://core.telegram.org/bots/api#update
    */
    // const TelegramBot = require('node-telegram-bot-api');
    // const token = '1139179086:AAFYDu1IEbIehUyxLbAPRJxMVV6QJyIXUas';
    // // Created instance of TelegramBot
    // const bot = new TelegramBot(token, { polling: true });
    console.log(JSON.stringify(req.body));

    // const isTelegramMessage = req.body
    //                         && req.body.message
    //                         && req.body.message.chat
    //                         && req.body.message.chat.id
    //                         && req.body.message.from
    //                         && req.body.message.from.first_name

    const botPost = req.body
    console.log(JSON.stringify('Bot Data => ',botPost));
    const messagetext = `${botPost.message.text}`

    // console.log('Data: => ', isTelegramMessage);
  
    if (botPost.hasOwnProperty('message') && messagetext == '\/start') {            // && messagetext == "\/start"
      const chat_id = botPost.message.chat.id
      const { first_name } = req.body.message.from

      const reply = {
        method: 'sendMessage',
        chat_id,
        text: `Hello ${first_name} select option`,
        resize_keyboard: true,
        reply_markup: {"keyboard":[["Transfer Funds"],["Deposit Cash"],["Withdraw Cash"],["Pay Utilities"],["Loans and Savings"],["Paybill and Buy Goods"],["My Account"]]}
      };  
      return res.status(200).send(reply);
    }

    else if(botPost.hasOwnProperty('message') && messagetext == 'Transfer Funds'){
        console.log('Text: ',messagetext)
        const chat_id = req.body.message.chat.id
        const { first_name } = req.body.message.from
    
        return res.status(200).send({
          method: 'sendMessage',
          chat_id,
          text: `Enter your phone Number with country code:`,
          requestPhoneKeyboard: true
        })
    }

    else if(botPost.hasOwnProperty('message') && messagetext == 'Deposit Cash'){
        console.log('Text: ',messagetext)
        const chat_id = req.body.message.chat.id
        const { first_name } = req.body.message.from
    
        return res.status(200).send({
          method: 'sendMessage',
          chat_id,
          text: `Enter your phone Number with country code:`,
          resize_keyboard: true,
          reply_markup: {"keyboard":[["7","8","9"], 
          ["4" , "5","6"],
          ["1","2","3"], 
          ["0","+","SEND"]]}
        })
    }

    else{
        const chat_id = botPost.message.chat.id
        const { first_name } = req.body.message.from

        const reply = {
            method: 'sendMessage',
            chat_id,
            text: `Hello ${first_name} select option`,
            resize_keyboard: true,
            reply_markup: {"keyboard":[["Transfer Funds"],["Deposit Cash"],["Withdraw Cash"],["Pay Utilities"],["Loans and Savings"],["Paybill and Buy Goods"],["My Account"]]}
        };  
        return res.status(200).send(reply);
    }
  
    return res.status(200).send({ status: 'not a telegram message' })
  });


exports.restapi = functions.region('europe-west3').https.onRequest(restapi); 

exports.kotanipay = functions.region('europe-west3').https.onRequest(app);       //.region('europe-west1')

exports.addUserData = functions.region('europe-west3').auth.user().onCreate(async (user) => {
    console.log('creating new user data:', user.uid, user.phoneNumber)
    await addUserDataToDB(user.uid, user.phoneNumber.substring(1));
});

exports.authOnDelete = functions.region('europe-west3').auth.user().onDelete(async user => {
    console.log(`Deleting document for user ${user.uid}`)
    await firestore.collection('accounts').doc(user.uid).delete()
    await firestore.collection('kycdb').doc(user.uid).delete()
});

exports.jengaCallback = functions.region('europe-west3').https.onRequest(jengaApi);