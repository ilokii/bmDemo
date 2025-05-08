// 游戏配置
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// 创建游戏实例
const game = new Phaser.Game(config);

// 游戏变量
let score = 0;
let scoreText;
let target;

// 预加载资源
function preload() {
    // 加载目标图片
    this.load.image('target', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
}

// 创建游戏场景
function create() {
    // 创建分数文本
    scoreText = this.add.text(16, 16, '分数: 0', { 
        fontSize: '32px', 
        fill: '#000' 
    });

    // 创建目标
    target = this.physics.add.sprite(400, 300, 'target');
    target.setInteractive();
    target.setScale(0.5);

    // 添加点击事件
    target.on('pointerdown', () => {
        score += 1;
        scoreText.setText('分数: ' + score);
        
        // 随机移动目标位置
        target.x = Phaser.Math.Between(100, 700);
        target.y = Phaser.Math.Between(100, 500);
    });
}

// 更新游戏状态
function update() {
    // 这里可以添加更多游戏逻辑
} 