# 飛機射擊遊戲 ✈️

一個使用 HTML、CSS 和 JavaScript 開發的簡單飛機射擊遊戲。

## 功能特色

- 🎮 使用鍵盤控制戰機移動和射擊
- 🎯 擊落敵機獲得分數
- 💥 碰撞檢測系統
- ⭐ 動態星空背景
- 📊 即時分數顯示
- 🎨 現代化美觀的 UI 設計

## 遊戲玩法

- **左右方向鍵**：移動戰機
- **空白鍵**：發射子彈
- **目標**：擊落盡可能多的敵機，避免與敵機碰撞

## 安裝與執行

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動伺服器

```bash
npm start
```

或使用開發模式（自動重新載入）：

```bash
npm run dev
```

### 3. 開始遊戲

在瀏覽器中開啟 `http://localhost:3000`

## 技術棧

- **前端**：HTML5 Canvas、CSS3、JavaScript
- **後端**：Node.js、Express
- **遊戲引擎**：原生 JavaScript (requestAnimationFrame)

## 專案結構

```
cursorGame/
├── index.html      # 遊戲主頁面
├── style.css       # 遊戲樣式
├── game.js         # 遊戲邏輯
├── server.js       # Express 伺服器
├── package.json    # 專案設定
└── README.md       # 說明文件
```

## 遊戲設計

### 玩家戰機
- 綠色三角形戰機
- 可左右移動
- 可發射金色子彈

### 敵機
- 紅色三角形敵機
- 從上方隨機生成
- 逐漸向下移動

### 計分系統
- 每擊落一架敵機得 10 分
- 遊戲結束時顯示最終分數

## 開發說明

如需修改遊戲配置，可編輯 `game.js` 中的 `CONFIG` 物件：

- `player.speed`：玩家移動速度
- `bullet.speed`：子彈速度
- `enemy.speed`：敵機速度
- `enemy.spawnRate`：敵機生成頻率

## License

MIT

# soundship
