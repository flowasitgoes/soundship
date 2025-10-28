const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3006;

// 提供靜態檔案
app.use(express.static(path.join(__dirname)));

// 主頁面路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`🚀 飛機射擊遊戲伺服器已啟動！`);
    console.log(`📡 請在瀏覽器開啟: http://localhost:${PORT}`);
    console.log(`⌨️  按 Ctrl+C 停止伺服器`);
});

