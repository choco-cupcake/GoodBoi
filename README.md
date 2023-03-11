# GoodBoi
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/doggo.png?raw=true" alt="Doggo" width="150px"/>
</p>

Scraper of EVM compatible Smart Contracts' verified sources + runner of Slither custom detectors on the SC Database

### Use Cases
Look for vulnerable patterns made up taking inspirations from smart contracts being audited, or from hacks happened in the wild - low precision + manual filtering. 

Look for any specific set of contract due to any research. Different analysis tools other than Slither might be implemented in the future, I'm focusing on Slither first because it enables high expressivity and it's blazing fast.

### Usage
Server:
````
npm run startall
````
Analysis machine:
````
node services/slitherRunner.js
````

## Architecture
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/Architecture_1.png?raw=true" alt="Architecture Design" width="700px"/>
</p>

## Modules description
##### Block Parser
Parse 'to' addresses from recent blocks using RPC endpoints. To reduce the RPC calls, a smart contract hs been deployed on each chain. This contract contains a function that gets an array of addresses as input and provides a bool mask as output that tells if each address is a smart contract - EOAs are then discarded.
##### Source Getter
Download the source codes from etherscan, bscscan, polygonscan through their APIs
##### Balance Getter
For each contract, gets the native ether balance plus the balance of the top 80 ERC20 tokens, then convert everything to USD and saves the informations on the database. To reduces the RPC calls this smart contract is used: 0xb1f8e55c7f64d203c1400b9d8555d050f94adf39
##### Slither Runner
Runs slithers instances in parallel and collects results

### Configuration
````
.env.example
````

## Open Issues

#### L2s
Blocks too fast to scrape with the current framework, need a sort of aggregator. 

arbiscan.io and optimistic.etherscan.io only provide TX batches through UI, not API

## Not really issues

#### Compilation fail rate
Around 5%, not really an issue 

#### Unverified contracts
Verified percentage is around 50% - unique contracts (no same code clones) vs unverified (maybe clones) seen in the same timeframe. 
Higher than I originally expected.

#### Scalability 
A contract pruner with the rule (currently) "0 balance and unactive for 45 days" has been activated after 3 months. Gathered contracts dropped from 1500k to 750k, database size seems totally manageable with a small machine.

Slither is quite fast and analysis can be scaled on multiple machines or on fat cloud machines. Anyway, contracts with usd balance above 1k are just 35k, which I can analyze on my laptop while working on it, in under 6 hours (100 analysis per minute). Even if L2s and other chains were implemented, analysis time would still be manageable.
I planned to let goodboi save the compiled AST to the database, so that slither wont need to compile the solidity source code at every analysis of the same contract, but the analysis time turned so low that I postponed the task, not needed atm.

Blockchain read calls (balances and scraping) are kept low thanks to the use of aggregator contracts, so the free tier of Infura is enough.

The free tier of etherscan/bscscan/polygonscan is enough to do the job. Calls are minimized by keeping track of unverified smart contracts in the database, and recheck them only once in env.BLOCK_PARSER_VERIFIED_RECHECK_DAYS days.

#### Slither custom detector
Writing Slither custom detectors one should be careful to account for every edge case. A fail of a single detector lets the analysis fail also for the other detectors.
