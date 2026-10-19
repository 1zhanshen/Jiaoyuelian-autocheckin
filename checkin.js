// checkin.js - 皎月连自动签到 (防导航报错优化版)
const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve();
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      const file = fs.createWriteStream(filepath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function solveWithOpenCV(bgPath, jigPath) {
  const result = execSync(`python3 ${__dirname}/solve_slider.py "${bgPath}" "${jigPath}"`);
  return parseInt(result.toString().trim());
}

// 带有自动重试功能的验证码处理函数
async function handleCaptchaWithRetry(page, maxRetries = 3) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      // 关键修复：在检查前先等待页面网络空闲，确保导航完成
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await delay(1000); // 额外缓冲1秒

      const images = await page.evaluate(() => {
        const bg = document.querySelector('img.yidun_bg-img');
        const jig = document.querySelector('img.yidun_jigsaw');
        return { bg: bg?.src, jig: jig?.src };
      });
      
      if (images.bg && images.jig) {
        console.log(`⚠️ 第 ${i} 次尝试：检测到滑块验证码，尝试解决...`);
        await downloadImage(images.bg, '/tmp/captcha_bg.jpg');
        await downloadImage(images.jig, '/tmp/captcha_jig.png');
        
        const offset = solveWithOpenCV('/tmp/captcha_bg.jpg', '/tmp/captcha_jig.png');
        console.log('计算滑动偏移:', offset);
        
        const slider = await page.$('.yidun_slider');
        if (slider) {
          const box = await slider.boundingBox();
          await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width/2 + offset, box.y + box.height/2, { steps: 20 });
          await page.mouse.up();
          await delay(3000); 
          return true; // 处理成功
        }
      } else {
        return false; // 没有验证码，无需处理
      }
    } catch (e) {
      if (e.message.includes('Execution context was destroyed') || e.message.includes('navigation')) {
        console.log(`第 ${i} 次检查验证码时遇到页面跳转，正在重试...`);
        await delay(2000);
      } else {
        console.log(`处理验证码时发生其他错误: ${e.message}`);
        return false;
      }
    }
  }
  return false;
}

async function autoCheckIn() {
  let browser;
  let checkinResult = '';
  
  try {
    const USERNAME = process.env.NATPIERCE_USERNAME;
    const PASSWORD = process.env.NATPIERCE_PASSWORD;
    
    if (!USERNAME || !PASSWORD) {
      throw new Error("未配置账号或密码，请检查 GitHub Secrets");
    }

    browser = await puppeteer.launch({ 
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] 
    });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log('1. 正在访问登录页...');
    await page.goto('https://www.natpierce.cn/pc/login/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(2000);
    
    console.log('2. 开始输入账号密码...');
    await page.waitForSelector('input[placeholder="请输入手机号或邮箱"]', { timeout: 30000 });
    await page.waitForSelector('input[placeholder="请输入密码"]', { timeout: 30000 });
    
    await page.click('input[placeholder="请输入手机号或邮箱"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(USERNAME, { delay: 100 });
    
    await page.click('input[placeholder="请输入密码"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(PASSWORD, { delay: 100 });
    
    console.log('3. 点击登录按钮...');
    // 使用 Promise.all 同时等待点击和导航，更稳健
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('div.login_btn')
    ]);
    
    console.log('4. 检查登录过程是否需要验证码...');
    await handleCaptchaWithRetry(page); // 使用带重试的函数
    
    console.log('5. 等待页面跳转...');
    try {
      await page.waitForFunction(() => !window.location.href.includes('login.html'), { timeout: 15000 });
      console.log('✅ 登录成功，页面已跳转！');
    } catch (e) {
      console.log('⚠️ 页面未自动跳转，可能登录失败或网络延迟，尝试强制进入签到页...');
    }
    
    if (!page.url().includes('sign')) {
      console.log('当前不在签到页，强制跳转...');
      await page.goto('https://www.natpierce.cn/pc/sign/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
      await delay(2000);
    }
    
    if (page.url().includes('login.html')) {
      throw new Error("登录失败：可能账号密码错误，或被网站防爬虫机制拦截。");
    }

    console.log('6. 寻找签到按钮...');
    const maxRetries = 3;
    let selectorFound = false;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await page.waitForSelector('#qiandao', { timeout: 10000 });
        selectorFound = true;
        break;
      } catch (e) {
        console.log(`第 ${attempt} 次未找到签到按钮，刷新重试...`);
        await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
        await delay(3000);
      }
    }
    
    if (!selectorFound) {
      throw new Error("找不到 #qiandao 签到按钮，网站可能改版了。");
    }
    
    const buttonText = await page.evaluate(() => document.querySelector('#qiandao')?.innerText);
    console.log(`找到按钮，当前状态: "${buttonText}"`);
    
    if (buttonText && (buttonText.includes('已签到') || buttonText.includes('明日'))) {
      checkinResult = `今天已经签过到了，无需重复签到。`;
    } else {
      console.log('7. 点击签到按钮...');
      await page.click('#qiandao');
      await delay(3000);
      
      console.log('8. 调用签到 API 确认结果...');
      const result = await page.evaluate(() => {
        return new Promise((resolve) => {
          $.post('/pc/sign/qiandao.html', {}, function(t) { resolve(t); }, 'json');
        });
      });
      console.log('API返回:', JSON.stringify(result));
      
      if (result.code === 200) {
        checkinResult = `签到成功！${result.message || ''}`;
      } else if (result.message && result.message.includes('服务尚未到期')) {
        checkinResult = `服务尚未到期，无需签到。`;
      } else {
        checkinResult = `签到失败: ${JSON.stringify(result)}`;
      }
    }
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await delay(1000);
    const finalContent = await page.content();
    const nextTimeMatch = finalContent.match(/下次可签到时间[：:]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (nextTimeMatch) {
      checkinResult += ` (下次可签到: ${nextTimeMatch[1]})`;
    }

  } catch (error) {
    checkinResult = `❌ 运行出错: ${error.message}`;
    console.error('发生错误:', error);
  } finally {
    if (browser) await browser.close();
  }
  
  console.log(`CHECKIN_RESULT: ${checkinResult}`);
}

autoCheckIn();
