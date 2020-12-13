const SavingSacco = artifacts.require("SavingSacco");

module.exports = function (deployer) {
  deployer.deploy(SavingSacco);
};
