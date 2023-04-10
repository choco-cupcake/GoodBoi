# GoodBoi
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/doggo.png?raw=true" alt="Doggo" width="150px"/>
</p>

Scraper of EVM compatible Smart Contracts' verified sources + runner of Slither custom detectors on the SC Database

### Use Cases
- Look for vulnerable patterns made up taking inspirations from smart contracts being audited, or from hacks happened in the wild — low precision and manual filtering. 

- Look for any specific set of contracts due to any research. Different analysis tools other than Slither might be implemented in the future, I'm focusing on Slither first because it enables high expressivity and it's blazing fast.

### Usage
Server:
````
npm run startall
````
Note: Major chains bootstrapping might lead to a ton of calls in the first days. It is thus suggested to avoid starting all the modules together with a new database if number of calls is a concern.


Analysis machine:
````
node services/slitherRunner.js
````

## Architecture
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/Architecture_1.png?raw=true" alt="Architecture Design" width="700px"/>
</p>

### Modules description
##### Block Parser
Parses 'to' addresses from recent blocks. To reduce the RPC calls, an aggregator smart contract has been deployed on each chain. This contract contains a function that gets an array of addresses as input and provides a bool mask as output that tells if each address is a smart contract - EOAs are then discarded.
##### Source Getter
Downloads the source codes from etherscan, bscscan, polygonscan through their APIs.

The recheck feature if enabled, rechecks unverified contracts onve every BLOCK_PARSER_VERIFIED_RECHECK_DAYS days, if they happen again in new blocks. So if a contract gets verified few days after deployment, we won't miss it. It would make sense to stop rechecking after a while, but at the moment the system can handle this volume of calls.

The source code is analyzed to get from the main contract the public state variables of type address, address[], mapping(unitXXX => address) and save them in a JSON on the database. This is used to check for the PoolFlag, see section Notes.AnalysisFlags.
##### Balance Getter
For each contract, gets the native ether balance plus the balance of the top 80 ERC20 tokens, then convert everything to USD and saves the informations on the database. Contracts having an overall usdVal >= FLAGGER_MIN_BALANCE get the BalanceFlag activated. The BalanceFlag will be used to decide which contracts will be analyzed, more in section section Notes.AnalysisFlags.
To reduces the RPC calls, a balances aggregator smart contract is used.

The contract pruning feature allows you to prune contracts according to the rule (0 balance AND lastTx older than X days AND not flagged AND if this contract is an implementation, the same checks apply for the proxy contract). Pruning happens during balance checks.
##### State Variables Reader
This module gets from the blockchain the address value of the public address variables in each contract. The contract GetValueAggregator is used to minimize the RPC calls. This module also launches the PoolFlagger, described later.
Module used to check for the PoolFlag, more in section Notes.AnalysisFlags.
##### Proxy Implementation Reader
This module checks the eip1967 implementation storage slot for contracts having "proxy" in their name or flagged as proxy by etherscan. Proxy and implementation will get tied on the database. It is used to analyze proxy contracts using the implementation code, and to perform PoolFlagging and contract pruning when proxy pattern is used.
##### Pool Flagger
This module activates the PoolFlag if a contract: 
- is an ERC20 with a pool (against WETH)
- contains in a storage variable (or array or uint=>address map) an address which is:
  - an ERC20 with a pool
  - a pool
  
Note: Variables names are blacklisted to ignore irrelevant ones, and mappings names are whitelisted as they are mostly useless.


AMM checked for pools:
- Eth: UniV3, UniV2, PancakeSwapV2, BalancerV2
- BSC: PancakeSwap
- Polygon: UniV3, Quickswap (UniV2), BalancerV2
- Arbitrum: UniV3

Note: Where it is straightforward (UniV2 and UniV2-like), pools are filtered by WETH liquidity to be at least FLAGGER_CONTRACT_MIN_POOL_USD. In the future it would be nice to extend this feature to the other protocols.

##### Slither Runner
Runs slithers instances in parallel and save results on the database. Given a set of detectors to be used, for each contract only the detectors not yet used on that contract are used in the analysis. 

At the moment the analysis module is run spot when needed, but on the long run once I have multiple custom detectors it's meant to be always up looking for hits on the new contracts parsed every day.

##### Analysis Results UI
Still using raw queries while collecting requirements before building

## Configuration
````
.env.example
````

## Notes
#### Analysis Flags - How to choose which contracts to analyze
TODO/WIP

#### PM2
The architecture is modular and PM2 is used to manage the module instances. The modules run independently, but may rely on the results of other modules.

"startall" script runs all the modules with a hygienic restart every few hours/days depending on the module. Note: Major chains bootstrapping might lead in a ton of calls in the first days. It is thus suggested to avoid starting all the modules together with a new database if number of RPC calls is a concern.

#### Save compiled AST instead of source code
Slither compiles the contracts before their analysis, and compilation time can easily be longer than the analysis time. Saving the compiled AST on the database and feeding it to Slither instead of the source code, would speed up subsequent analysis a lot.

Unluckily Slither deprecated the AST input feature years ago.

#### Fail rate
Around 5% overall, not really an issue. Detectors fail (edge cases even if everything seems handled) happpens more often than compilation fail (the same solc version used to verify the source code on etherscan is fed to Slither to use for compilation)

#### Unverified contracts
Verified percentage is around 50% (even higher on Arbitrum) - unique contracts (no same code clones) vs unverified (maybe clones) seen in the same timeframe.
Higher than I originally expected.

#### Scalability 
###### Database Size
With the pruner active, contracts on ETH,BSC,POLY,ARB are slightly more than 1 million. Database size seems totally manageable with a small machine.

###### Slither analysis time
Slither is quite fast and analysis can be scaled on multiple machines or on fat cloud machines. Anyway, flagged contracts at the moment are below 100k, which I can analyze on my laptop while working on it, in under 24 hours (around 100 analysis per minute). 

###### RPC calls rate
Blockchain read calls (balances and scraping) are kept low thanks to the use of aggregator contracts, so the free tier of multiple RPC providers is enough. 
This does not apply for major chains bootstrapping which might lead to a ton of calls in the first days. It is thus suggested to avoid starting all the modules together with a new database if the number of calls is a concern.

###### Source code gathering & verified rechecks
Regarding the source code gathering, the free tier of etherscan/bscscan/polygonscan/arbiscan is enough to do the job. 
They provide 100k calls per day, enough to both get new contracts and re-check old contracts to see if they got verified after some time. The database keeps track of unverified smart contracts, and recheck them only once in X days - if they happen to be again in new blocks.

#### Slither custom detector
Writing Slither custom detectors one should be careful to account for every edge case. A fail of a single detector lets the analysis fail also for the other detectors.
