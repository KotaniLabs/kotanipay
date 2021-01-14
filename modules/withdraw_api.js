'use strict';

// Firebase init
 const functions = require('firebase-functions');
 const admin = require('firebase-admin');
 const serviceAccount = require("./config/serviceAccountKey.json");

 admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: functions.config().env.firebase.db_url;
 });

 const firestore = admin.firestore();
const crypto = require('crypto');
const bip39 = require('bip39-light');

// Express and CORS middleware init
const express = require('express');
 const cors = require('cors');
 const bodyParser = require('body-parser');
 const fs = require('fs');
 const moment = require('moment');
 const { ussdRouter } = require ('ussd-router');

 const app = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));
 const jengaApi = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));
 const ussdcalls = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));
 var restapi = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }), bearerToken());


// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = async (req, res, next) => {
  console.log('Check if request is authorized with Firebase ID token');

  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !(req.cookies && req.cookies.__session)) {
    console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
        'Make sure you authorize your request by providing the following HTTP header:',
        'Authorization: Bearer <Firebase ID Token>',
        'or by passing a "__session" cookie.');
    res.status(403).send('Unauthorized');
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    console.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if(req.cookies) {
    console.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else {
    // No cookie
    res.status(403).send('Unauthorized');
    return;
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    console.log('ID Token correctly decoded', decodedIdToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch (error) {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized');
    return;
  }
};

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

const PNF = require('google-libphonenumber').PhoneNumberFormat;
 const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const axios = require("axios");
const jenga = require('./jengakit');

var randomstring = require("randomstring");
var { getTxidUrl,
      getDeepLinkUrl,
      getAddressUrl,
      getPinFromUser,
      getEncryptKey,
      createcypher,
      decryptcypher,      
      sendMessage,
      sendGmail,
      arraytojson,
      stringToObj,
      parseMsisdn,
      emailIsValid,
      isDobValid,
      isValidKePhoneNumber
} = require('./utilities');

//ENV VARIABLES
const iv = functions.config().env.crypto_iv.key;
 const enc_decr_fn = functions.config().env.algo.enc_decr;
 const  phone_hash_fn = functions.config().env.algo.msisdn_hash;
 const escrowMSISDN = functions.config().env.escrow.msisdn;

//@task imports from celokit

const { transfercGOLD,
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
        buyCelo,
        sellCelo,
        getContractKit,
        getLatestBlock,
        validateWithdrawHash
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
   let usdMarketRate = 108.5;
   let cusd2kesRate = 108.6 - (0.01*108.6);  //usdMarketRate - (0.01*usdMarketRate);
   let kes2UsdRate = 0.0092165;  //usdMarketRate + (0.02*usdMarketRate)=1/(108.6 + (0.02*108.6))usdMarketRate
   let cusdSellRate = 110;
   let cusdBuyRate = 107.5;

// USSD API 
app.post("/", async (req, res) => {
  res.set('Content-Type: text/plain');
  // const { sessionId, serviceCode, phoneNumber, text } = req.body;
  const { body: { phoneNumber: phoneNumber } } = req;
  const { body: { text: rawText } } = req; 
  const text = ussdRouter(rawText);
  const footer = '\n0: Home 00: Back';
  let msg = '';
  
  senderMSISDN = phoneNumber.substring(1);
  senderId = await getSenderId(senderMSISDN);
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
  if(isverified === false){        
    //  && data[0] !== '7' && data[1] !== '4'
    // console.log("User: ", senderId, "is NOT VERIFIED!");
    // msg += `END Verify your account by dialing *483*354*7*4#`;
    
    if ( data[0] == null || data[0] == ''){ //data[0] !== null && data[0] !== '' && data[1] == null

      msg = `CON Welcome to KotaniPay. \nKindly Enter your details to verify your account.\n\nEnter new PIN`;
      res.send(msg);
    }else if ( data[0] !== '' && data[1] == null ){ //data[0] !== null && data[0] !== '' && data[1] == null
      newUserPin = data[0];

      msg = `CON Reenter PIN to confirm`;
      res.send(msg);
    }else if ( data[0] !== '' && data[1] !== ''  && data[2] == null ) {
      confirmUserPin = data[1];

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

      msg = `CON Enter Email Address`;
      res.send(msg);
    }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] !== '' && data[5] !== '' && data[6] !== ''  && data[7] !== ''){ //data[0] !== null && data[0] !== '' && data[1] == null
      email = data[7];
      let userMSISDN = phoneNumber.substring(1);
      let userId = await getSenderId(userMSISDN);  
      let enc_loginpin = await createcypher(newUserPin, userMSISDN, iv);
      let isvalidEmail = await validEmail(email);
      console.log(isvalidEmail);
      console.log(`User Details=>${userId} : ${newUserPin} : ${confirmUserPin} : ${documentType} : ${documentNumber} : ${firstname} : ${lastname} : ${dateofbirth} : ${email} : ${enc_loginpin}`);
      
      if(newUserPin === confirmUserPin && newUserPin.length >= 4 ){
        msg = `END Thank You. \nYour Account Details will be verified shortly`;
        res.send(msg);
        try{
          let kycData = {
            "documentType" : documentType,
            "documentNumber" : documentNumber,
            "dateofbirth" : dateofbirth,
            "fullName" : `${firstname} ${lastname}`
          }

          //Update User account and enable
          let updateinfo = await verifyNewUser(userId, email, newUserPin, enc_loginpin, firstname, lastname, documentNumber, dateofbirth, userMSISDN);
          await firestore.collection('hashfiles').doc(userId).set({'enc_pin' : `${enc_loginpin}`}); 

          let newkycdata = await addUserKycToDB(userId, kycdata);

        }catch(e){console.log('KYC Failed: No data received')}
      }
      else if (newUserPin.length < 4 ){
        console.log('KYC Failed')
        msg = `END PIN Must be atleast 4 characters,\n RETRY again`;
        res.send(msg);
        return;
      }
      else if (newUserPin !== confirmUserPin){
        msg = `END Your access PIN does not match,\n RETRY again`; //${newUserPin}: ${confirmUserPin}
        res.send(msg);
        return;
      }
    }
  }    

  else if (text === '' ) {
    msg = 'CON Welcome to Kotanipay:';
    msg += '\n1: Send Money';
    msg += '\n2: Deposit Funds';
    msg += '\n3: Withdraw Cash';
    msg += '\n4: Savings Sacco';
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
    try { receiverMSISDN = phoneUtil.format(phoneUtil.parseAndKeepRawInput(`${data[1]}`, 'KE'), PNF.E164) } catch (e) { console.log(e) }

    receiverMSISDN = receiverMSISDN.substring(1);  
    amount = data[2];
    let cusdAmount = parseFloat(amount);
    cusdAmount = cusdAmount*0.0092165;
    senderId = await getSenderId(senderMSISDN)
    // console.log('senderId: ', senderId);
    recipientId = await getRecipientId(receiverMSISDN)
    // console.log('recipientId: ', recipientId);

    let recipientstatusresult = await checkIfRecipientExists(recipientId);
    // console.log("Recipient Exists? ",recipientstatusresult);
    if(recipientstatusresult == false){ 
      let recipientUserId = await createNewUser(recipientId, receiverMSISDN); 
      console.log('New Recipient', recipientUserId);
    }  
    
    // Retrieve User Blockchain Data
    let senderInfo = await getSenderDetails(senderId);
    let senderprivkey = await getSenderPrivateKey(senderInfo.data().seedKey, senderMSISDN, iv)

    let receiverInfo = await getReceiverDetails(recipientId);
    while (receiverInfo.data() === undefined || receiverInfo.data() === null || receiverInfo.data() === ''){
      await sleep(1000);
      receiverInfo = await getReceiverDetails(recipientId);
    }

    let senderName = '';
    await admin.auth().getUser(senderId).then(user => { senderName = user.displayName; return; }).catch(e => {console.log(e)})  
    console.log('Sender fullName: ', senderName);

    let receiverName = '';
    await admin.auth().getUser(recipientId).then(user => { receiverName = user.displayName; return; }).catch(e => {console.log(e)})  
    console.log('Receiver fullName: ', receiverName);
    let _receiver = '';
    

    let receipt = await sendcUSD(senderInfo.data().publicAddress, receiverInfo.data().publicAddress, cusdAmount, senderprivkey);
    if(receipt === 'failed'){
      msg = `END Your transaction has failed due to insufficient balance`;  
      res.send(msg);
      return;
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
    msg = 'CON Select currency to deposit:';
    msg += '\n1: M-Pesa';
    msg += '\n2: cUSD';
    msg += footer;
    res.send(msg);
  } else if ( data[0] == '2' && data[1] == 1) {
    // M-PESA DEPOSIT
    msg = `CON Deposit funds through Mpesa \nPaybill: 763766\nAccount Number: 915170 \nor\nEazzyPay\nTill Number: 915170\nYour transaction will be confirmed in approx 5mins.`;
    msg += footer;
    res.send(msg);
  }  else if ( data[0] == '2' && data[1] == 2 && data [2] == null) {
    msg = `CON Enter amount to deposit`;
    msg += footer; 
    res.send(msg); 
  } else if (data[0] == '2' && data[1] == 2 && data [2] !== '') {
    // CUSD DEPOSIT
    msg = `END You will receive a text with a link to deposit cUSD`;
    // msg += footer;
    res.send(msg);

    //Get User Details for Deposit
    const userMSISDN = phoneNumber.substring(1);
    const txamount = data[2]; 
    const userId = await getSenderId(userMSISDN);
    const userInfo = await getSenderDetails(userId);
    let displayName = '';
    await admin.auth().getUser(userId).then(user => { displayName = user.displayName; return; }).catch(e => {console.log(e)}) 
    const address = userInfo.data().publicAddress;
    const deeplink = `celo://wallet/pay?address=${address}&displayName=${displayName}&currencyCode=KES&amount=${txamount}&comment=sending+kes:+${txamount}+to+My+kotani+wallet`;
    let url = await getDeepLinkUrl(deeplink);
    const message = `To deposit cUSD to KotaniPay, \n Address: ${address} \n click this link:\n ${url}`;
    sendMessage("+"+userMSISDN, message);  
  }

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
    let kesAmountToReceive = data[1];
    let access_pin =  `${data[2]}`;
    let displayName = '';
    let _kesAmountToReceive = number_format(kesAmountToReceive, 2);
    withdrawId = await getSenderId(withdrawMSISDN);

    let saved_access_pin = await getLoginPin(withdrawId); 
    let _access_pin = await createcypher(access_pin, withdrawMSISDN, iv);

    if(_access_pin === saved_access_pin){
      let senderInfo = await getSenderDetails(withdrawId);
      // TODO: verify that user has enough balance
      let usercusdbalance = await getWithdrawerBalance(senderInfo.data().publicAddress); 
      let userkesbalance = usercusdbalance*usdMarketRate
      console.log(`${withdrawMSISDN} balance: ${usercusdbalance} CUSD`);
      let _kesAmountToEscrow = _kesAmountToReceive*1.02
      let _cusdAmountToEScrow = _kesAmountToEscrow*kes2UsdRate; 
      console.log(`Amount to Escrow: ${_cusdAmountToEScrow} CUSD`);
      if(usercusdbalance > _cusdAmountToEScrow){
        let jengabalance = await jenga.getBalance();
        let jengaFloatAmount = number_format(jengabalance.balances[0].amount, 2)
        console.log(`To receive: ${_kesAmountToReceive} must be less than JengaFloat of: ${jengaFloatAmount}`)

        if(parseFloat(_kesAmountToReceive) < parseFloat(jengaFloatAmount)){
          msg = `END Thank you. \nWe're processing your transaction:`;
          res.send(msg);

          await admin.auth().getUser(withdrawId).then(user => { displayName = user.displayName; return; }).catch(e => {console.log(e)}) 
          console.log('Withdrawer fullName: ', displayName, 'withdrawId: ',withdrawId);        
          
          // const escrowMSISDN = functions.config().env.escrow.msisdn;
          escrowId = await getRecipientId(escrowMSISDN);
          let escrowInfo = await getReceiverDetails(escrowId);

          let senderprivkey = await getSenderPrivateKey(senderInfo.data().seedKey, withdrawMSISDN, iv)
          let txreceipt = await sendcUSD(senderInfo.data().publicAddress, escrowInfo.data().publicAddress, `${_cusdAmountToEScrow}`, senderprivkey);
          if(txreceipt.transactionHash !== null && txreceipt.transactionHash !== undefined && txreceipt !== 'failed'){
            console.log('Withdraw tx Hash: ', JSON.stringify(txreceipt.transactionHash));

            let currencyCode = 'KES';
            let countryCode = 'KE';
            let recipientName = `${displayName}`;
            let mobileNumber = '';
            try {
              const number = phoneUtil.parseAndKeepRawInput(`${withdrawMSISDN}`, 'KE');
              mobileNumber = '0'+number.getNationalNumber();
            } catch (error) { console.log(error); }
            console.log('Withdrawer MobileNumber', mobileNumber, 'Amount:', kesAmountToReceive);
            // try{
            let referenceCode = await jenga.generateReferenceCode();
            console.log('refcode: ',referenceCode);
            let withdrawToMpesa = await jenga.sendFromJengaToMobileMoney(kesAmountToReceive, referenceCode, currencyCode, countryCode, recipientName, mobileNumber);
            console.log('Sending From Jenga to Mpesa status => ',withdrawToMpesa.status);
            
            if(withdrawToMpesa.status === "SUCCESS"){
              let url = await getTxidUrl(txreceipt.transactionHash);
              let message2receiver = `You have Withdrawn KES ${_kesAmountToReceive} from your Celo Account.\nRef Code: ${referenceCode}\nTransaction URL:  ${url}`;
              sendMessage("+"+withdrawMSISDN, message2receiver); 
              //Log the tx to DB
              let JengaTxDetails = {
                "recipientNumber" : `${mobileNumber}`,
                "recipientName" : `${displayName}`,
                "amount" : `${_kesAmountToReceive}`,
                "referenceCode" : referenceCode,
                "date" : new Date().toLocaleString()
              }
              await logJengaProcessedTransaction(txreceipt.transactionHash, JengaTxDetails);
            } else{
              console.log(`+${withdrawMSISDN} withdrawal of amount ${_kesAmountToReceive} has failed: txhash: ${txreceipt.transactionHash}`)
              let url = await getTxidUrl(txreceipt.transactionHash);
              let message2receiver = `Unable to process the Withdraw of KES ${_kesAmountToReceive}.\nRef Code: ${referenceCode}\nTransaction URL:  ${url}.\n Contact support to resolve the issue`;
              sendMessage("+"+withdrawMSISDN, message2receiver); 
              let failedTxDetails = {
                "recipientNumber" : `${mobileNumber}`,
                "recipientName" : `${displayName}`,
                "amount" : `${_kesAmountToReceive}`,
                "withdrawId" : withdrawId,
                "date" : new Date().toLocaleString()
              }
              await logJengaFailedTransaction(txreceipt.transactionHash, failedTxDetails);
            }           
          }else{  
            let message2receiver = `Sorry your Transaction could not be processed. \nTry again later.`;
            sendMessage("+"+withdrawMSISDN, message2receiver);
          }
        }else{
          console.log(`Withdraw limit exceeded. Max Amount KES: ${jengabalance.balances[0].amount}`)
          msg = `END Sorry. \nWithdraw limit exceeded.\n Unable to process your request. Try again later`;
          res.send(msg);
        }
      }else{
        msg = `CON You have insufficient funds to withdraw KES: ${_kesAmountToReceive} from your Celo account.\n Max Withdraw amount is KES: ${userkesbalance-(0.02*userkesbalance)}`;        //+phoneNumber.substring(1)
        msg += `Enter 0 to retry`;
        res.send(msg);
      } 
    }else{
      msg = `CON The PIN you have provided is invalid.`;
      msg += `Enter 0 to retry`;
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
   }
   
   //CELO TRADING
   else if ( data[0] == '5' && data[1] == '1' && data[2] == null) {
      let userMSISDN = phoneNumber.substring(1);      
      msg = 'CON Choose CELO Option:';
      msg += '\n1: Buy CELO';
      msg += '\n2: Sell CELO';
      msg += footer;    
      res.send(msg);  
   }else if ( data[0] == '5' && data[1] == '1' && data[2] == '1' && data[3] == null) { //Buy Celo
    let userMSISDN = phoneNumber.substring(1); 
    let celoKesPrice = 200;     
    msg = `CON Current CELO price is Ksh. ${celoKesPrice}.\nEnter Ksh Amount to Spend`;    //await getAccDetails(userMSISDN);   
    msg += footer;  
    res.send(msg);   
   }else if ( data[0] == '5' && data[1] == '1' && data[2] == '1' && data[3] !== '') { //Buy Celo
    let userMSISDN = phoneNumber.substring(1); 
    let amount2spend = number_format(data[2],2);
    let celoKesPrice = 200;  
    let celoUnits = amount2spend/celoKesPrice;
    // buyCelo(address, cusdAmount, privatekey)
    msg = `END Purchasing ${number_format(celoUnits,2)} CELO at Ksh. ${celoKesPrice} per Unit `;    //await getAccDetails(userMSISDN);   
    // msg += footer;  
    res.send(msg);   
   }
   
   else if ( data[0] == '5' && data[1] == '1' && data[2] == '2' && data[3] == null) { //Sell Celo
    let userMSISDN = phoneNumber.substring(1); 
    let celoKesPrice = 200;     
    msg = `CON Current CELO price is Ksh. ${celoKesPrice}.\nEnter Ksh Amount to Spend`;    //await getAccDetails(userMSISDN);   
    msg += footer;  
    res.send(msg);   
   }else if ( data[0] == '5' && data[1] == '1' && data[2] == '2' && data[3] !== '') { //Sell Celo
    let userMSISDN = phoneNumber.substring(1); 
    let celoUnits = number_format(data[2],2);
    let celoKesPrice = 200;  
    let amount2receive = celoUnits*celoKesPrice;
    // sellCelo(address, celoAmount, privatekey)   
    msg = `END Selling ${number_format(celoUnits,2)} CELO at Ksh. ${celoKesPrice} per Unit `;    //await getAccDetails(userMSISDN);   
    // msg += footer;  
    res.send(msg);   
   }

  
  //BTC TRADING
  else if ( data[0] == '5'  && data[1] == '2' && data[2] == null) {
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
    msg = `CON Choose account information you want to view`;
    msg += `\n1. Account Details`;
    msg += `\n2. Account balance`;
    msg += `\n3. Account Backup`;
    msg += `\n4. PIN Reset`
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
    // await admin.auth().setCustomUserClaims(userId, {verifieduser: false});
    // await firestore.collection('hashfiles').doc(userId).delete()
    // await firestore.collection('kycdb').doc(userId).delete()
    // Send Email to user:

    try{
      let userEmail = '';
      await admin.auth().getUser(userId).then(user => { userEmail = user.email; return; }).catch(e => {console.log(e)}) 
      console.log('User Email: ', userEmail, 'userId: ',userId); 
      
      let newUserPin = await getPinFromUser();
      let enc_loginpin = await createcypher(newUserPin, userMSISDN, iv);
      await firestore.collection('hashfiles').doc(userId).update({'enc_pin' : `${enc_loginpin}`})  
      const message = `Your KotaniPay PIN has been reset to: ${newUserPin}`;
      const gmailSendOptions = {
        "user": functions.config().env.gmail.user,
        "pass": functions.config().env.gmail.pass,
        "to": userEmail,
        "subject": "KotaniPay PIN"
      }
      sendGmail(gmailSendOptions, message);
      msg = `END Password reset was successful.\n Kindly check ${userEmail} for Details`; 
      res.send(msg);
    }catch(e){
      console.log(`No Email Address`, e);
      msg = `END Password reset failed: You dont have a valid email d`; 
      res.send(msg);
    }
  }
   else{
    msg = `CON Sorry, I dont understand your option`;
    msg += 'SELECT:';
    msg += '\n1: Send Money';
    msg += '\n2: Deposit Funds';
    msg += '\n3: Withdraw Cash';
    msg += '\n4: Savings Sacco';
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


//parameter: {"phoneNumber" : "E.164 number" }
restapi.post('/getbalance', async (req, res) => {   //  validateFirebaseIdToken,
  let userMSISDN = req.body.phoneNumber;
  console.log("Received request for: " + req.url);
  try {
    const recnumber = phoneUtil.parseAndKeepRawInput(`${userMSISDN}`, 'KE');
    userMSISDN = phoneUtil.format(recnumber, PNF.E164);
  } catch (error) {
    console.log(error); 
  }
  userMSISDN = userMSISDN.substring(1);
  let _isValidKePhoneNumber = await isValidKePhoneNumber(userMSISDN);
  console.log('isValidKePhoneNumber ', _isValidKePhoneNumber)

  if(_isValidKePhoneNumber == true){
    let userId  = await getSenderId(userMSISDN)
    console.log('UserId: ', userId)

    let userstatusresult = await checkIfSenderExists(userId);
    console.log("User Exists? ",userstatusresult);
    if(userstatusresult == false){ 
      let userCreated = await createNewUser(userId, userMSISDN);     
      console.log('Created user with userID: ', userCreated); 
    }
    
    let userInfo = await getSenderDetails(userId);
    while (userInfo.data() === undefined || userInfo.data() === null || userInfo.data() === ''){
      await sleep(1000);
      userInfo = await getSenderDetails(userId);
      // console.log('Receiver:', receiverInfo.data());
    }
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
    //TODO: Apply localization to the balance values

    let message = {       
      "Address": `${userInfo.data().publicAddress}`, 
      "Balance": {
        "cusd" : `${await weiToDecimal(cusdBalance)}`, 
        "celo" : `${await weiToDecimal(celoBalance)}`,
      }   
    };

    res.json(message);
  }else{
    let message = { 
      "status" : `error`, 
      "user" : `${req.user.name}` ,    
      "phoneNumber": `${userMSISDN}`, 
      "message": `The number provided is not a valid KE phoneNumber`      
    };
    res.json(message);
  }
});

//parameter: {"phoneNumber" : "E.164 number" }
restapi.post('/transactions', async (req, res) => { 
  let userMSISDN = req.body.phoneNumber;
  console.log("Received request for: " + req.url);
  // let amount = request.body.amount;
  try {
    const recnumber = phoneUtil.parseAndKeepRawInput(`${userMSISDN}`, 'KE');
    userMSISDN = phoneUtil.format(recnumber, PNF.E164);
  } catch (error) {
    console.log(error); 
  }
  userMSISDN = userMSISDN.substring(1);
  let _isValidKePhoneNumber = await isValidKePhoneNumber(userMSISDN);
  console.log('isValidKePhoneNumber ', _isValidKePhoneNumber)

  if(_isValidKePhoneNumber == true){
    let userId  = await getSenderId(userMSISDN)
    console.log('UserId: ', userId)

    let userstatusresult = await checkIfSenderExists(userId);
    console.log("User Exists? ",userstatusresult);
    if(userstatusresult == false){ 
      let userCreated = await createNewUser(userId, userMSISDN);     
      console.log('Created user with userID: ', userCreated);
    }    
    
    let userInfo = await getSenderDetails(userId);
    while (userInfo.data() === undefined || userInfo.data() === null || userInfo.data() === ''){
      await sleep(1000);
      userInfo = await getSenderDetails(userId);
      // console.log('Receiver:', receiverInfo.data());
    }
    console.log('User Address => ', userInfo.data().publicAddress);

    let response  = await axios.get(`https://explorer.celo.org/api?module=account&action=tokentx&address=${userInfo.data().publicAddress}#`)
    // console.log(response.data.result);  

    let message = {       
      "phoneNumber": `${userMSISDN}`, 
      "transactions": response.data.result
    };

    res.json(message);
  }else{
    let message = { 
      "status" : `error`,      
      "phoneNumber": `${userMSISDN}`, 
      "message": `The number provided is not a valid KE phoneNumber`      
    };
    res.json(message);
  } 
});

restapi.post("/getkotanipayescrow", async (req, res) => { 
  console.log("Received request for: " + req.url);
  let escrowId  = await getSenderId(escrowMSISDN);
  let escrowInfo = await getSenderDetails(escrowId);
  console.log('User Address => ', escrowInfo.data().publicAddress);
  let jengabalance = await jenga.getBalance();
  console.log(`Jenga Balance: KES ${jengabalance.balances[0].amount}`); 

  //@task Add CUSD to KES conversion rate:
  let message = {
    "kotanipayEscrowAddress": `0x0e93296c605730b88efaf0b698fb8269d022a590`,
    "conversionRate" : { "cusdToKes" : `${cusd2kesRate}` },
    "maxWithdrawAmount" : `CUSD ${number_format(`${jengabalance.balances[0].amount*kes2UsdRate}`, 2)}`
  };
  res.json(message);
});

//parameters: {"phoneNumber" : "E.164 number" , "amount" : "value", "txhash" : "value"}
restapi.post("/withdraw", async (req, res) => {
  console.log("Received request for: " + req.url);
  let userMSISDN = req.body.phoneNumber;
  let txhash = req.body.txhash;
  try {
    const recnumber = phoneUtil.parseAndKeepRawInput(`${userMSISDN}`, 'KE');
    userMSISDN = phoneUtil.format(recnumber, PNF.E164);
  } catch (error) {console.log(error); }
  userMSISDN = userMSISDN.substring(1);
  
  let _isValidKePhoneNumber = await isValidKePhoneNumber(userMSISDN);
  console.log('isValidKePhoneNumber ', _isValidKePhoneNumber);

  if(_isValidKePhoneNumber == true){
    let userId  = await getSenderId(userMSISDN);
    if(txhash !== null && txhash !==''){
      var txreceipt = await validateCeloTransaction(txhash);
      if(txreceipt !== null){
        console.log('Status: ', txreceipt.status);
        let escrowAddress = `0x0e93296c605730b88efaf0b698fb8269d022a590`;

        let txdetails = await validateWithdrawHash(txhash, escrowAddress);
        // console.log(txdetails)
        if(txdetails.status === "ok"){
          let validblocks = txdetails.txblock;
          let _validblocks = parseInt(validblocks);
          _validblocks = _validblocks + 1440;
          // console.log('Valid Blocks', _validblocks);
          let latestblock = await getLatestBlock();
          let _latestblock = parseInt(latestblock.number);
          if(txreceipt.status === true && _validblocks >= _latestblock ){
            console.log('Processing MPESA withdraw Transaction')
            try{
              let userExists = await checkIfSenderExists(userId);
              if(userExists === false){         
                let userCreated = await createNewUser(userId, userMSISDN);     
                console.log('Created user with userID: ', userCreated); 
              }
              let isverified = await checkIfUserisVerified(userId);   
              console.log('isverified: ', isverified);
              if(isverified === false){
                res.json({
                  "status": 'unverified',
                  "message": "user account is not verified",
                  "comment" : "Access https://europe-west3-kotanimac.cloudfunctions.net/restapi/kyc to verify your account"
                })    
              }else{
                let isProcessed = await getProcessedTransaction(txhash);
                console.log('isProcessed: ', isProcessed) 
                if(isProcessed === true){
                  let message = {
                    "status": `failed`,
                    "message": `Transaction Hash is already processed`
                  };
                  res.json(message);

                }else{
                  let withdrawDetails = {
                    "blockNumber" : txdetails.txblock,
                    "value" : `${txdetails.value} CUSD`,
                    "from" : txdetails.from,
                    "to" : txdetails.to,
                    "date" : new Date().toLocaleString()
                  }
                  let _cusdAmount = number_format(txdetails.value, 4)
                  let cusdWithdrawRate = usdMarketRate*0.98;
                  let kesAmountToReceive =  _cusdAmount*cusdWithdrawRate;
                  kesAmountToReceive = number_format(kesAmountToReceive, 0)
                  console.log(`Withdraw Amount KES: ${kesAmountToReceive}`);
                  let jengabalance = await jenga.getBalance();
                  console.log(`Jenga Balance: KES ${jengabalance.balances[0].amount}`);                

                  if(jengabalance.balances[0].amount>kesAmountToReceive){
                    console.log(txhash, ' Transaction hash is valid...processing payout')
                    let jengaResponse = await processApiWithdraw(userMSISDN, kesAmountToReceive, txhash);
                    console.log(jengaResponse);
                    await setProcessedTransaction(txhash, withdrawDetails)
                    console.log(txhash, ' Transaction processing successful')
                    res.json({
                      "status" : "successful",
                      "Message" : "Withdraw Transaction processing successful",
                      "cusdDetails" : withdrawDetails,
                      "MpesaDetails" : jengaResponse
                    });
                  }else{
                    let message = {
                      "status": `failed`,
                      "message": `Not enough fiat balance to fulfill the request`,
                      "details" : `Contact support to reverse your tx: ${txhash}`
                    };
                    res.json(message);
                  }
                }  
              }
            }catch(e){console.log(e)}
          }else{
            let message = {
              "status": `failed`,
              "message": `Invalid Transaction`,
              "blockNumber" : txdetails.txblock,
              "latestBlock" : _latestblock
            };
            console.log('txdetails.status: ', JSON.stringify(txdetails))
            res.json(message);
          }
        }else{
          let message = {
            "status": `failed`,
            "message" : `Invalid Hash`,
            "comment" : `${txdetails.status}`
          };
          res.json(message);
        }
      }else{
        let message = {
          "status": `failed`,
          "message": `Invalid Transaction Receipt`,
          "comment": `Only transactions to the Escrow address can be processed`
        };
        res.json(message);
      }
    }else{  
      let message = {
        "status": `failed`,
        "description": `Invalid Hash`,
        "comment" : `Transaction hash cannot be empty`
      };
      res.json(message);
    }
  }else{
    let message = { 
      "status" : `error`,      
      "phoneNumber": `${userMSISDN}`, 
      "message": `The number provided is not a valid KE phoneNumber`      
    };
    res.json(message);
  }
});

//parameters: {celloAddress, phoneNumber, amount} 
restapi.post("/getWithdrawTransactionStatus", async (req, res) => { 
  let requestId = req.body.requestId;
  let requestDate = req.body.requestDate;
  let status = await jenga.getTransactionStatus(requestId, requestDate);
  res.json(status);
});

const verifyToken = (req, res, next) => {
  // Get auth header value
  const bearerHeader = req.headers['authorization'];
  // Check if bearer is undefined
  if(typeof bearerHeader !== 'undefined') {
    // Split at the space
    const bearer = bearerHeader.split(' ');
    // Get token from array
    const bearerToken = bearer[1];
    // Set the token
    req.token = bearerToken;
    // Next middleware
    next();
  } else {
    // Forbidden
    res.sendStatus(403);
  }
}

const sendcusdApi = async(senderMSISDN, receiverMSISDN, cusdAmount) => {
  senderId = await getSenderId(senderMSISDN)
  // console.log('senderId: ', senderId);
  let isverified = await checkIfUserisVerified(senderId);   
  // console.log('isverified: ', isverified);
  if(isverified === false){
    return {
      "status": 'error',
      "desc": "user account is not verified"
    }   
  }else{
    recipientId = await getRecipientId(receiverMSISDN);
    let recipientstatusresult = await checkIfRecipientExists(recipientId);
    // console.log("Recipient Exists? ",recipientstatusresult);
    if(recipientstatusresult == false){
        // let recipientUserId = await createNewUser(recipientId, receiverMSISDN); 
        // console.log('New Recipient', recipientUserId);
        let message = { 
            "status" : `error`, 
            "desc" : `recipient does not exist`      
        };
        return message;
    }else{  
        // Retrieve User Blockchain Data
        const senderInfo = await getSenderDetails(senderId);
        // console.log('Sender Info: ', JSON.stringify(senderInfo.data()))
        let senderprivkey = await getSenderPrivateKey(senderInfo.data().seedKey, senderMSISDN, iv)

        let receiverInfo = await getReceiverDetails(recipientId);
        while (receiverInfo.data() === undefined || receiverInfo.data() === null || receiverInfo.data() === ''){
            await sleep(1000);
            receiverInfo = await getReceiverDetails(recipientId);
            // console.log('Receiver:', receiverInfo.data());
        }

        let senderName = '';
        await admin.auth().getUser(senderId).then(user => { senderName = user.displayName; return; }).catch(e => {console.log(e)})  
        console.log('Sender fullName: ', senderName);

        let receiverName = '';
        await admin.auth().getUser(recipientId).then(user => { receiverName = user.displayName;  return; }).catch(e => {console.log(e)})  

        console.log('Receiver fullName: ', receiverName);
        let _receiver = '';

        // TODO: Verify User has sufficient balance to send 
        const cusdtoken = await kit.contracts.getStableToken();
        let userbalance = await weiToDecimal(await cusdtoken.balanceOf(senderInfo.data().publicAddress)) // In cUSD
        let _userbalance = number_format(userbalance, 4)
        
        if(userbalance < cusdAmount){
            let message = {
                "status": `failed`,
                "desc": `Not enough funds to fulfill the request`,
            };
            return message;
        }
        else{
            let receipt = await sendcUSD(senderInfo.data().publicAddress, receiverInfo.data().publicAddress, `${cusdAmount}`, senderprivkey);
            if(receipt === 'failed'){
                let message = { 
                    "status" : `error`, 
                    "desc" : `Your transaction has failed due to insufficient balance`      
                };
                return message;
            }else{
                if(receiverName==undefined || receiverName==''){_receiver=receiverMSISDN; } else{ _receiver=receiverName;}
                // let url = await getTxidUrl(receipt.transactionHash);
                // let message2sender = `KES ${amount}  sent to ${_receiver}.\nTransaction URL:  ${url}`;
                // let message2receiver = `You have received KES ${amount} from ${senderName}.\nTransaction Link:  ${url}`;
                // console.log('tx URL', url);
                // msg = `END KES ${amount} sent to ${_receiver}. \nTransaction Details: ${url}`;  
                // res.send(msg);
                let message = { 
                    "status" : `success`, 
                    "desc" : `${cusdAmount} CUSD  sent to ${_receiver}`,
                    "txid" :  receipt.transactionHash     
                };
                return message;
            }
        }
    }
  }
}

async function validateCeloTransaction(txhash){    
  var receipt = await kit.web3.eth.getTransactionReceipt(txhash)
  // .then(console.log);
  return receipt;
}

async function processApiWithdraw(withdrawMSISDN, amount, txhash){
    // let withdrawMSISDN = phoneNumber.substring(1); 
    console.log('Amount to Withdraw: KES.', amount);
    amount = await number_format(amount, 0);
    console.log('Rounded Amount to Withdraw: KES.', amount);
    let displayName = '';
    withdrawId = await getSenderId(withdrawMSISDN);
    // console.log('withdrawId: ', withdrawId);    
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
    let referenceCode = await jenga.generateReferenceCode();
    console.log(`Ref Code: ${referenceCode}`);
    let withdrawToMpesa = await jenga.sendFromJengaToMobileMoney(amount, referenceCode, currencyCode, countryCode, recipientName, mobileNumber);
    console.log('Sending From Jenga to Mpesa Status => ', JSON.stringify(withdrawToMpesa.status));

    let url = await getTxidUrl(txhash);
    let message2receiver = `You have Withdrawn KES ${amount} to your Mpesa account.\nRef Code: ${referenceCode}\nTransaction URL:  ${url}`;

    // jenga.sendFromJengaToMobileMoney(data[1], 'KES', 'KE',`${fullname}`, withdrawMSISDN) 
    // let message2receiver = `You have Withdrawn KES ${number_format(amount,2)} to your Mpesa account.`;
    sendMessage("+"+withdrawMSISDN, message2receiver);  

    let message = {
      "status": `success`,
      "recipientName": displayName,
      "message": `Withdraw via Kotanipay successful`,
      "recipient": `${withdrawMSISDN}`,
      "amount": `${amount} KES`,
      "referenceCode" : `${referenceCode}`
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
    console.log('Document data:', JSON.stringify(doc.data()));
  }
  return processed;
}

async function setProcessedTransaction(txhash, txdetails){
  try {
    let db = firestore.collection('processedtxns').doc(txhash);
    db.set(txdetails).then(newDoc => {console.log("Transaction processed: => ", newDoc.id)})
    
  } catch (err) { console.log(err) }
}

async function logJengaProcessedTransaction(txid, txdetails){
  try {
    let db = firestore.collection('jengaWithdrawTxns').doc(txid);
    db.set(txdetails).then(newDoc => {console.log("Jenga Transaction processed")})
    
  } catch (err) { console.log(err) }
}

async function logJengaFailedTransaction(txid, txdetails){
  try {
    let db = firestore.collection('jengaFailedWithdraws').doc(txid);
    db.set(txdetails).then(newDoc => {console.log("Jenga Failed Transaction logged: => ", newDoc.id)})
    
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
  if(isverified === false){ 
    res.json({
      "status": 'unverified',
      "message": "user account is not verified",
      "comment" : "Access"
    })    
  }    
}


//JENGA CALLBACK API
jengaApi.post("/", async (req, res) => {
  let data = req.body

  if(data.bank.transactionType === "C"){
    console.log('Deposit Transaction Details: ',data.transaction.additionalInfo,' Amount: ' ,data.transaction.amount);
    let depositAditionalInfo = data.transaction.additionalInfo;
    let kesAmountDeposited = data.transaction.amount;
    let _kesAmountDeposited = number_format(kesAmountDeposited, 2);
    let _cusdAmountDeposited = _kesAmountDeposited*kes2UsdRate;  //@task kesto USD conversion
    let cusdAmountCredited = _cusdAmountDeposited*0.98;

    var depositDetails = depositAditionalInfo.split('/');
    //console.log('Depositor PhoneNumber: ',depositDetails[1]);
    let depositMSISDN = depositDetails[1];

    //DEPOSIT VIA EQUITY PAYBILL or TILL NUMBER
    const escrowMSISDN = functions.config().env.escrow.msisdn;
    const escrowId = await getRecipientId(escrowMSISDN);  
    const depositId = await getSenderId(depositMSISDN)

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

    let receipt = await sendcUSD(escrowInfo.data().publicAddress, depositInfo.data().publicAddress, `${cusdAmountCredited}`, escrowprivkey);
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
  // console.log(JSON.stringify(data));
  console.log('Transaction Details: \nTx Info: ',data.transaction.additionalInfo);  
  let depositAditionalInfo = data.transaction.additionalInfo;
  let amount = data.transaction.amount;

  var depositDetails = depositAditionalInfo.split('/');
  console.log('Depositor PhoneNumber: ',depositDetails[1]);
  let depositMSISDN = depositDetails[1];

  let _isValidKePhoneNumber = await isValidKePhoneNumber(depositMSISDN);
  console.log('isValidKePhoneNumber ', _isValidKePhoneNumber)

  if(_isValidKePhoneNumber == true){
    //DEPOSIT VIA EQUITY PAYBILL or TILL NUMBER
    const escrowMSISDN = functions.config().env.escrow.msisdn;
    escrowId = await getRecipientId(escrowMSISDN);
    console.log('escrowId: ', escrowId);
    
    depositId = await getSenderId(depositMSISDN);

    //@task check that the depositor account exists
    let userstatusresult = await checkIfSenderExists(depositId);
    console.log("User Exists? ",userstatusresult);
    if(userstatusresult == false){ 
      let userCreated = await createNewUser(depositId, depositMSISDN);     
      console.log('Created user with userID: ', userCreated);
    } 
    let userInfo = await getSenderDetails(userId);
    while (userInfo.data() === undefined || userInfo.data() === null || userInfo.data() === ''){
      await sleep(1000);
      userInfo = await getSenderDetails(userId);
      // console.log('Receiver:', receiverInfo.data());
    }
    console.log('User Address => ', userInfo.data().publicAddress);
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
    let escrowInfo = await getReceiverDetails(escrowId);
    let escrowprivkey = await getSenderPrivateKey(escrowInfo.data().seedKey, escrowMSISDN, iv);
    let cusdAmount = number_format(amount, 4);
    cusdAmount = cusdAmount*usdMarketRate;
    console.log(`CUSD deposit amount: ${cusdAmount}`);

    

    let receipt = await sendcUSD(escrowInfo.data().publicAddress, depositInfo.data().publicAddress, `${cusdAmount}`, escrowprivkey);
    let url = await getTxidUrl(receipt.transactionHash);
    let message2depositor = `You have deposited KES ${amount} to your Celo Account.\nReference: ${data.transaction.billNumber}\nTransaction Link:  ${url}`;
    console.log('tx URL', url);
    sendMessage("+"+depositMSISDN, message2depositor);
    res.send('Jenga API Callback Successful!');
  }else{
    console.log('Unable to process Jenga Deposit trx: ', depositAditionalInfo);
  }
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

async function addUserKycToDB(userId, kycdata){ 
  try {
    let db = firestore.collection('kycdb').doc(userId);
    let newDoc = await db.set(kycdata)
    console.log("KYC Document Created: ")
    // .then(newDoc => { console.log("KYC Document Created:\n", newDoc.id)})
    let userInfo = await getReceiverDetails(userId);
    // let publicAddress = userInfo.data().publicAddress
    let initdepohash = await signupDeposit(userInfo.data().publicAddress);
    console.log('Signup Deposit', JSON.stringify(initdepohash));    
  } catch (e) { console.log(e) }
}

  
async function addUserDataToDB(userId, userMSISDN){ 
  try {    
    let mnemonic = await bip39.generateMnemonic(256);
    var enc_seed = await createcypher(mnemonic, userMSISDN, iv);
    let publicAddress = await getPublicAddress(mnemonic);
    console.log('Public Address: ', publicAddress);

    const newAccount = {
        'seedKey' : `${enc_seed}`,
        'publicAddress' : `${publicAddress}`
    };

    let db = firestore.collection('accounts').doc(userId);    
    db.set(newAccount).then(newDoc => { console.log("Document Created: ", newDoc.id) })
    
  } catch (err) { console.log('accounts db error: ',err) }
}

async function signupDeposit(publicAddress){
  const escrowMSISDN = functions.config().env.escrow.msisdn;
  let escrowId = await getSenderId(escrowMSISDN);
  let escrowInfo = await getSenderDetails(escrowId);
  let escrowPrivkey = await getSenderPrivateKey(escrowInfo.data().seedKey, escrowMSISDN, iv);

  let receipt = await sendcUSD(escrowInfo.data().publicAddress, publicAddress, '0.01', escrowPrivkey);  
  // let celohash = await sendcGold(escrowInfo.data().publicAddress, publicAddress, '0.001', escrowPrivkey);
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
  // console.info(`Account balance of ${_cusdbalance} CUSD`);
  _cusdbalance = number_format(_cusdbalance, 4)
  return _cusdbalance;
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
  _cusdbalance = number_format(_cusdbalance, 4);
  const celotoken = await kit.contracts.getGoldToken();
  let celobalance = await celotoken.balanceOf(userInfo.data().publicAddress); // In cGLD
  let _celobalance = await weiToDecimal(celobalance);
  //cGoldBalance = kit.web3.utils.fromWei(celoBalance.toString(), 'ether');    
  console.info(`Account balance of ${_celobalance} CELO`);
  return `CON Your Account Balance is:\n Kenya Shillings: ${_cusdbalance*usdMarketRate} \n0:Home 00:Back`;
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
              // console.log(userRecord.customClaims['verifieduser']);
              isVerified = true;
              resolve (isVerified);
          } else {
            // console.log("User: ", userId, "is NOT VERIFIED!:\n");
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

// Validates email address of course.
function validEmail(e) {
  var filter = /^\s*[\w\-\+_]+(\.[\w\-\+_]+)*\@[\w\-\+_]+\.[\w\-\+_]+(\.[\w\-\+_]+)*\s*$/;
  return String(e).search (filter) != -1;
}

async function checkIfUserExists(userId){
  var exists;         
  return new Promise(resolve => {
    admin.auth().getUser(userId)
      .then(function(userRecord) {          
        if (userRecord) {
            // console.log('Successfully fetched user data:', userRecord.uid);
            exists = true;
            resolve (exists);
        } else {
          // console.log("Document", userId, "does not exists:\n");
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

async function verifyNewUser(userId, email, newUserPin, password, firstname, lastname, idnumber, dateofbirth, userMSISDN){
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
        //Inform user that account is now verified
        let message2sender = `Welcome to Kotanipay.\nYour account details have been verified.\nDial *483*354# to access the KotaniPay Ecosytem.\nUser PIN: ${newUserPin}`;
        sendMessage("+"+userMSISDN, message2sender);
        resolve (userRecord.uid);
      })
      .catch(function(error) {
          console.log('Error updating user:', error);
      });
  });  
}

exports.kotanipay = functions.region('europe-west3').https.onRequest(app);
