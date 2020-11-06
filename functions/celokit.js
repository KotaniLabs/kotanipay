var tinyURL = require('tinyurl');
const functions = require('firebase-functions');
const bodyParser = require('body-parser');
const moment = require('moment');

const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

// const prettyjson = require('prettyjson');
// var options = { noColor: true };
const randomstring = require('randomstring')

// AFRICASTALKING API
const AT_credentials = {
    apiKey: functions.config().env.at_api.key,
    username: functions.config().env.at_api.usename
}

const AfricasTalking = require('africastalking')(AT_credentials);
const sms = AfricasTalking.SMS;


//SEND GET shortURL
async function getTxidUrl(txid){
    return await getSentTxidUrl(txid);
}

function getSentTxidUrl(txid){      
    return new Promise(resolve => {    
        const sourceURL = `https://explorer.celo.org/tx/${txid}/token_transfers`;
        resolve (tinyURL.shorten(sourceURL))        
    });
}

function getDeepLinkUrl(deeplink){      
  return new Promise(resolve => {    
      const sourceURL = deeplink;
      resolve (tinyURL.shorten(sourceURL))        
  });
}
 
 //GET ACCOUNT ADDRESS shortURL
 async function getAddressUrl(userAddress){
     return await getUserAddressUrl(userAddress);
 }
 
function getUserAddressUrl(userAddress){
  return new Promise(resolve => {    
      const sourceURL = `https://explorer.celo.org/address/${userAddress}/tokens`;
      resolve (tinyURL.shorten(sourceURL));
    });   
}

 function getPinFromUser(){
    return new Promise(resolve => {    
      let loginpin = randomstring.generate({ length: 4, charset: 'numeric' });
      resolve (loginpin);
    });
}

function getEncryptKey(userMSISDN){    
  const crypto = require('crypto');
  const hash_fn = functions.config().env.algo.key_hash;
  //console.log('Hash Fn',hash_fn);
  let key = crypto.createHash(hash_fn).update(userMSISDN).digest('hex');
  return key;
}

async function createcypher(text, userMSISDN, iv){
  const crypto = require('crypto');
  //console.log('cypher Phonenumber', userMSISDN);
  let key = await getEncryptKey(userMSISDN);
  const cipher = crypto.createCipher('aes192',  key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  //console.log(encrypted);
  return encrypted; 
}
  
async function decryptcypher(encrypted, userMSISDN, iv){    
  const crypto = require('crypto');
  let key = await getEncryptKey(userMSISDN);
  //console.log('Decrypt key', key);
  //console.log('IV', iv);
  // const encrypted = cyphertext;

  const decipher = crypto.createDecipher('aes192', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  // console.log(decrypted);
  return decrypted;
}

  // FUNCTIONS
function sendMessage(to, message) {
    const params = {
        to: [to],
        message: message,
        from: 'KotaniPay'
    }  
    // console.log('Sending sms to user')
    sms.send(params)
        .then(msg=>console.log(JSON.stringify('Sending sms to user: ', to)))
        .catch(console.log);
}

function arraytojson(item, index, arr) {
  //arr[index] = item.split('=').join('": "');
  arr[index] = item.replace(/=/g, '": "');
  //var jsonStr2 = '{"' + str.replace(/ /g, '", "').replace(/=/g, '": "') + '"}';
}

function stringToObj (string) {
  var obj = {}; 
  var stringArray = string.split('&'); 
  for(var i = 0; i < stringArray.length; i++){ 
    var kvp = stringArray[i].split('=');
    if(kvp[1]){
      obj[kvp[0]] = kvp[1] 
    }
  }
  return obj;
}

function parseMsisdn(userMSISDN){
  try {
      e64phoneNumber = parsePhoneNumber(`${userMSISDN}`, 'KE')  
      console.log(e64phoneNumber.number)    
  } catch (error) {
      if (error instanceof ParseError) {
          // Not a phone number, non-existent country, etc.
          console.log(error.message)
      } else {
          throw error
      }
  }
  return e64phoneNumber.number;    
}

function emailIsValid (email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isDobValid(dateofbirth){
  var m = moment(dateofbirth, 'YYYY-MM-DD', true);
  return m.isValid();
}


function isValidKePhoneNumber(phoneNumber){
  // let phone = '082 067 0789 ';
  // let receiverMSISDN = parseMsisdn(data).substring(1)
  // console.log('E64 Number: ', receiverMSISDN)
  const _phone = phoneUtil.parseAndKeepRawInput(phoneNumber, 'KE');
  let isValidKe = phoneUtil.isValidNumber(_phone);
  //phone = phone.replaceAll("[^0-9]", "");
  // console.log(isValidKe)
  return isValidKe;
}

module.exports = { 
    getTxidUrl,
    getDeepLinkUrl,
    getAddressUrl,
    getPinFromUser,
    getEncryptKey,
    createcypher,
    decryptcypher,
    sendMessage,
    arraytojson,
    stringToObj,
    parseMsisdn,
    emailIsValid,
    isDobValid,
    isValidKePhoneNumber
}