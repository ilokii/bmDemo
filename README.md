# 2D游戏Demo

这是一个使用Phaser.js开发的简单2D游戏Demo。

## 功能特点

- 点击交互
- 分数系统
- 响应式设计
- 物理引擎支持

## 开发环境设置

1. 安装依赖：
```bash
npm install
```

2. 启动开发服务器：
```bash
npm start
```

3. 构建生产版本：
```bash
npm run build
```

## 项目结构

```
├── src/            # 源代码
│   ├── game.js     # 游戏主逻辑
│   └── scenes/     # 游戏场景
├── assets/         # 游戏资源
│   ├── images/     # 图片资源
│   └── audio/      # 音频资源
├── dist/           # 构建输出
└── docs/           # 文档
```

## 部署

本项目可以部署到Cloudflare Pages：

1. 将代码推送到GitHub仓库
2. 在Cloudflare Pages中连接仓库
3. 配置构建设置：
   - 构建命令：`npm run build`
   - 输出目录：`dist`

## 技术栈

- Phaser.js 3.60.0
- Vite
- HTML5
- CSS3
- JavaScript 