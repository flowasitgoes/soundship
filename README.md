# 吉他音波遊戲 ✈️🎵

一個使用 HTML、CSS 和 JavaScript 開發的音樂主題吉他音波遊戲。

## 功能特色

- 🎮 使用鍵盤控制吉他戰機移動和射擊
- 🎵 射擊音符子彈（全音符、二分音符、四分音符、八分音符、十六分音符）
- 🎯 擊落敵機（石頭和水晶）獲得分數
- 💥 碰撞檢測系統
- ⭐ 動態星空背景
- 📊 即時分數顯示
- ❤️ 生命值系統（5 條命）
- 🎨 現代化美觀的 UI 設計

## 遊戲玩法

- **左右方向鍵 / A/D**：左右移動戰機
- **上下方向鍵 / W/S**：上下移動戰機
- **空白鍵**：發射音符子彈
  - 靜止或上下移動：發射普通/曲線音符
  - 左右移動：發射散射音符
  - 連續射擊速度會動態變化
- **目標**：擊落盡可能多的敵機，避免與敵機碰撞

## 本地開發

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

在瀏覽器中開啟 `http://localhost:3006`

## 部署到 Vercel

### 方法一：使用 Vercel CLI

```bash
# 安裝 Vercel CLI
npm install -g vercel

# 登入 Vercel
vercel login

# 部署
vercel
```

### 方法二：使用 Git 集成

1. 將專案推送到 GitHub
2. 在 [Vercel Dashboard](https://vercel.com/dashboard) 導入專案
3. Vercel 會自動檢測配置並部署

### 環境變數（可選）

在 Vercel Dashboard 中可以設置：
- `PORT`：伺服器端口（默認 3006）

## 專案結構

```
cursorGame/
├── public/                 # 靜態文件目錄
│   ├── index.html         # 遊戲主頁面
│   ├── style.css          # 遊戲樣式
│   └── game.js            # 遊戲邏輯（含音符系統）
├── server.js              # Express 伺服器
├── package.json           # 專案設定
├── vercel.json            # Vercel 部署配置
├── .vercelignore          # Vercel 忽略文件
└── README.md              # 說明文件
```

## 技術棧

- **前端**：HTML5 Canvas、CSS3、JavaScript (ES6+)
- **後端**：Node.js、Express
- **部署**：Vercel
- **遊戲引擎**：原生 JavaScript (requestAnimationFrame)

## 遊戲設計

### 玩家戰機
- 吉他造型設計
- 完整的琴身、琴頸、琴頭、琴弦
- 四向移動控制

### 音符子彈系統
- **全音符** (whole) - 空心，無符干
- **二分音符** (half) - 空心，有符干
- **四分音符** (quarter) - 實心，有符干
- **八分音符** (eighth) - 實心，有符干和一個符尾
- **十六分音符** (sixteenth) - 實心，有符干和兩個符尾

子彈速度會根據連續射擊次數動態變化（正弦波節奏）

### 敵機系統
- **石頭型**：隨機多邊形、表面刮痕效果
- **水晶型**：幾何形狀、內部切面、閃爍光點
- 6 種隨機顏色
- 隨機大小和長寬比

### 計分系統
- 每擊落一架敵機得 10 分
- 遊戲結束時顯示最終分數

## 開發說明

如需修改遊戲配置，可編輯 `public/game.js` 中的 `CONFIG` 物件：

- `player.speed`：玩家移動速度
- `bullet.speed`：子彈基礎速度
- `bullet.speedVariation`：子彈速度變化範圍
- `enemy.speed`：敵機速度
- `enemy.spawnRate`：敵機生成頻率
- `lives.hearts`：生命值數量

## License

MIT
