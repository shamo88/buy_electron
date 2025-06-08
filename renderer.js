let refreshTimer = null;

document.getElementById('startBtn').onclick = () => {
    if (window.api && window.api.startLoginDriver) {
        window.api.startLoginDriver();
    }
};

document.getElementById('searchBtn').onclick = async () => {
    const keyword = document.getElementById('keyword').value;
    const matchKeyword = document.getElementById('matchKeyword').value;
    const refreshInterval = parseInt(document.getElementById('refreshInterval').value, 10) || 10;

    if (refreshTimer) clearInterval(refreshTimer);

    async function doSearch() {
        console.log('定时刷新，keyword:', keyword, 'matchKeyword:', matchKeyword);
        try {
            const results = await window.api.searchJD(keyword, matchKeyword);
            console.log('API返回结果:', results);
            const ul = document.getElementById('result');
            ul.innerHTML = '';
            results.forEach(item => {
                const li = document.createElement('li');
                li.className = 'product-item';
                const matched = item.name.includes(matchKeyword);
                li.innerHTML = `
                    <div class="product-title">${item.name}</div>
                    <div class="product-link"><a href="https:${item.href}" target="_blank">${item.href}</a></div>
                    <div class="product-sku">SKU: ${item.sku}</div>
                    <div class="status-label ${matched ? 'matched' : 'not-matched'}">
                        ${matched ? '匹配' : '不匹配'}
                    </div>
                `;
                ul.appendChild(li);
            });
            console.log('渲染完成');
        } catch (e) {
            console.error('搜索或渲染出错:', e);
        }
    }

    doSearch();
    refreshTimer = setInterval(doSearch, refreshInterval * 1000);
};

document.getElementById('stopBtn').onclick = () => {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
        console.log('定时刷新已停止');
    }
    // 通知主进程关闭msedgedriver
    if (window.api && window.api.closeEdgeDriver) {
        window.api.closeEdgeDriver();
    }
};

// 设置弹窗逻辑
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsForm = document.getElementById('settingsForm');
const settingsCancelBtn = document.getElementById('settingsCancelBtn');

settingsBtn.onclick = async () => {
    // 获取配置并填充表单
    if (window.api && window.api.getConfig) {
        const config = await window.api.getConfig();
        document.getElementById('set_userDataDir').value = config.userDataDir || '';
        document.getElementById('set_mailSender').value = config.mailSender || '';
        document.getElementById('set_mailPassword').value = config.mailPassword || '';
        document.getElementById('set_mailRecipient').value = config.mailRecipient || '';
        document.getElementById('set_smtpServer').value = config.smtpServer || '';
        document.getElementById('set_smtpPort').value = config.smtpPort || '';
    }
    settingsModal.style.display = 'flex';
};
settingsCancelBtn.onclick = () => {
    settingsModal.style.display = 'none';
};
settingsForm.onsubmit = async (e) => {
    e.preventDefault();
    const newConfig = {
        userDataDir: document.getElementById('set_userDataDir').value,
        mailSender: document.getElementById('set_mailSender').value,
        mailPassword: document.getElementById('set_mailPassword').value,
        mailRecipient: document.getElementById('set_mailRecipient').value,
        smtpServer: document.getElementById('set_smtpServer').value,
        smtpPort: Number(document.getElementById('set_smtpPort').value)
    };
    if (window.api && window.api.setConfig) {
        await window.api.setConfig(newConfig);
    }
    settingsModal.style.display = 'none';
    alert('配置已保存');
};

// 订单记录弹窗逻辑
const ordersBtn = document.getElementById('ordersBtn');
const ordersModal = document.getElementById('ordersModal');
const ordersCloseBtn = document.getElementById('ordersCloseBtn');
const ordersTableBody = document.getElementById('ordersTableBody');
const ordersSearchInput = document.getElementById('ordersSearchInput');
const ordersSearchBtn = document.getElementById('ordersSearchBtn');
const ordersPagination = document.getElementById('ordersPagination');

let ordersPage = 1;
let ordersPageSize = 10;
let ordersKeyword = '';

async function loadOrders(page = 1, keyword = '') {
    if (window.api && window.api.getOrders) {
        const { total, data } = await window.api.getOrders({ page, pageSize: ordersPageSize, keyword });
        ordersTableBody.innerHTML = '';
        if (data.length === 0) {
            ordersTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;">暂无订单</td></tr>';
        } else {
            for (const order of data) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td style="padding:6px 8px; border-bottom:1px solid #eee;">${order.name}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #eee;">${order.sku}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #eee;">${order.order_time.replace('T', ' ').replace(/\..*$/, '')}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #eee;">${order.status || ''}</td>
        `;
                ordersTableBody.appendChild(tr);
            }
        }
        // 分页
        const totalPages = Math.ceil(total / ordersPageSize);
        ordersPagination.innerHTML = '';
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.style.margin = '0 2px';
                if (i === page) {
                    btn.style.background = '#1976d2';
                    btn.style.color = '#fff';
                }
                btn.onclick = () => {
                    ordersPage = i;
                    loadOrders(ordersPage, ordersKeyword);
                };
                ordersPagination.appendChild(btn);
            }
        }
    }
}

ordersBtn.onclick = () => {
    ordersPage = 1;
    ordersKeyword = '';
    ordersSearchInput.value = '';
    loadOrders(ordersPage, ordersKeyword);
    ordersModal.style.display = 'flex';
};
ordersCloseBtn.onclick = () => {
    ordersModal.style.display = 'none';
};
ordersSearchBtn.onclick = () => {
    ordersPage = 1;
    ordersKeyword = ordersSearchInput.value.trim();
    loadOrders(ordersPage, ordersKeyword);
};
ordersSearchInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
        ordersPage = 1;
        ordersKeyword = ordersSearchInput.value.trim();
        loadOrders(ordersPage, ordersKeyword);
    }
}; 