'use strict';

// Firebase init
 const functions = require('firebase-functions');
 const admin = require('firebase-admin');
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
 const fs = require('fs');
 const moment = require('moment');
 // const { createFirebaseAuth } = require ('./middlewares/express_firebase_auth');
 const { ussdRouter } = require ('ussd-router');

 const app = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));
 const jengaApi = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));
 const ussdcalls = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));
 // var restapi = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }), bearerToken());
 // const savingsacco = express().use(cors({ origin: true }), bodyParser.json(), bodyParser.urlencoded({ extended: true }));



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

// app.use(authenticate);
 // jengaApi.use(authenticate);
 // restapi.use(requireAuth);

const PNF = require('google-libphonenumber').PhoneNumberFormat;
 const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const axios = require("axios");
const jenga = require('./jengakit');
const telosApi = require('./telosApi');
const bezomoneyapi = require('./bezomoneyApi');
const savingsacco = require('./savingsaccoApi');
const restapi = require('./kotaniAdminApi');

// const prettyjson = require('prettyjson');
// var options = { noColor: true };

var randomstring = require("randomstring");
// var tinyURL = require('tinyurl');
var { getTxidUrl, getDeepLinkUrl, getAddressUrl, getPinFromUser, getEncryptKey, createcypher, decryptcypher, sendMessage, sendGmail, emailIsValid, isDobValid, isValidKePhoneNumber } = require('./utilities');

//GLOBAL ENV VARIABLES
const iv = functions.config().env.crypto_iv.key;
const enc_decr_fn = functions.config().env.algo.enc_decr;
const  phone_hash_fn = functions.config().env.algo.msisdn_hash;
const escrowMSISDN = functions.config().env.escrow.msisdn;

//@task imports from celokit

const {  getPublicAddress, generatePrivKey, weiToDecimal, decimaltoWei, sendcUSD, buyCelo, sellCelo, getContractKit,  getLatestBlock, validateWithdrawHash } = require('./celokit');
const { getIcxUsdtPrice } = require('./iconnect');
const { resolve } = require('path');

const kit = getContractKit();

  // GLOBAL VARIABLES
   // let publicAddress = '';
   
   let usdMarketRate = 109.45;
   let cusd2kesRate = 109.45*0.98;  //usdMarketRate - (0.01*usdMarketRate);
   let kesMarketRate = 0.00913659;
   let kes2UsdRate = 0.00895385;  //usdMarketRate + (0.02*usdMarketRate)=1/(109.7 + (0.02*109.7))usdMarketRate
  //  let cusdSellRate = 110;
  //  let cusdBuyRate = 107.5;
   
   // let text = '';
  // var data = [];


// USSD API 
app.post("/", async (req, res) => {
  res.set('Content-Type: text/plain');

  // GLOBAL VARIABLES
   // let senderMSISDN = '';
   // let receiverMSISDN = '';
   // var recipientId = '';
   // var senderId = '';
   // let amount = '';
   // let withdrawId = '';
   // let depositId = '';
   // let escrowId = '';
  let newUserPin = '';
  let confirmUserPin = '';
  let documentType = '';
  let documentNumber = '';
  // let idnumber = '';
  let firstname = '';
  let lastname = '';
  let dateofbirth = '';
  let email = '';

  // const { sessionId, serviceCode, phoneNumber, text } = req.body;
  const { body: { phoneNumber: phoneNumber } } = req;
  const { body: { text: rawText } } = req; 
  const text = ussdRouter(rawText);
  const footer = '\n0: Home 00: Back';
  let msg = '';
  
  let senderMSISDN = phoneNumber.substring(1);
  let senderId = await getSenderId(senderMSISDN);
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
      // newUserPin = data[0];
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
    }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] !== '' && data[5] !== '' && data[6] !== ''  && data[7] !== '' && data[8] == null){ //data[0] !== null && data[0] !== '' && data[1] == null
      email = data[7];

      msg = `CON By accessing this app you agree to the terms and conditions.\nhttps://kotanipay.com/terms.html \nSelect: \n1. Agree. \n2. Disagree`;
      res.send(msg);
    }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] !== '' && data[5] !== '' && data[6] !== ''  && data[7] !== '' && data[8] == '1'){
      newUserPin = data[0];
      confirmUserPin = data[1];
      documentType = data[2];
      documentNumber = data[3];
      firstname = data[4];
      lastname = data[5];
      dateofbirth = data[6];
      email = data[7];
      




      
      let userMSISDN = phoneNumber.substring(1);
      let userId = await getSenderId(userMSISDN);  
      let enc_loginpin = await createcypher(newUserPin, userMSISDN, iv);
      let isvalidEmail = await validEmail(email);
      console.log(isvalidEmail);
      console.log(`User Details=> ${userMSISDN} : ${userId} : ${newUserPin} : ${confirmUserPin} : ${documentType} : ${documentNumber} : ${firstname} : ${lastname} : ${dateofbirth} : ${email} : ${enc_loginpin}`);
      
      if(newUserPin === confirmUserPin && newUserPin.length >= 4 ){
        msg = `END Thank You. \nYour Account Details will be verified shortly`;
        res.send(msg);

        //KYC USER
        // let merchantcode = '9182506466';
        // let countryCode = 'KE';
        // let kycData = {
        //   merchantcode, documentType, documentNumber, firstname, lastname, dateofbirth, countryCode
        // };
        // console.log('KYC DATA:=> ',JSON.stringify(kycData));
        // console.log('ID From Jenga: ',kycData.identity.additionalIdentityDetails[0].documentNumber )
        try{
          let kycdata = {
            "documentType" : documentType,
            "documentNumber" : documentNumber,
            "dateofbirth" : dateofbirth,
            "fullName" : `${firstname} ${lastname}`
          }

          //Update User account and enable
          let updateinfo = await verifyNewUser(userId, email, newUserPin, enc_loginpin, firstname, lastname, documentNumber, dateofbirth, userMSISDN);
          await firestore.collection('hashfiles').doc(userId).set({'enc_pin' : `${enc_loginpin}`}); 

          // console.log('User data updated successfully: \n',JSON.stringify(updateinfo));
          //save KYC data to KYC DB
          let newkycdata = await addUserKycToDB(userId, kycdata);
          await admin.auth().setCustomUserClaims(userId, {verifieduser: true})
          let message2sender = `Welcome to Kotanipay.\nYour account details have been verified.\nDial *483*354# to access the KotaniPay Ecosystem.\nUser PIN: ${newUserPin}`;
          sendMessage("+"+userMSISDN, message2sender);


        }catch(e){console.log('KYC Failed: No data received'+e)}
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
    }else if ( data[0] !== '' && data[1] !== '' && data[2] !== ''  && data[3] !== ''  && data[4] !== '' && data[5] !== '' && data[6] !== ''  && data[7] !== '' && data[8] == '2'){
      msg = `END Accept the terms & conditions to access KotaniPay Services`;
      res.send(msg);
      return;
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
    msg = `CON Select Option`;
    msg += `\n1. Send to PhoneNumber`;
    msg += `\n2. Send to Wallet Address`;
    msg += footer;
    res.send(msg);
  }else if ( data[0] == '1' && data[1] == '1' && data[2] == null) { 
    msg = `CON Enter Recipient`;
    msg += footer;
    res.send(msg);
  } else if ( data[0] == '1' && data[1] == '1' && data[2] !== '' && data[3] == null) {  //  TRANSFER && PHONENUMBER
    msg = `CON Enter Amount to Send:`;
    msg += footer;
    res.send(msg);
      
  } else if ( data[0] == '1' && data[1] == '1' && data[2] !== '' && data[3] !== '' ) {//  TRANSFER && PHONENUMBER && AMOUNT
    senderMSISDN = phoneNumber.substring(1);
    let receiverMSISDN;
    // console.log('sender: ', senderMSISDN);
    try { receiverMSISDN = phoneUtil.format(phoneUtil.parseAndKeepRawInput(`${data[2]}`, 'KE'), PNF.E164) } catch (e) { console.log(e) }

    receiverMSISDN = receiverMSISDN.substring(1);  
    let amount = data[3];
    let cusdAmount = parseFloat(amount);
    cusdAmount = cusdAmount*0.0091;
    let senderId = await getSenderId(senderMSISDN)
    // console.log('senderId: ', senderId);
    let recipientId = await getRecipientId(receiverMSISDN)
    // console.log('recipientId: ', recipientId);

    let recipientstatusresult = await checkIfRecipientExists(recipientId);
    // console.log("Recipient Exists? ",recipientstatusresult);
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

  //Transfer to Address
  else if ( data[0] == '1' && data[1] == '2' && data[2] == '1' && data[3] == null) { 
    msg = `CON Enter Recipients Address`;
    msg += footer;
    res.send(msg);
  } else if ( data[0] == '1' && data[1] == '2' && data[2]!== '' && data[3] == null) {  //  TRANSFER && ADDRESS
    msg = `CON Enter Amount to Send:`;
    msg += footer;
    res.send(msg);
      
  } else if ( data[0] == '1' && data[1] == '2' && data[2] !== '' && data[3] !== '' ) {//  TRANSFER && ADDRESS && AMOUNT
    let senderMSISDN = phoneNumber.substring(1);
    // console.log('sender: ', senderMSISDN);
    //try { receiverMSISDN = phoneUtil.format(phoneUtil.parseAndKeepRawInput(`${data[1]}`, 'KE'), PNF.E164) } catch (e) { console.log(e) }

    let receiverAddress = `${data[1]}`; 
    let amount = data[3];
    let cusdAmount = parseFloat(amount);
    cusdAmount = cusdAmount*0.0091;
    let senderId = await getSenderId(senderMSISDN)
    // console.log('senderId: ', senderId);
    // recipientId = await getRecipientId(receiverMSISDN)
    // console.log('recipientId: ', recipientId);

    // let recipientstatusresult = await checkIfRecipientExists(recipientId);
    // console.log("Recipient Exists? ",recipientstatusresult);
    // if(recipientstatusresult == false){ 
    //   let recipientUserId = await createNewUser(recipientId, receiverMSISDN); 
    //   console.log('New Recipient', recipientUserId);
    // }  
    
    // Retrieve User Blockchain Data
    let senderInfo = await getSenderDetails(senderId);
    // console.log('Sender Info: ', JSON.stringify(senderInfo.data()))
    let senderprivkey = await getSenderPrivateKey(senderInfo.data().seedKey, senderMSISDN, iv)

    // let receiverInfo = await getReceiverDetails(recipientId);
    // while (receiverInfo.data() === undefined || receiverInfo.data() === null || receiverInfo.data() === ''){
    //   await sleep(1000);
    //   receiverInfo = await getReceiverDetails(recipientId);
    //   // console.log('Receiver:', receiverInfo.data());
    // }

    let senderName = '';
    await admin.auth().getUser(senderId).then(user => { senderName = user.displayName; return; }).catch(e => {console.log(e)})  
    console.log('Sender fullName: ', senderName);

    // let receiverName = '';
    // await admin.auth().getUser(recipientId).then(user => { receiverName = user.displayName; return; }).catch(e => {console.log(e)})  
    // console.log('Receiver fullName: ', receiverName);
    // let _receiver = '';
    

    let receipt = await sendcUSD(senderInfo.data().publicAddress, receiverAddress, cusdAmount, senderprivkey);
    if(receipt === 'failed'){
      msg = `END Your transaction has failed due to insufficient balance`;  
      res.send(msg);
      return;
    }

    // if(receiverName==undefined || receiverName==''){_receiver=receiverMSISDN; } else{ _receiver=receiverName;}

    let url = await getTxidUrl(receipt.transactionHash);
    let message2sender = `KES ${amount}  sent to ${receiverAddress}.\nTransaction URL:  ${url}`;
    // let message2receiver = `You have received KES ${amount} from ${senderName}.\nTransaction Link:  ${url}`;
    console.log('tx URL', url);
    msg = `END KES ${amount} sent to ${_receiver}. \nTransaction Details: ${url}`;  
    res.send(msg);

    sendMessage("+"+senderMSISDN, message2sender);
    // sendMessage("+"+receiverMSISDN, message2receiver);        
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
    msg = `CON Enter Amount to Withdraw\nMinimum KES. 10\nMaximum KES. 35,000`;
    msg += footer;
    res.send(msg);
   }else if ( data[0] == '3' && data[1]!== ''  && data[2] == null) { //&& data[1].value <= 10
    msg += `CON Enter your PIN:`;
    msg += footer;
    res.send(msg);
   }else if ( data[0] == '3' && data[1]!== '' && data[2]!== '') {   //  WITHDRAW && AMOUNT && FULLNAME 
    let withdrawMSISDN = phoneNumber.substring(1);  // phoneNumber to send sms notifications
    let kesAmountToReceive = data[1];
    let access_pin =  `${data[2]}`;
    let displayName = '';
    let _kesAmountToReceive = number_format(kesAmountToReceive, 2);
    let withdrawId = await getSenderId(withdrawMSISDN);

    let saved_access_pin;
    try{
      saved_access_pin= await getLoginPin(withdrawId);
      // console.log(`Saved PIN: ${saved_access_pin}`)
    }catch(e){
      console.log(e)
      console.log(`Could not retrieve PIN`)
      saved_access_pin=`000000`
    } 
     
    let _access_pin = await createcypher(access_pin, withdrawMSISDN, iv);

    if(_access_pin === saved_access_pin){
      // let pairId = '3128952f1782f60c1cf95c5c3d13b4dc739f1a0d'
      // let exchangeInfo = await getExchangeRate(pairId);
      // let db_usdMarketRate = exchangeInfo.data().value;
      // console.log(`USD_TO_KES Market Rate: ${db_usdMarketRate}`)
      console.log(`USD_TO_KES Market Rate: 109.5`)

      let senderInfo = await getSenderDetails(withdrawId);
      // TODO: verify that user has enough balance
      let usercusdbalance = await getWithdrawerBalance(senderInfo.data().publicAddress); 
      let userkesbalance = usercusdbalance*usdMarketRate
      console.log(`${withdrawMSISDN} balance: ${usercusdbalance} CUSD`);
      let _kesAmountToEscrow = _kesAmountToReceive*1.02
      let _cusdAmountToEScrow = _kesAmountToEscrow*kesMarketRate; 
      // console.log(`USD_TO_KES Exchange Rate: ${db_usdMarketRate}`);
      console.log(`Amount => to Escrow: ${_cusdAmountToEScrow} CUSD : to User: ${_kesAmountToReceive*kesMarketRate} cusd`);

      if(usercusdbalance > _cusdAmountToEScrow){
        console.log('User Balance is adequate');
        let jengabalance = await jenga.getBalance();
        console.log(`Jenga Balance: KES ${jengabalance.balances[0].amount}`); 
        let jengaFloatAmount = number_format(jengabalance.balances[0].amount, 2)
        console.log(`Amount to receive: ${_kesAmountToReceive} : JengaFloat: ${jengaFloatAmount}`)

        if(parseFloat(_kesAmountToReceive) < parseFloat(jengaFloatAmount) && parseFloat(_kesAmountToReceive) <= 35000){
        // if(parseFloat(_kesAmountToReceive) <= 35000){
          msg = `END Thank you. \nWe're processing your transaction:`;
          res.send(msg);
          console.log(`USSD: Thank you. Were processing your transaction:`);

          await admin.auth().getUser(withdrawId).then(user => { displayName = user.displayName; return; }).catch(e => {console.log(e)}) 
          console.log('Withdrawer fullName: ', displayName, 'withdrawId: ',withdrawId);        
          
          // const escrowMSISDN = functions.config().env.escrow.msisdn;
          let escrowId = await getRecipientId(escrowMSISDN);
          let escrowInfo = await getReceiverDetails(escrowId);

          let senderprivkey = await getSenderPrivateKey(senderInfo.data().seedKey, withdrawMSISDN, iv)
          let txreceipt = await sendcUSD(senderInfo.data().publicAddress, escrowInfo.data().publicAddress, `${_cusdAmountToEScrow}`, senderprivkey);
          console.log(withdrawMSISDN,': withdraw tx receipt: ', JSON.stringify(txreceipt));
          if(txreceipt.transactionHash !== null && txreceipt.transactionHash !== undefined && txreceipt !== 'failed'){
            try {

              console.log('Withdraw tx Hash: ', JSON.stringify(txreceipt.transactionHash));

              let currencyCode = 'KES';
              let countryCode = 'KE';
              let recipientName = `${displayName}`;
              let mobileNumber = '';
              //let withdrawToMpesa;
              try {
                const number = phoneUtil.parseAndKeepRawInput(`${withdrawMSISDN}`, 'KE');
                mobileNumber = '0'+number.getNationalNumber();
              } catch (error) { console.log(error); }
              
              // try{
              let referenceCode = await jenga.generateReferenceCode();
              console.log('Withdrawer MobileNumber', mobileNumber, 'Amount:', kesAmountToReceive, ' refcode: ',referenceCode);
              
              let withdrawToMpesa = await jenga.sendFromJengaToMobileMoney(kesAmountToReceive, referenceCode, currencyCode, countryCode, recipientName, mobileNumber);
              console.log('refcode: ',referenceCode, ' : Sending From Jenga to Mpesa status => ',withdrawToMpesa.status);
              
              if(withdrawToMpesa.status === "SUCCESS"){
                let url = await getTxidUrl(txreceipt.transactionHash);
                let txfees = _kesAmountToEscrow-kesAmountToReceive;
                console.log(`Transaction cost: KES ${number_format(txfees,2)}`);
                let message2receiver = `You have Withdrawn KES ${_kesAmountToReceive} from your Celo Account.\nRef Code: ${referenceCode}\nTransaction URL:  ${url}\nTxn Cost: KES ${number_format(txfees,2)}`;
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
                console.log(`+${withdrawMSISDN} withdrawal of amount ${_kesAmountToReceive} has failed: txhash: ${txreceipt.transactionHash} \n...Attempt #1...Retrying...`);
                console.log('refcode: ',referenceCode, ' : Sending From Jenga to Mpesa fail status => ', JSON.stringify(withdrawToMpesa));
                let failedTxDetails = {
                  "recipientNumber" : `${mobileNumber}`,
                  "recipientName" : `${displayName}`,
                  "referenceCode" : `${referenceCode}`,
                  "amount" : `${_kesAmountToReceive}`,
                  "withdrawId" : withdrawId,
                  "isProcessed" : false,
                  "date" : new Date().toLocaleString()
                }
                await logJengaFailedTransaction(txreceipt.transactionHash, failedTxDetails);
                // let withdrawToMpesaRetry = await jenga.sendFromJengaToMobileMoney(kesAmountToReceive, referenceCode, currencyCode, countryCode, recipientName, mobileNumber);
                // console.log('Jenga Txn Retry Status => ',withdrawToMpesaRetry.status);
                // if(withdrawToMpesaRetry.status === "SUCCESS"){
                //   await updateJengaFailedTransaction(txreceipt.transactionHash, { "isProcessed" : true });
                //   let txfees = _kesAmountToEscrow-kesAmountToReceive;
                //   let url = await getTxidUrl(txreceipt.transactionHash);
                //   console.log(`Transaction cost: KES ${number_format(txfees,2)}`);
                //   let _message2receiver = `You have Withdrawn KES ${_kesAmountToReceive} from your Celo Account.\nRef Code: ${referenceCode}\nTransaction URL:  ${url}\nTxn Cost: KES ${number_format(txfees,2)}`;
                //   sendMessage("+"+withdrawMSISDN, _message2receiver); 
                //   return;
                // }
                console.log(`+${withdrawMSISDN} withdrawal of amount ${_kesAmountToReceive} has failed: txhash: ${txreceipt.transactionHash}`);
                let url = await getTxidUrl(txreceipt.transactionHash);
                let message2receiver = `Unable to process the Withdraw of KES ${_kesAmountToReceive}.\nRef Code: ${referenceCode}\nTransaction URL:  ${url}.\n Contact support to resolve the issue`;
                sendMessage("+"+withdrawMSISDN, message2receiver); 
              }   
            } catch (e) {
              console.log(e)              
            }          
          }else{  
            let message2receiver = `Sorry your Transaction could not be processed. \nTry again later.`;
            sendMessage("+"+withdrawMSISDN, message2receiver);
          }
        }else{
          // console.log(`Withdraw limit exceeded. Max Amount KES: ${jengabalance.balances[0].amount}`)
          console.log(`Withdraw limit exceeded. Max Amount KES: NA`)
          msg = `END Sorry. \nWithdraw limit exceeded.\n Unable to process your request. Try again later`;
          res.send(msg);
        }
      }else{
        msg = `CON You have insufficient funds to withdraw KES: ${_kesAmountToReceive} from your Celo account.\n Max Withdraw amount is KES: ${parseInt(userkesbalance-(0.02*userkesbalance))}`;        //+phoneNumber.substring(1)
        msg += `\nEnter 0 to retry`;
        res.send(msg);
      } 
    }else{
      msg = `CON The PIN you have provided is invalid.`;
      msg += `\nEnter 0 to retry`;
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

async function checkisSaccoUserKyced(userId){
  let docRef = firestore.collection('saccokycdb').doc(userId);
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

async function updateJengaFailedTransaction(txid, txdetails){
  try {
    // let db = firestore.collection('jengaFailedWithdraws').doc(txid);
    // db.get().then( doc => { if(doc.exists()){ db.update(txdetails) }})  
    
    const docRef = firestore.collection('jengaFailedWithdraws').doc(txid);
    const res = await docRef.update(txdetails);

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

//MPESA's CALLBACK API

//JENGA CALLBACK API
jengaApi.post("/", async (req, res) => {
  try{
    let data = req.body

    if(data.bank.transactionType === "C"){
      console.log('Deposit Transaction Details: ',data.transaction.additionalInfo,' Amount: ' ,data.transaction.amount);
      let depositAditionalInfo = data.transaction.additionalInfo;
      let kesAmountDeposited = data.transaction.amount;
      let _kesAmountDeposited = number_format(kesAmountDeposited, 2);
      let _cusdAmountDeposited = _kesAmountDeposited*kesMarketRate;  //@task kesto USD conversion
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
      console.log(`Withdraw tx Details: ${JSON.stringify(data)} referenceId: ${data.transaction.billNumber} : Date: ${data.transaction.date} : Amount: ${data.transaction.orderAmount}`);
      //Release of funds from Escrow
    }

    else{
      console.log('ERROR: ',JSON.stringify(data));
    }

    res.send('Jenga API Callback Successful!');
  }catch(e){
    console.log('This is not a Kotani user account load txn')
    try {
      let data = req.body;
      let _referenceId=data.transaction.billNumber;
      let _date=data.transaction.date;
      let _amount=data.transaction.amount;
      let _info=data.transaction.additionalInfo;

      let depositData = {
        referenceId : _referenceId,
        date : _date,
        amount : _amount,
        info : _info
      }
      let db = firestore.collection('fiatEscrowFunding').doc();
      await db.set(depositData).then(newDoc => {
        console.log("Deposit Data Created:\n", newDoc.id)
        // let initdepohash = await signupDeposit(publicAddress);
        // console.log('Signup Deposit', JSON.stringify(initdepohash));
      });
      
    } catch (err) { console.log(err) }
    res.send('Bank wallet update!');
  }
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
    console.log('User Address => ', userInfo.data().publicAddress, ' : depositId: ', depositId);

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

ussdcalls.post("/", async (req, res) => {
  try{
    let data = req.body
    console.log(JSON.stringify(data));
    res.send('USSD API Successful!');
    return;
  }catch(e){console.log(e)}
});

//USSD APP
async function getAccDetails(userMSISDN){
  // console.log(userMSISDN);
  let userId = await getSenderId(userMSISDN);
  
  let userInfo = await getSenderDetails(userId);  
  let url = await getAddressUrl(`${userInfo.data().publicAddress}`)
  console.log('User Address => ', userInfo.data().publicAddress, ' : Address: ',url);
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
  let decr_seed = await decryptcypher(userInfo.data().seedKey, userMSISDN, iv)
          
  return `END Your Backup Phrase is:\n ${decr_seed}`;
}

function getPinFromUser(){
  return new Promise(resolve => {    
    let loginpin = randomstring.generate({ length: 4, charset: 'numeric' });
    resolve (loginpin);
  });
}

async function addUserKycToDB(userId, kycdata){ 
  try {
    let db = firestore.collection('kycdb').doc(userId);
    let newDoc = await db.set(kycdata);
    console.log("KYC Document Created: ");
    let userInfo = await getReceiverDetails(userId);
    let publicAddress = userInfo.data().publicAddress
    // let initdepohash = await signupDeposit(userInfo.data().publicAddress);
    // console.log('Signup Deposit', JSON.stringify(initdepohash));    
  } catch (e) { console.log(e) }
}

async function addSaccoUserKycToDB(userId, kycdata){ 
  try {
    let db = firestore.collection('saccokycdb').doc(userId);
    db.set(kycdata).then(newDoc => {
      console.log("KYC Document Created:\n", newDoc.id)
      // let initdepohash = await signupDeposit(publicAddress);
      // console.log('Signup Deposit', JSON.stringify(initdepohash));
    });
    
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
    // let initdepohash = await signupDeposit(publicAddress);
    // console.log('Signup Deposit', JSON.stringify(initdepohash));

    const newAccount = {
        'seedKey' : `${enc_seed}`,
        'publicAddress' : `${publicAddress}`
    };
    // ,'userLoginPin' : enc_loginpin

    let db = firestore.collection('accounts').doc(userId);    
    db.set(newAccount).then(newDoc => { console.log("Document Created: ", newDoc.id) })
    
  } catch (err) { console.log('accounts db error: ',err) }

  //return true; 
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

async function getSaccoSenderDetails(senderId){
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

async function getExchangeRate(pairId){
  let db = firestore.collection('exchangeRate').doc(pairId);
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
  return `CON Your Account Balance is:\n Kenya Shillings: ${parseFloat(_cusdbalance*usdMarketRate,2)} \n0:Home 00:Back`;
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
        // Inform user that account is now verified
        let message2sender = `Welcome to Kotanipay.\nYour account details have been verified.\nDial *483*354# to access the KotaniPay Ecosytem.\nUser PIN: ${newUserPin}`;
        sendMessage("+"+userMSISDN, message2sender);
        resolve (userRecord.uid);
      })
      .catch(function(error) {
          console.log('Error updating user:', error);
      });
  });  
}

async function verifyNewSaccoUser(userId, email, newUserPin, password, firstname, lastname, idnumber, dateofbirth, userMSISDN){
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
        admin.auth().setCustomUserClaims(userRecord.uid, {verifieduser: true, saccomember: true })
        //Inform user that account is now verified
        let message2sender = `Welcome to Kotanipay.\nYour account details have been verified.\nDial *483*354# to access the KotaniPay Ecosytem.\nUser PIN: ${newUserPin}`;
        // sendMessage("+"+userMSISDN, message2sender);
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
exports.savingsacco = functions.region('europe-west3').https.onRequest(savingsacco); 
exports.ussdcalls = functions.region('europe-west3').https.onRequest(ussdcalls);
exports.telosApi = functions.region('europe-west3').https.onRequest(telosApi);
exports.bezosusu = functions.region('europe-west3').https.onRequest(bezomoneyapi);