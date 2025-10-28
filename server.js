const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3006;
const publicDir = path.join(__dirname, 'public');

// 提供靜態檔案
app.use(express.static(publicDir));

// 主頁面路由
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`🚀 飛機射擊遊戲伺服器已啟動！`);
    console.log(`📡 請在瀏覽器開啟: http://localhost:${PORT}`);
    console.log(`⌨️  按 Ctrl+C 停止伺服器`);
});
