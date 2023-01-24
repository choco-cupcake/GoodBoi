const mysql = require('../utils/MysqlGateway')
const Utils = require('../utils/Utils')
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Xvfb = require('xvfb');
require("dotenv").config()

const timeout_XP = 10000
// every 2 hours
// pm2 start services/verifiedGetter.js --cron-restart="0 */2 * * *"

const launchParsing = () => {
  return new Promise((resolve, reject) => {
    let browser, page, xvfb
    let dbConn
    
    crawlEtherscan()

    async function crawlEtherscan(){
      dbConn = await mysql.getDBConnection()
      await puppeteerBoot()
      for(let chain of Object.values(Utils.chains)){
        console.log("Start crawling verified contracts for chain: ", chain)
	      await page.goto(Utils.verifiedUrl[chain])
        await sleep(1000)
        let lastAddress = await mysql.getLastParsedAddress(dbConn, chain) // get the newest address we crawled this way - we'll stop when we find that addr
        console.log("lastAddress: ", lastAddress)
        if(!lastAddress) 
          resolve("")

        
        if(!await expandElements()) // set 100 elements per page for efficiency
          console.log("ERROR - failed expandElements()")
        
        let firstAddress // this is the last chronological contract
        while(true){
          
          let ret = await parsePage(lastAddress)
          console.log("Got " + ret.addresses.length + " new verified contract addressess")
      
          if(!ret.addresses.length)
            break 
          
          if(!firstAddress)
            firstAddress = ret.addresses[0] // we will store this value on the db only if this crawling process doesn't fail
          
          await mysql.pushVerifiedAddresses(dbConn, chain, ret.addresses) // push addresses to db

          if(!ret.next || ret.addresses.length < 100) // last page or we only had to crawl a few in the first page
            break
      
          await sleep(1000) // safety wait for new page loading (actually for the old page to unload, so that we don't reparse the old elements)
                                  // we can go generous with the time margin as this task is fast and must only run once in a while
        }
      
        if(firstAddress)
          await mysql.updateLastParsedAddress(dbConn, chain, firstAddress)// update last crawled address
      
        await sleep(100)
        console.log("Crawling done for chain: ", chain)
	    }
      await browser.close()
      xvfb.stop();
      console.log("EtherScraper leaving")
      resolve("all good")
    }
    
    async function parsePage(lastAddress){
      let addressesXP = '//table//tr/td[1]/a/text()'
      let nextPageXP = '//form[@id="ctl00"]//ul/li[4]'
      let lastPageDisabledXP = '//form[@id="ctl00"]//ul/li[last()][contains(@class,"disabled")]'
      
      await page.waitForXPath(addressesXP, {timeout: timeout_XP}); // wait elem load
      let addressesElem = await page.$x(addressesXP); // get addresses
      let addresses = []
      for(let ae of addressesElem){
        addresses.push(await page.evaluate(e => e.textContent, ae))
      }
      let indexLast = addresses.indexOf(lastAddress)
      if(indexLast >= 0){ 
        addresses = addresses.slice(0, indexLast) // remove already parsed addresses
      }
      await page.waitForXPath(nextPageXP, {timeout: timeout_XP}); // check if this is the last page
      let nextPDis = await page.$x(lastPageDisabledXP);
      if(nextPDis.length) 
        return {addresses: addresses, next: false}
      
      let nextP = await page.$x(nextPageXP); // click next page
      await nextP[0].click()
      return {addresses: addresses, next: true}
    }
    
    async function expandElements(){
      let selectXP = '//select[@id="ContentPlaceHolder1_ddlRecordsPerPage"]'
      let optXP = '/option[@value="100"]'
      await page.waitForXPath(selectXP, {timeout: timeout_XP});
      const [sel] = await page.$x(selectXP);
      if (sel) {
        await sel.click()
      }
      else return false
      const [opt] = await page.$x(selectXP + optXP);
      page.keyboard.press('1');
      page.keyboard.press('Enter');
      await sleep(1500)
      return true
    }
    
    
    async function puppeteerBoot() {
      xvfb = new Xvfb({
        silent: true,
        xvfb_args: ["-screen", "0", '1280x720x24', "-ac"],
      });
      xvfb.start((err)=>{if (err) console.error(err)})
      puppeteer.use(StealthPlugin());
      let proxyChain = require('proxy-chain');
      let proxyUrl = "http://" + process.env.smartproxy_id + ":" + process.env.smartproxy_pwd + "@gate.smartproxy.com:7000"
      let newProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
      console.log("newProxyUrl:",newProxyUrl, typeof newProxyUrl)
      let newargs = puppeteer.defaultArgs().slice();
      newargs.push('--proxy-server=' + newProxyUrl);
      browser = await puppeteer.launch({
        args: newargs,
        executablePath: "/usr/bin/chromium-browser",        
        headless: false,
        defaultViewport: null,
        args: [
        '--no-sandbox', '--enable-automation', "--disabled-setupid-sandbox", "--display=" + xvfb._display
        ]
	
      }) 
      page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-GB'
      });
      await page.goto("https://etherscan.io/contractsVerified")
      console.log("Puppeteer boot done")
    }
  })
}
main()


async function main(){
  await launchParsing()
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
