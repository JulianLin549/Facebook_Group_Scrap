require('dotenv').config()
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Map = require('./models/map');

//==========================================================================================
//check for run time 
//==========================================================================================
const { PerformanceObserver, performance } = require('perf_hooks');
const obs = new PerformanceObserver((items) => {
    console.log('PerformanceObserver A to B', items.getEntries()[0].duration);
    performance.clearMarks();
});
obs.observe({ entryTypes: ['measure'] });
performance.mark('A');
//==========================================================================================
//check for run time 
//==========================================================================================
var DELAY_TIME = 400
mongoose.connect(process.env.DATABASE_LOCAL_MAP, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true
    })
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log(err));
try {
    (async () => {
        // Viewport && Window size
        const width = 1375
        const height = 800

        const browser = await puppeteer.launch({
            headless: false,
            args: [
                `--window-size=${ width },${ height }`
            ],
            defaultViewport: {
                width,
                height
            },
            executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
        })

        const context = browser.defaultBrowserContext();
        context.overridePermissions("https://www.google.com/maps", ["geolocation", "notifications"]);
        let page = await browser.newPage();
        await page.setViewport({ width: width, height: width });

        await page.goto(process.env.MAP_URL);
        await page.waitForXPath('//*[@id="legendPanel"]/div/div/div[2]/div/div/div[2]')



        //let regions = Array.from(document.querySelectorAll('#legendPanel > div > div > div > div > div > div > div > div > div.HzV7m-pbTTYe-r4nke'));
        //找到所有的連結按鈕
        //let stores = Array.from(document.querySelectorAll('#legendPanel > div > div > div > div > div >  div > div > div > div > .HzV7m-pbTTYe-ibnC6b'));
        //console.log(stores[5].children[1]): 
        //<div class="HzV7m-pbTTYe-ibnC6b-V67aGc">
        //  <div class="suEOdc" data-tooltip="白露拉麵 bailu ramen(0522試營運)" aria-label="白露拉麵 bailu ramen(0522試營運)">白露拉麵 bailu ramen(0522試營運)</div>
        //</div>
        //找到所有的地區innerText 
        /* await page.evaluate(() => {
            let regions = Array.from(document.querySelectorAll('#legendPanel > div > div > div > div > div > div > div > div > div.HzV7m-pbTTYe-r4nke'));
            for (let i = 0; i < regions.length; i++) {
                console.log(regions[i].innerText)
                let stores = document.querySelectorAll(`#legendPanel > div > div > div:nth-child(2) > div > div > div:nth-child(2) > div:nth-child(${i+1}) > div >div:nth-child(3) > div.pbTTYe-ibnC6b-d6wfac`);
                for (store of stores) {
                    console.log(window.location.href)
                    console.log(store.innerText);
                    //page.click(store)
                    store.click();
                    let featurePanel = document.querySelectorAll('#featurecardPanel > div > div > div.qqvbed-bN97Pc > div.qqvbed-UmHwN > div');
                    console.log(featurePanel)
                    let backButton = document.querySelectorAll('#featurecardPanel > div > div > div.qqvbed-tJHJj > div.HzV7m-tJHJj-LgbsSe-haAclf.qqvbed-a4fUwd-LgbsSe-haAclf > div')
                    backButton[0].click()
                }
            }
        }) */
        //還有更多先點開
        const moreBtns = await page.$$('#legendPanel > div > div > div > div > div > div> div > div > div> div> span');
        for (moreBtn of moreBtns) {
            await moreBtn.click()
        }
        const regions = await page.$$('#legendPanel > div > div > div > div > div > div > div > div > div.HzV7m-pbTTYe-r4nke');
        for (let i = 0; i < regions.length; i++) {
            let regionName = await page.evaluate(element => element.innerText, regions[i]); //*************地區*************
            const stores = await page.$$(`#legendPanel > div > div > div:nth-child(2) > div > div > div:nth-child(2) > div:nth-child(${i+1}) > div >div:nth-child(3) > div.pbTTYe-ibnC6b-d6wfac`);
            for (storeLink of stores) {
                let storeName = await page.evaluate(element => element.innerText, storeLink); //*************店名*************
                //去商店的連結
                await storeLink.click()
                await page.waitFor(DELAY_TIME)

                await page.waitForSelector('#featurecardPanel>div>div>div:nth-child(4) > div:nth-child(1)>div:nth-child(2)>div:nth-child(2)');
                let descriptionLink = await page.$('#featurecardPanel>div>div>div:nth-child(4) > div:nth-child(1)>div:nth-child(2)>div:nth-child(2)');
                let descriptionHTML = await page.evaluate(element => element.innerHTML, descriptionLink); //**********文字HTML************
                let descriptionText = await page.evaluate(element => element.innerText, descriptionLink); //**********文字TEXT************

                let addressTag = await page.$('#featurecardPanel > div > div > div:nth-child(4) > div:nth-child(2) > div:nth-child(2)');
                var address = ''
                console.log(addressTag)
                if (addressTag) {
                    address = await page.evaluate(element => element.innerText, addressTag); //*************地址*************
                    console.log(address)
                }
                let url = page.url()
                let location = url.match(/\=\d*\.\d*\%2C\d*\.\d*/)
                location = location[0].match(/\d*\.\d*/g)
                location = [parseFloat(location[1]), parseFloat(location[0])] //  [ '25.02629050000002', '121.47718700000001' ]  前lat後lon

                //=========================================================
                //    存入DB
                //=========================================================


                let findMap = await Map.findOne({ storeName });
                if (findMap) {
                    console.log(`店家 ${storeName} 早就存在。`)
                } else {
                    try {
                        //存入DB
                        let newStore = new Map({
                            storeName: storeName,
                            region: regionName,
                            descriptionHTML: descriptionHTML,
                            descriptionText: descriptionText,
                            location: {
                                type: 'Point',
                                coordinates: [location[0], location[1]],
                                formattedAddress: address
                            },
                        })
                        await newStore.save();
                    } catch (error) {
                        console.log(error)
                    }
                }

                //上一頁
                await page.waitForSelector('#featurecardPanel > div > div >div:nth-child(3) > div:nth-child(1) > div:nth-child(1)');
                let backBtn = await page.$('#featurecardPanel > div > div >div:nth-child(3) > div:nth-child(1) > div:nth-child(1)');
                await backBtn.click();
                await page.waitFor(DELAY_TIME)
            }
        }



        /* await example[3].click();
        await page.waitFor(10000)


        await page.waitForSelector('#featurecardPanel > div > div >div:nth-child(3) > div:nth-child(1) > div:nth-child(1)')
        const back = await page.$('#featurecardPanel > div > div >div:nth-child(3) > div:nth-child(1) > div:nth-child(1)');
        await back.click() */
        function log(element) {
            return new Promise((resolve, reject) => {
                return resolve(element)

            })
        }
    })();


} catch (error) {
    console.log('error in fb_scrap.js')
    console.log(error)
    //browser.close();
}