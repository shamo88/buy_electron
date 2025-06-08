const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// 读取配置
const configPath = path.join(__dirname, 'config.json');
let mailSender = '592334843@qq.com';
let mailPassword = 'loztojpcriabbeef';
let mailRecipient = '13632472225@163.com';
if (fs.existsSync(configPath)) {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.mailSender) mailSender = config.mailSender;
        if (config.mailPassword) mailPassword = config.mailPassword;
        if (config.mailRecipient) mailRecipient = config.mailRecipient;
    } catch (e) { }
}

function sendMail(products, recipient = mailRecipient) {
    // 邮件服务器配置
    const smtp_server = "smtp.qq.com";
    const smtp_port = 587;
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

// 测试调用
sendMail([
    { name: "测试商品1", sku: "123456" },
    { name: "测试商品2", sku: "654321" }
]); 