const IconService = require('icon-sdk-js');
const httpProvider = new IconService.HttpProvider('https://ctz.solidwallet.io/api/v3');
const iconService = new IconService(httpProvider);
const axios = require("axios");

const getIcxUsdtPrice = async () => {
    let res = await axios({
      method: 'get',
      url: 'https://api.binance.com/api/v3/ticker/price'
    });
    for(var i = 0; i < res.data.length; i++){
        if(res.data[i].symbol == 'ICXUSDT')
        {
            let token = {"symbol" : `${res.data[i].symbol}`, "price": `${res.data[i].price}`}
            console.log(token)
            return token;
        }
    }
    // return res.data;
};

// (async()=>{
//     //const totalSupply = await iconService.getTotalSupply().execute();
//     //console.log(`${totalSupply}`);

//     let icxprice = await getIcxUsdtPrice();
//     // const output = tokens.map(tokens => tokens.price);
//     // console.log(output);
//     console.log('Todays ICX Price=> ',icxprice);
  
// })();



module.exports = { 
    getIcxUsdtPrice
}

