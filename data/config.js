const config = {
  slitherAnalysis: {
    slitherInstances: 10
  },
  mysqlBackup: {
    backupHours: 72,
    AWSBucketName: "goodboi-backup",
    runInterval_minutes: 30
  },
  blockParser: {
    runInterval_minutes:1,
    unverifiedRecheck_enabled: 1,
    verifiedRecheck_days: 25,
    isContractBatchLength: 85
  },
  balanceGetter: {
    balanceRefreshInterval_days: 5,
    runInterval_minutes: 1,
    aggregatedAddressSize: 45,
    parallelCrawlers: 1,
    dbBatchSize: 7000,
    contractPruner: {
      enabled: 1,
      inactivity_days: 45,
      minBalance_usd: 50
    }
  },
  sourceGetter: {
    runIntervalMinutes: 1,
    ignoredContracts: ["GnosisSafeProxy","CollectNFT","Holographer","ChannelImplementation","TransparentUpgradeableProxy"] // a lot of instances, not interesting
  },
  stateVariablesReader: {
    waitDays: 1, // wait 2 days to give time to the deployer to set the vars (rechecked periodially anyway)
    runInterval_hours: 1,
    batchLength: 1000,
    refreshInterval_days: 3,
    maxReadsPerTx: 20 
  },
  analysisFlag: {
    minPool_usd: 700,
    minBalance_usd: 1000, // used for reflections - keeping it dynamic would need another relation. assumption: it has an optimal value
    reflectedFlag: {
      runInterval_minutes: 1,
      refreshReflect_days: 3,
      parallelInstances: 3
    }
  },
  proxyReader: {
    wait_days: 2,
    runInterval_minutes: 1,
    refresh_days: 3,
    batchLength: 10000
  },
  consistencyChecker: {
    runInterval_hours: 12
  }
  
  
 };
 
 module.exports = config;