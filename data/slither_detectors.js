const detectors_slither_high = ["arbitrary-send-erc20","incorrect-shift","shadowing-state","arbitrary-send-erc20-permit",
  "arbitrary-send-eth","controlled-array-length","controlled-delegatecall","unchecked-transfer"] // high impact only, to be modified to boost precision

const detectrs_slither_badcode = ["tautology", "write-after-write", "divide-before-multiply", "shadowing-local", "incorrect-unary", "assert-state-change", "boolean-equal", "erc20-indexed", "redundant-statements", "dead-code", "unused-state", "immutable-states", "too-many-digits", "constable-states"]

const custom_detectors = ["unprotected-write"]

module.exports = {custom_detectors, detectors_slither_high, detectrs_slither_badcode}