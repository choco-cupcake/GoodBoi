const detectors_slither_high = ["arbitrary-send-erc20","incorrect-shift","shadowing-state","arbitrary-send-erc20-permit",
  "arbitrary-send-eth","controlled-array-length","controlled-delegatecall","reentrancy-eth","unchecked-transfer"] // high impact only, to be modified to boost precision
const custom_detectors = ["public-mint"]

module.exports = {custom_detectors, detectors_slither_high}