圖文:https://www.notion.so/puppeteer-f36071b57f1c480dac86f0b05643c317

# 爬蟲puppeteer爬臉書社團

因為要做專案需要某個私密臉書社團的資料，而我也不是該社團的管理員，所以無法使用臉書提供的GraphAPI，(如果可以用GraphAPI將會方便很多。)

所以花了三天熬夜拼出一個可以爬臉書社團貼文，貼文者，內容，照片的爬蟲。

這邊我們用到puppeteer，mongoDB

1. 設定環境和Schema然後 connect DB

[https://gist.github.com/JulianLin549/5ca847769b9d73d396a13c89535e7cdc](https://gist.github.com/JulianLin549/5ca847769b9d73d396a13c89535e7cdc)

[https://gist.github.com/JulianLin549/4d24e7ebd4a0c94464da6417e0bd3ed9](https://gist.github.com/JulianLin549/4d24e7ebd4a0c94464da6417e0bd3ed9)

2. puppeteer 利用 async/await 或 promises，記得所有的操作都要變成 promise(resolve, reject)

踩了一堆雷啊!

接下來是puppet的設定，這邊可以設定puppeteer的長寬，要不要開無頭，還有設定./userData存cookie，這樣就只要輸入一次帳密登入即可。

[https://gist.github.com/JulianLin549/665e7d7eb2f51325f6d5c980d33b064d](https://gist.github.com/JulianLin549/665e7d7eb2f51325f6d5c980d33b064d)

var = groupUrl 用var設定你要爬的社團就可以了。注意這邊使用mbasic.fabecook

mbasic是純html的臉書，因為原本的臉書一直在改版，而且介面也非常的反爬蟲，除了會有隨機的id之外還有隨機的架構，相對的mbasic就很簡單直覺。用xpath就可以解決大部分的selector，有時候還會佛心提供你id用。

同樣的一篇文章，在mbasic和原本FB的Xpath差別

mbasic 的 Xpath: `//*[@id=m_group_stories_container"]/section/article`

原版的FB的Xpath:

`//[*@id="mount_0_0"]/div/div[1]/div[1]/div[3]/div/div/div[1]/div[1]/div[4]/div/div/div/div/div[1]/div[2]/div/div[2]`

所以mbasic就可以很輕鬆用xpath或是有時也可以用querySelector 

比如說我要找社團內的所有貼文，這邊直接用querySelector就好。

```jsx
const list = document.querySelectorAll('#m_group_stories_container > section > article')
```

![%E7%88%AC%E8%9F%B2puppeteer%E7%88%AC%E8%87%89%E6%9B%B8%E7%A4%BE%E5%9C%98%2070e7bb69e11d4a03aa3a5a6bdd6f3f32/Untitled.png](%E7%88%AC%E8%9F%B2puppeteer%E7%88%AC%E8%87%89%E6%9B%B8%E7%A4%BE%E5%9C%98%2070e7bb69e11d4a03aa3a5a6bdd6f3f32/Untitled.png)

![%E7%88%AC%E8%9F%B2puppeteer%E7%88%AC%E8%87%89%E6%9B%B8%E7%A4%BE%E5%9C%98%2070e7bb69e11d4a03aa3a5a6bdd6f3f32/Untitled%201.png](%E7%88%AC%E8%9F%B2puppeteer%E7%88%AC%E8%87%89%E6%9B%B8%E7%A4%BE%E5%9C%98%2070e7bb69e11d4a03aa3a5a6bdd6f3f32/Untitled%201.png)

# 第一階段

## 爬所有貼文，存下貼文連結和作者連結

在來說一下要怎樣把一個社團爬完，首先要一直有辦法下一頁看到新的貼文。在mbasic裡面有個按鍵叫做查看更多貼文的<a> 在 `page.click('#m_group_stories_container > div > a')`

![%E7%88%AC%E8%9F%B2puppeteer%E7%88%AC%E8%87%89%E6%9B%B8%E7%A4%BE%E5%9C%98%2070e7bb69e11d4a03aa3a5a6bdd6f3f32/Untitled%202.png](%E7%88%AC%E8%9F%B2puppeteer%E7%88%AC%E8%87%89%E6%9B%B8%E7%A4%BE%E5%9C%98%2070e7bb69e11d4a03aa3a5a6bdd6f3f32/Untitled%202.png)

所以要一直去頁面找這個<a>在不在，如果在就執行任務，這邊採用如果按鍵不在就try catch丟錯繼續跑。

```jsx
//HTMLText把當頁的article存成array，裡面用string把article的HTML存下來。
const HTMLText = await page.evaluate(() => {
    let data = []
    const list = document.querySelectorAll('#m_group_stories_container > section > article');
    for (const a of list) {
        data.push(a.innerHTML)
    }
    return data;
})
```

然後針對每個article HTML做 RegEx 取出第一個<a>是作者的連結。

作者聯結有三種表示法，

1. `/profile.php?id=100003944326911`
2. `/julian.lin55`
3. `/julian's'photo/` 這種通常是粉絲專業發文。

```jsx
//=====================================================
//             author
//=====================================================
let authorAtag = post.match(/<a[^>]*>([^<]+)<\/a>/)[0];
let author = ''
//<a href="/profile.php?id=100003944326911 這種
if (authorAtag.includes('profile.php?id=')) {
    author = authorAtag.match(/profile\.php\?id=\d+/)[0];
}
//<a href="/julian.lin55 這種
else if (/\/[^\/]+\?/.test(authorAtag)) {
    author = authorAtag.match(/\/(.*)\?/)[0];
    author = author.slice(1, -1);
}
//粉專帳號
else {
    continue
}
```

然後一樣用Regex取出完整動態的<a>，並把他的postId取出，這樣一來，就可以得到貼文的連結

```jsx
postURL = groupUrl + '/permalink/' + postId
```

再來，確定這個post有沒在DB裡面出現過。如果有就不要存，反之就存。

```jsx
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
```

現在我們DB裡面有當則貼文的postId和authorId了。

接下來就要按下一頁的按鈕，去下一頁在做同樣的事情。

[https://gist.github.com/JulianLin549/4dba05685d38dabb359cf6663d364ce3](https://gist.github.com/JulianLin549/4dba05685d38dabb359cf6663d364ce3)

這樣第一階段就算完成了。我們在DB裡面有所有貼文的連結和作者了。

# 第二階段

## 去每個貼文取文字和照片

首先要先去DB找之前存的貼文link，

```jsx
let allPost = await Post.find({});
for await (const postObj of allPost){
 (...)
```

然後去每個貼文裡面，找要的部分

```jsx
//東西都在'//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]/div'
```

要的部分裡面有兩個div，分別是文字和其他(通常包含圖片或是分享的粉專。)

首先處裡文字部分，把html轉成text，再去找有需要的關鍵字，這部份看個人需求。

```jsx

await page.goto(groupUrl + '/permalink/' + postObj.postId);
await page.waitForSelector("#m_story_permalink_view")

await page.waitForXPath('//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]');
//東西都在'//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]/div'

//文字部分
let [div1] = await page.$x('//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]/div[1]');
let div1Text = await page.evaluate(div1 => div1.innerText, div1); //HTML to Text

//如果沒有店家|店名關鍵字，跳過這篇
if (!/店家|店名/.test(div1Text)) {
    continue
}

```

在來處理包含可能是分享文或是圖片的div2。

先把所有可能是img的<a>取出

```jsx
//其他可能是分享文或是圖片。
let [div2] = await page.$x('//*[@id="m_story_permalink_view"]/div[1]/div[1]/div[1]/div[2]');
if (div2) {
    var div2Other = await page.evaluate(div2 => div2.innerHTML, div2);
    var imgaTag = div2Other.match(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g);
};
```

如果這則貼文有<a>代表有可能有圖片。

在來去確認是不是照片的tag，如果是的話，他的<a>會有 `/\/photo.php?(.*?)/`

抓出來之後會得到像是

```jsx
/photo.php?fbid=101241398378567&amp;id=100054781202812&amp;set=pcb.641811866734150&amp;source=48&amp;refid=18&amp;__tn__=EH-R
```

直接把前面加上 [`https://facebook.com/`](https://facebook.com/) 就是要的連結。

這邊為甚麼是用facebook.com而不用超棒的mbasic.facebook.com?

因為我發現mbasic導向的照片連結都是360*360等級，超級小。不過這也合理，因為畢竟mbasic是給網速不好的地區使用的。不是給我爬蟲ㄉ 😝😝😝

幸運的是原本臉書和mbasic的都是導向同樣的照片。

```jsx
if (imgaTag) {
    var img = []
    for await (let fbImgLink of imgaTag) {
        //如果是照片的tag的話
        if (/\/photo.php?(.*?)\"/.test(fbImgLink)) {
            fbImgLink = fbImgLink.match(/\/photo.php?(.*?)\"/)[0];
            fbImgLink = fbImgLink.slice(1, -1);
            //"/photo.php?fbid=101241398378567&amp;id=100054781202812&amp;set=pcb.641811866734150&amp;source=48&amp;refid=18&amp;__tn__=EH-R"
```

再來就是一一的去這些照片網址拿照片。

```jsx
await console.log('https://facebook.com/' + fbImgLink)
await page.goto('https://facebook.com/' + fbImgLink);
await page.waitForXPath('//img[@class="spotlight"]');

let [div3] = await page.$x('//img[@class="spotlight"]/..');
if (div3) {
    var imgDiv = await page.evaluate(div3 => div3.innerHTML, div3)
};

let imgURL = imgDiv.match(/\"https(.*?)\"/)[0]
imgURL = imgURL.slice(1, -1);
```

一樣找出你要的部分，去用RegEx去找

這邊就會解析出一串看起來很promissing的東西

```jsx
https://scontent.ftpe2-1.fna.fbcdn.net/v/t1.0-9/p720x720/118321216_3699575563427939_7641254997573144578_o.jpg?_nc_cat=103&amp;_nc_sid=ca434c&amp;_nc_ohc=ObdiZqvM1H4AX_lYcax&amp;_nc_ht=scontent.ftpe2-1.fna&amp;tp=6&amp;oh=784d95a7b2e07bc0f3b15805996e3c5a&amp;oe=5F6A72CF
```

不過把他貼到網站上會出現 `"Bad URL timestamp"`

差點把我嚇壞，以為花了麼多時間白費了。

結果查了一下stackoverflow，發現他是被escape char過的網址，所以只要把他還原就好了。

因為這邊我們是採用async，所以記得用promise來寫。

```jsx
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
```

這下，我們的 var img = [] 就有當篇貼文的所有照片連結了。

接下來就差把所有東西存進DB裡面了。

最後記得做完一篇貼文div1Text, div2Other要reset，不然怕可能有一篇貼文的某一部分是空的，這樣就會重複。

```jsx

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

await browser.close();
```

最後的最後，選擇性的可以把DB裡面description的貼文砍掉，因為那就不是我要的。

```jsx
 //=====================================================
//  把不相關的貼文砍掉
//=====================================================
await Post.find({ description: '' }).deleteMany()
await console.log('delete empty dexcription post')
```

這樣DB裡面又有社團裡的所有 貼文URL，貼文者URL，貼文內容，以及內容圖片URL

## 打完收工要把這筆資料做甚麼處裡就自己看著辦 🤑🤑🤑
