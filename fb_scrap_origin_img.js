require('dotenv').config()
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Post = require('./models/post');

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

mongoose.connect(process.env.DATABASE_LOCAL_FB, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true
    })
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log(err));
var groupUrl = process.env.GROUP_URL
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
            userDataDir: "./userData"
        })

        const context = browser.defaultBrowserContext();
        context.overridePermissions("https://www.facebook.com", ["geolocation", "notifications"]);
        let page = await browser.newPage();
        await page.setViewport({ width: width, height: width });

        //登入只有第一次需要做。
        /* await page.goto("https://www.facebook.com");
        await page.type('#email', FB_USER, { delay: DELAY_USER_INPUT });
        await page.type('#pass', FB_PW, { delay: DELAY_PW_INPUT });
        await page.click("#u_0_b");
        await page.waitFor(1000); */

        await page.goto(groupUrl);
        await page.waitForSelector("#m_group_stories_container")

        //=====================================================
        // 下一頁按鈕一直按到底
        //=====================================================
        try {
            while (await page.$('#m_group_stories_container > section > article')) {
                //=====================================================
                // 取得貼文ID以及貼文作者
                //=====================================================
                try {
                    const HTMLText = await page.evaluate(() => {
                        let data = []
                        const list = document.querySelectorAll('#m_group_stories_container > section > article');
                        for (const a of list) {
                            data.push(a.innerHTML)
                        }
                        return data;
                    })

                    //postLinks 裡面有所有當頁貼文的 link
                    var postLinks = [];

                    for (const post of HTMLText) {

                        //=====================================================
                        //             author
                        //=====================================================
                        let authorAtag = post.match(/<a[^>]*>([^<]+)<\/a>/)[0];
                        let author = ''
                        //<a href="/profile.php?id=100003944326911 這種
                        if (authorAtag.includes('profile.php?id=')) {
                            author = authorAtag.match(/profile\.php\?id=\d+/)[0];
                        }
                        //<a href="/stars.yang 這種
                        else if (/\/[^\/]+\?/.test(authorAtag)) {
                            author = authorAtag.match(/\/(.*)\?/)[0];
                            author = author.slice(1, -1);
                        }
                        //粉專帳號
                        else {
                            continue
                        }

                        //=====================================================
                        //             postId
                        //=====================================================
                        let atagToFullPost = post.match(/<a[^>]*>完整動態<\/a>/g)[0];
                        //postId = 當篇貼文Id
                        let postId = atagToFullPost.match(/;id=[0-9]*/)[0];
                        postId = postId.replace(';id=', '');

                        //=====================================================
                        //             Check post in DB
                        //=====================================================
                        let findPost = await Post.findOne({ postId: postId });
                        if (findPost) {
                            console.log(`Post ${postId} already exist in Database`)
                        } else {
                            try {
                                //存入DB
                                let newPost = new Post({ postId, author })
                                await newPost.save();
                            } catch (error) {
                                console.log(error)
                            }
                        }
                    }
                } catch (error) {
                    console.log('error in func.getPostAndAuthorLink')
                    console.log(error)
                    await browser.close();
                }
                await page.click('#m_group_stories_container > div > a')
                await page.waitForSelector('#m_group_stories_container')
            }
        } catch (error) {
            //跳出while 所有頁面都做完。
            console.log('\n')
            console.log('==========================================================================================')
            console.log('||                        Finish retreving postId and author Id.                         ||')
            console.log('||                        Starting retreving img and description.                        ||')
            console.log('==========================================================================================')
            console.log('\n')
            performance.mark('B');
            performance.measure('A to B (ms):', 'A', 'B');
            console.log('\n')
        }

        //=====================================================
        // 去每個完整貼文取HTML/Text
        //=====================================================
        let allPost = await Post.find({});
        for await (const postObj of allPost) {
            try {
                //await page.waitFor(10);
                await page.goto(groupUrl + '/permalink/' + postObj.postId);
                await page.waitForSelector("#m_story_permalink_view")
                //*[@id="m_story_permalink_view"]/div[1]/div[1]//div[1]

                await page.waitForXPath('//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]');
                //東西都在'//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]/div'
                //文字部分，可以看要不要保留HTML format
                let [div1] = await page.$x('//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]/div[1]');
                let div1Text = await page.evaluate(div1 => div1.innerText, div1);

                //如果沒有店家|店名關鍵字，跳過這篇
                if (!/店家|店名/.test(div1Text)) {
                    continue
                }
                //其他可能是分享文或是圖片。
                let [div2] = await page.$x('//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]/div[2]');
                if (div2) {
                    var div2Other = await page.evaluate(div2 => div2.innerHTML, div2);
                    var imgaTag = div2Other.match(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g);
                };

                //單一貼文的img們

                if (imgaTag) {
                    var img = []
                    for await (let fbImgLink of imgaTag) {
                        //如果是照片的tag的話
                        if (/\/photo.php?(.*?)\"/.test(fbImgLink)) {
                            fbImgLink = fbImgLink.match(/\/photo.php?(.*?)\"/)[0];
                            fbImgLink = fbImgLink.slice(1, -1);
                            //await console.log(fbImgLink);
                            await console.log('https://facebook.com/' + fbImgLink)
                            await page.goto('https://facebook.com/' + fbImgLink);
                            await page.waitForXPath('//img[@class="spotlight"]');

                            let [div3] = await page.$x('//img[@class="spotlight"]/..');
                            if (div3) {
                                var imgDiv = await page.evaluate(div3 => div3.innerHTML, div3)
                            };

                            let imgURL = imgDiv.match(/\"https(.*?)\"/)[0]
                            imgURL = imgURL.slice(1, -1);
                            //因為FB的照片有escape char 所以要decode
                            function decodeHTML(encodedString) {
                                return new Promise((resolve, reject) => {
                                    try {
                                        var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
                                        var translate = {
                                            "nbsp": " ",
                                            "amp": "&",
                                            "quot": "\"",
                                            "lt": "<",
                                            "gt": ">"
                                        };

                                        var result = encodedString.replace(translate_re, function(match, entity) {
                                            return translate[entity];
                                        }).replace(/&#(\d+);/gi, function(match, numStr) {
                                            var num = parseInt(numStr, 10);
                                            return String.fromCharCode(num);
                                        });
                                        resolve(result)
                                    } catch (error) {
                                        reject(error)
                                    }
                                })
                            }

                            imgURL = await decodeHTML(imgURL);
                            //await console.log(imgURL);
                            await img.push(imgURL)
                        }
                    }
                }

                //await console.log(img);
                //await console.log(div1Text);
                let data = {}
                if (img) {
                    data['imageURLs'] = img
                }
                if (div1Text) {
                    data['description'] = div1Text
                }
                await Post.findByIdAndUpdate(postObj._id, data);
                await console.log(`updating _id: ${postObj._id}`);
                //Reset values
                [div1Text, div2Other] = await Promise.all(['', '']);


            } catch (error) {
                console.log('error in func.getDescriptionAndImageURL')
                console.log(error)
                await browser.close();
            }
        }
        await browser.close();
        //=====================================================
        //  把不相關的貼文砍掉
        //=====================================================
        await Post.find({ description: '' }).deleteMany()
        //await console.log('delete empty dexcription post')

        //=====================================================
        //check for run time 
        //=====================================================
        console.log('\n')
        console.log('==========================================================================================')
        console.log("||                          Finish retreving img and description.                        ||")
        console.log("||                           Process Complete!                                           ||")
        console.log('=========================================================================================')
        performance.mark('C');
        performance.measure('A to C (ms)', 'A', 'C');
        //await browser.close();
    })();


} catch (error) {
    console.log('error in fb_scrap.js')
    console.log(error)
    //browser.close();
}