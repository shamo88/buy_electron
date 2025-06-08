const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const cheerio = require('cheerio');
const { Builder, By, until } = require('selenium-webdriver');
require('selenium-webdriver/edge');
const edge = require('selenium-webdriver/edge');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();

// 1. userDataDir配置
const configPath = path.join(__dirname, 'config.json');
let userDataDir = '';
let mailSender = '13632472225@163.com';
let mailPassword = 'KY4EVp7miRJ752Cw';
let mailRecipient = '592334843@qq.com';
let smtpServer = 'smtp.163.com';
let smtpPort = 25;
if (fs.existsSync(configPath)) {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        userDataDir = config.userDataDir || '';
        if (config.mailSender) mailSender = config.mailSender;
        if (config.mailPassword) mailPassword = config.mailPassword;
        if (config.mailRecipient) mailRecipient = config.mailRecipient;
        if (config.smtpServer) smtpServer = config.smtpServer;
        if (config.smtpPort) smtpPort = config.smtpPort;
    } catch (e) {
        userDataDir = '';
    }
}

let mainDriver = null;   // 首页/登录 driver
let searchDriver = null;

const dbPath = require('path').join(__dirname, 'orders.db');
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    sku TEXT,
    order_time TEXT
  )`);
});

async function getmainDriver() {
    let needNew = false;
    if (mainDriver) {
        try {
            await mainDriver.getCurrentUrl();
        } catch (e) {
            // 只要有异常就重建
            needNew = true;
            try { await mainDriver.quit(); } catch { }
            mainDriver = null;
        }
    }
    if (!mainDriver || needNew) {
        const options = new edge.Options();
        if (userDataDir) {
            options.addArguments(`--user-data-dir=${userDataDir}`);
        }
        options.addArguments('--start-maximized');
        options.addArguments('--disable-blink-features=AutomationControlled');
        options.addArguments('--disable-infobars');
        options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0');
        mainDriver = await new Builder()
            .forBrowser('MicrosoftEdge')
            .setEdgeOptions(options)
            .build();
    }
    return mainDriver;
}

async function getSearchDriver() {
    let needNew = false;
    if (searchDriver) {
        try {
            await searchDriver.getCurrentUrl();
        } catch (e) {
            needNew = true;
            try { await searchDriver.quit(); } catch { }
            searchDriver = null;
        }
    }
    if (!searchDriver || needNew) {
        const options = new edge.Options();
        options.addArguments('--headless=new'); // 隐藏窗口
        searchDriver = await new Builder()
            .forBrowser('MicrosoftEdge')
            .setEdgeOptions(options)
            .build();
    }
    return searchDriver;
}

// 程序启动时不再自动打开mainDriver，由按钮触发
async function openJDAndAutoLogin() {
    const driver = await getmainDriver();
    await driver.get('https://www.jd.com/');
}

app.whenReady().then(() => {
    createWindow();
});

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: require('path').join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    win.loadFile('index.html');
    // 去掉原生菜单栏
    Menu.setApplicationMenu(null);
}

// 启动按钮触发mainDriver启动和自动登录
ipcMain.handle('start-login-driver', async () => {
    await openJDAndAutoLogin();
});

// 搜索时用独立driver
ipcMain.handle('search-jd', async (event, keyword, matchKeyword) => {
    const url = `https://mall.jd.com/view_search-4739449-17478743-15997944-0-0-0-0-1-1-60.html?keyword=${encodeURIComponent(keyword)}`;
    try {
        const driver = await getSearchDriver();
        await driver.get(url);
        await driver.wait(until.elementLocated(By.className('jDesc')), 10000);
        const html = await driver.getPageSource();
        const $ = cheerio.load(html);
        let results = [];
        $('.jDesc').each((i, el) => {
            const a = $(el).find('a');
            const name = a.text().trim();
            const href = a.attr('href');
            const skuMatch = href && href.match(/item\.jd\.com\/(\d+)\.html/);
            if (skuMatch) {
                const sku = skuMatch[1];
                results.push({ name, href, sku });
            }
        });
        const matched = results.find(item => item.name.includes(matchKeyword));
        if (matched) {
            for (let i = 0; i < 10; i++) {
                try {
                    const mainDriver = await getmainDriver();
                    // 记录当前所有窗口句柄
                    const handlesBefore = await mainDriver.getAllWindowHandles();
                    // 在新标签页用window.open跳转，模拟真实用户行为
                    await mainDriver.executeScript(`window.open(arguments[0], '_blank')`, `https:${matched.href}`);
                    // 等待新标签页出现
                    let newHandle;
                    await mainDriver.wait(async () => {
                        const handlesAfter = await mainDriver.getAllWindowHandles();
                        newHandle = handlesAfter.find(h => !handlesBefore.includes(h));
                        return !!newHandle;
                    }, 10000);
                    // 切换到新标签页
                    await mainDriver.switchTo().window(newHandle);
                    // 等待InitTradeUrl出现后，模拟点击"立即购买"按钮
                    await mainDriver.wait(until.elementLocated(By.id('InitTradeUrl')), 10000);
                    await mainDriver.executeScript(`
                        const btn = document.getElementById('InitTradeUrl');
                        if (btn) { btn.click(); }
                    `);
                    // <button type="submit" class="checkout-submit" id="order-submit" onclick="javascript:submit_Order(null,2);" clstag="pageclick|keycount|trade_201602181|25">
                    // 等待提交订单按钮出现后，模拟点击"提交订单"按钮
                    await mainDriver.wait(until.elementLocated(By.id('order-submit')), 10000);
                    await mainDriver.executeScript(`
                        const btn = document.getElementById('order-submit');
                        if (btn) { btn.click(); }
                    `);
                    // 如果当前页面跳转到了https://payc.m.jd.com/d/cashier/?orderId=320610990694&reqInfo=eyJjYXRlZ29yeSI6IjEiLCJvcmRlckFtb3VudCI6IjM5OS4wMCIsIm9yZGVyRXJwUGxhdCI6IkpEIiwidmVyc2lvbiI6IjMuMCIsIm9yZGVySWQiOiIzMjA2MTA5OTA2OTQiLCJwYXlBbW91bnQiOiIzOTkuMDAiLCJjb21wYW55SWQiOiIxMCIsIm9yZGVyVHlwZSI6IjIyIiwidG9UeXBlIjoiMTAifQ==&sign=34833cd7ec602f37353a633892bc2995&appId=pc_ls_mall&cashierId=1，说明下单成功
                    const currentUrl = await mainDriver.getCurrentUrl();
                    console.log('currentUrl', currentUrl);
                    if (currentUrl.includes('https://trade.jd.com/shopping/order/') || currentUrl.includes('https://payc.m.jd.com/d/cashier/')) {
                        // 下单成功，发送邮件
                        // 打印
                        console.log('下单成功');
                        const now = new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
                        db.run(
                            'INSERT INTO orders (name, sku, order_time) VALUES (?, ?, ?)',
                            [matched.name, matched.sku, now],
                            (err) => {
                                if (err) {
                                    console.error('记录订单失败:', err);
                                } else {
                                    console.log('订单已记录:', matched.name, matched.sku, now);
                                }
                            }
                        );
                        sendMail([
                            { name: matched.name, sku: matched.sku },
                        ], mailRecipient);
                        // 关闭当前窗口
                        await mainDriver.close();
                    }
                    break;
                } catch (e) {
                    console.error('下单失败:', e);
                    continue;
                }
            }
        }
        return results;
    } catch (e) {
        console.error('Selenium error:', e);
        return [];
    }
});

// 关闭所有driver
ipcMain.handle('close-edgedriver', async () => {
    for (const drv of [mainDriver, searchDriver]) {
        if (drv) {
            try {
                await drv.quit();
            } catch (e) { }
        }
    }
    mainDriver = null;
    searchDriver = null;
    console.log('所有msedgedriver已关闭');
});

app.on('before-quit', async (event) => {
    event.preventDefault();
    try {
        for (const drv of [mainDriver, searchDriver]) {
            if (drv) {
                try { await drv.quit(); } catch { }
            }
        }
    } finally {
        mainDriver = null;
        searchDriver = null;
        app.exit(0);
    }
});

function sendMail(products, recipient = mailRecipient) {
    // 邮件服务器配置
    const smtp_server = smtpServer;
    const smtp_port = smtpPort;
    const sender = mailSender; // 发件人邮箱
    const password = mailPassword; // 邮箱授权码

    // 构建邮件内容
    let content = "已下单：\n\n";
    for (const product of products) {
        content += `商品名称: ${product.name}\n`;
        content += `SKU: ${product.sku}\n`;
        content += "------------------------\n";
    }
    content += "赶快去付款";

    // 创建邮件 transporter
    const transporter = nodemailer.createTransport({
        host: smtp_server,
        port: smtp_port,
        secure: false,
        auth: {
            user: sender,
            pass: password
        }
    });

    // 邮件选项
    const mailOptions = {
        from: sender,
        to: recipient,
        subject: '下单通知',
        text: content
    };

    // 发送邮件
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('发送邮件时出错:', error);
        } else {
            console.log('邮件发送成功:', info.response);
        }
    });
}

ipcMain.handle('get-config', async () => {
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            return config;
        } catch (e) {
            return {};
        }
    }
    return {};
});

ipcMain.handle('set-config', async (event, newConfig) => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
        // 更新内存配置
        userDataDir = newConfig.userDataDir || '';
        mailSender = newConfig.mailSender || '';
        mailPassword = newConfig.mailPassword || '';
        mailRecipient = newConfig.mailRecipient || '';
        smtpServer = newConfig.smtpServer || '';
        smtpPort = newConfig.smtpPort || 0;
        return true;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('get-orders', async () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM orders ORDER BY order_time DESC', (err, rows) => {
            if (err) {
                resolve([]);
            } else {
                resolve(rows);
            }
        });
    });
}); 