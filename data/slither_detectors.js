const detectors_slither_high = ["arbitrary-send-erc20","incorrect-shift","shadowing-state","arbitrary-send-erc20-permit",
  "arbitrary-send-eth","controlled-array-length","controlled-delegatecall","unchecked-transfer"] // high impact only, to be modified to boost precision

const detectrs_slither_badcode = ["tautology", "write-after-write", "divide-before-multiply", "shadowing-local", "incorrect-unary", "assert-state-change", "boolean-equal", "erc20-indexed", "redundant-statements", "dead-code", "unused-state", "immutable-states", "too-many-digits", "constable-states"]

const custom_detectors = ["unprotected-write", "requires-in-loop", "load-not-store", "for-continue-increment", "malleable-signature", "withdraw-balanceof-dependant"]

const pessimistic = ['pess-before-token-transfer', 'pess-call-forward-to-protected', 'pess-double-entry-token-alert', 'pess-dubious-typecast', 'pess-event-setter', 'pess-only-eoa-check', 'pess-inconsistent-nonreentrant', 'pess-magic-number', 'pess-multiple-storage-read', 'pess-nft-approve-warning', 'pess-readonly-reentrancy', 'pess-strange-setter', 'pess-timelock-controller', 'pess-token-fallback', 'pess-tx-gasprice', 'pess-uni-v2', 'pess-unprotected-initialize', 'pess-unprotected-setter']

module.exports = custom_detectors.concat(pessimistic)