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
let arrivalCounter = 0; // 新增：用于记录车辆到达顺序的计数器

// 动画时长配置
const ANIMATION_DURATION = {
    CAR_MOVE_TO_SLOT: 300,     // 车辆移动到车位
    PERSON_MOVE_TO_CAR: 100,   // 人移动到车上
    PERSON_QUEUE_SHIFT: 100,   // 人队列前移
    CAR_LEAVE: 300             // 车辆离场
};

// 数字与颜色的映射关系
const COLOR_MAP = {
    0: null,                // 无
    1: 0xff4d4f,            // 红
    2: 0x1890ff,            // 蓝
    3: 0xffe066,            // 黄
    4: 0x52c41a,            // 绿
    5: 0xfa8c16,            // 橙
    6: 0x722ed1,            // 紫
    7: 0x8c8c8c,            // 灰
    8: 0xffadd2,            // 粉
    9: 0x87e8de             // 浅蓝色
};

// 车辆初始矩阵（示例，实际应通过异步加载或import获取）
const initialMatrix = [
    [4, 7, 5, 7, 9, 6],
    [5, 7, 6, 4, 9, 9],
    [5, 9, 9, 9, 1, 4],
    [4, 7, 4, 5, 8, 8],
    [8, 1, 5, 5, 4, 3],
    [8, 8, 7, 1, 7, 7]
];

import level2 from './config/levels/level3.json';

// 预加载资源
function preload() {
    // 加载目标图片
    this.load.image('target', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
}

/**
 * 绘制一个"人"（圆形）
 * @param {Phaser.GameObjects.Graphics} graphics
 * @param {number} x 圆心x
 * @param {number} y 圆心y
 * @param {number} color 颜色（十六进制）
 * @param {number} size 直径
 */
function drawPerson(graphics, x, y, color, size) {
    graphics.fillStyle(color, 1);
    graphics.fillCircle(x, y, size / 2);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(x, y, size / 2);
}

/**
 * 绘制一个"车"（方形）
 * @param {Phaser.GameObjects.Graphics} graphics
 * @param {number} x 左上角x
 * @param {number} y 左上角y
 * @param {number} color 颜色（十六进制）
 * @param {number} size 边长
 * @param {number} capacity 容量
 */
function drawCar(graphics, x, y, color, size, capacity) {
    graphics.fillStyle(color, 1);
    graphics.fillRect(x, y, size, size);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeRect(x, y, size, size);
    
    // 显示容量
    if (capacity) {
        graphics.fillStyle(0xffffff, 0.7);
        graphics.fillCircle(x + size/2, y + size/2, size/4);
        // 不能使用setFontSize和fillText方法，这里只绘制圆形背景
    }
}

// 生成蛇形编号映射（支持mask挖空与自定义走向）
function getPeopleGridIndexMap(mask) {
    const rows = mask.length;
    const cols = mask[0].length;
    let map = [];
    let num = 1;
    let direction = 1; // 1: 左到右, -1: 右到左
    for (let row = rows - 1; row >= 0; row--) {
        // 收集本行所有mask为true的col索引
        let validCols = [];
        for (let col = 0; col < cols; col++) {
            if (mask[row][col]) validCols.push(col);
        }
        // 按当前方向遍历
        if (direction === 1) {
            for (let i = 0; i < validCols.length; i++) {
                map.push({ row, col: validCols[i], num });
                num++;
            }
        } else {
            for (let i = validCols.length - 1; i >= 0; i--) {
                map.push({ row, col: validCols[i], num });
                num++;
            }
        }
        // 只有本行有多个格子时才切换方向
        if (validCols.length > 1) direction *= -1;
    }
    return map;
}

// 新增：车辆和车位状态管理
let carGridState = []; // 车辆网格状态（二维数组）
let carSlotState = []; // 车位状态（长度为vacancy）
let carGraphicsGrid = []; // 车辆图形对象二维数组
let carSlotPositions = []; // 车位中心坐标
let isAnimating = false; // 动画锁

// 新增：车位车辆对象管理
let carSlotObjArr = []; // [{color, passenger, capacity, graphics, slotIdx}]
let peopleQueue = []; // [{color, graphics, idx}]
let peopleGridMap = [];
let peopleQueueStartPos = [];
let peopleQueueEndIdx = 0;

// 创建游戏场景
function create() {
    // 设置背景色
    this.cameras.main.setBackgroundColor('#b6e3b6');

    // 区域尺寸与格子参数
    const gridSize = 6;
    const carSlotCount = level2.vacancy; // 从关卡配置中读取车位数量
    const peopleCols = 6; // 上方6列
    const peopleRows = 5;
    const cellSize = 48;
    const margin = 20;

    // 计算各部分宽高
    const gridWidth = gridSize * cellSize;
    const gridHeight = gridSize * cellSize;
    const carSlotWidth = carSlotCount * cellSize;
    const carSlotHeight = cellSize;
    const peopleWidth = peopleCols * cellSize;
    const peopleHeight = peopleRows * cellSize;

    // 计算整体高度
    const totalHeight = peopleHeight + margin + carSlotHeight + margin + gridHeight;
    const totalWidth = Math.max(gridWidth, carSlotWidth, peopleWidth);

    // 居中起点
    const startX = (this.sys.game.config.width - totalWidth) / 2;
    let currentY = (this.sys.game.config.height - totalHeight) / 2;

    const graphics = this.add.graphics();

    // 1. 上部：6x5蛇形格子，部分挖空
    // true=显示，false=挖空
    const peopleMask = [
        [true, true, true, true, true, true],
        [true, false, false, false, false, false],
        [true, true, true, true, true, true],
        [false, false, false, false, false, true],
        [true, true, true, true, true, true],
    ];
    // 居中
    const peopleStartX = startX + (totalWidth - peopleWidth) / 2;
    // 先画白色底
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(peopleStartX, currentY, peopleWidth, peopleHeight, 10);

    // 生成编号映射
    peopleGridMap = getPeopleGridIndexMap(peopleMask);

    // 获取item_queue
    const itemQueue = level2.item_queue;
    peopleQueue = [];
    peopleQueueStartPos = [];
    peopleQueueEndIdx = 0;
    // 记录每个人的初始位置
    for (let i = 0; i < peopleGridMap.length; i++) {
        const { row, col } = peopleGridMap[i];
        let x = peopleStartX + col * cellSize + cellSize / 2;
        let y = currentY + row * cellSize + cellSize / 2;
        peopleQueueStartPos.push({ x, y });
    }
    // 初始化队列
    for (let i = 0; i < peopleGridMap.length && i < itemQueue.length; i++) {
        const color = COLOR_MAP[itemQueue[i]];
        if (!color) continue;
        const { x, y } = peopleQueueStartPos[i];
        const g = this.add.graphics();
        drawPerson(g, 0, 0, color, cellSize - 20);
        g.setPosition(x, y);
        g.setDepth(20);
        peopleQueue.push({ color, graphics: g, idx: i });
        peopleQueueEndIdx = i;
    }

    // 绘制蛇形格子，挖空部分用背景色覆盖，并在每个格子中心写编号和渲染人
    for (let row = 0; row < peopleRows; row++) {
        for (let col = 0; col < peopleCols; col++) {
            let x = peopleStartX + col * cellSize;
            let y = currentY + row * cellSize;
            if (!peopleMask[row][col]) {
                // 挖空：用背景色覆盖
                graphics.fillStyle(0xb6e3b6, 1);
                graphics.fillRect(x, y, cellSize, cellSize);
            } else {
                // 绘制格子边框
                graphics.lineStyle(1, 0xcccccc, 1);
                graphics.strokeRect(x, y, cellSize, cellSize);
                // 查找编号（顺序与蛇形一致）
                const grid = peopleGridMap.find(g => g.row === row && g.col === col);
                if (grid) {
                    // 显示编号
                    this.add.text(
                        x + cellSize - 4,
                        y + 4,
                        grid.num.toString(),
                        { fontSize: '12px', color: '#d4380d', fontStyle: 'bold', align: 'right' }
                    )
                    .setOrigin(1, 0)
                    .setAlpha(0.5);
                }
            }
        }
    }

    // 2. 中部：车位区（6个格子，横向排列），本身已居中
    currentY += peopleHeight + margin;
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(startX, currentY, carSlotWidth, carSlotHeight, 8);
    graphics.lineStyle(1, 0xcccccc, 1);
    for (let i = 0; i <= carSlotCount; i++) {
        graphics.lineBetween(
            startX + i * cellSize, currentY,
            startX + i * cellSize, currentY + carSlotHeight
        );
    }
    graphics.lineBetween(
        startX, currentY,
        startX + carSlotWidth, currentY
    );
    graphics.lineBetween(
        startX, currentY + carSlotHeight,
        startX + carSlotWidth, currentY + carSlotHeight
    );
    // 车位编号（右上角，半透明）
    for (let i = 0; i < carSlotCount; i++) {
        this.add.text(
            startX + (i + 1) * cellSize - 4, // 右上角
            currentY + 4,
            (i + 1).toString(),
            { fontSize: '12px', color: '#d4380d', fontStyle: 'bold', align: 'right' }
        )
        .setOrigin(1, 0)
        .setAlpha(0.5);
    }

    // 3. 下部：6x6车辆放置区，本身已居中
    currentY += carSlotHeight + margin;
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(startX, currentY, gridWidth, gridHeight, 12);
    graphics.lineStyle(1, 0xaaaaaa, 1);
    for (let i = 0; i <= gridSize; i++) {
        // 竖线
        graphics.lineBetween(
            startX + i * cellSize, currentY,
            startX + i * cellSize, currentY + gridHeight
        );
        // 横线
        graphics.lineBetween(
            startX, currentY + i * cellSize,
            startX + gridWidth, currentY + i * cellSize
        );
    }

    // 初始化车辆网格和车位状态
    const initialMatrix = level2.initial_matrix;
    carGridState = initialMatrix.map(row => row.slice());
    carSlotState = Array(carSlotCount).fill(0);
    carGraphicsGrid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(null));
    carSlotPositions = [];

    // 车位车辆对象管理
    carSlotObjArr = [];
    for (let i = 0; i < carSlotCount; i++) {
        carSlotObjArr.push({ 
            color: 0, 
            passenger: 0, 
            capacity: 0, 
            graphics: null, 
            slotIdx: i,
            arrivalTime: -1 // 新增：记录车辆到达顺序，-1表示空车位
        });
    }

    // 渲染车辆（用Phaser.GameObjects.Graphics对象，便于动画和高亮）
    const carMargin = 8;
    const carSize = cellSize - carMargin * 2;
    for (let row = 0; row < carGridState.length; row++) {
        for (let col = 0; col < carGridState[row].length; col++) {
            const carInfo = carGridState[row][col];
            if (!carInfo || carInfo[0] === 0) continue;
            const num = carInfo[0];
            const capacity = carInfo[1];
            const color = COLOR_MAP[num];
            if (!color) continue;
            const x = startX + carMargin + col * cellSize;
            const y = currentY + carMargin + row * cellSize;
            const carG = this.add.graphics();
            drawCar(carG, 0, 0, color, carSize, capacity);
            carG.setPosition(x, y);
            carG.setDepth(10);
            carG.capacity = capacity; // 存储容量
            carG.colorNum = num; // 存储颜色编号
            
            // 添加容量文本
            const capacityText = this.add.text(
                x + carSize/2,
                y + carSize/2,
                capacity.toString(),
                { fontSize: '14px', color: '#000000', fontStyle: 'bold' }
            ).setOrigin(0.5, 0.5).setDepth(15);
            carG.capacityText = capacityText;
            
            carG.setInteractive(new Phaser.Geom.Rectangle(0, 0, carSize, carSize), Phaser.Geom.Rectangle.Contains);
            carGraphicsGrid[row][col] = carG;
        }
    }

    // 记录车位中心坐标
    let slotY = currentY - margin - carSlotHeight + carSlotHeight / 2;
    for (let i = 0; i < carSlotCount; i++) {
        let slotX = startX + i * cellSize + cellSize / 2;
        carSlotPositions.push({ x: slotX, y: slotY });
    }

    // 可移动判定与高亮
    function updateCarMovable() {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const carG = carGraphicsGrid[row][col];
                if (!carG) continue;
                const carInfo = carGridState[row][col];
                if (!carInfo) continue;
                const num = carInfo[0];
                // 判定是否可移动
                let movable = false;
                if (carSlotState.includes(0)) {
                    if (row === 0) {
                        movable = true;
                    } else {
                        // 上下左右
                        const dirs = [
                            [0, 1], [0, -1], [1, 0], [-1, 0]
                        ];
                        for (const [dr, dc] of dirs) {
                            const nr = row + dr, nc = col + dc;
                            if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
                                if (!carGridState[nr][nc] || carGridState[nr][nc][0] === 0) {
                                    movable = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                // 高亮
                carG.clear();
                drawCar(carG, 0, 0, COLOR_MAP[num], carSize, carG.capacity);
                if (movable) {
                    carG.lineStyle(4, 0x000000, 1);
                    carG.strokeRect(0, 0, carSize, carSize);
                    carG.setInteractive();
                } else {
                    carG.disableInteractive();
                }
                carG.movable = movable;
            }
        }
    }

    // 车辆点击事件
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const carG = carGraphicsGrid[row][col];
            if (!carG) continue;
            carG.on('pointerdown', () => {
                if (isAnimating || !carG.movable) return;
                // 找到最小编号空车位
                const slotIdx = carSlotState.findIndex(v => v === 0);
                if (slotIdx === -1) return;
                isAnimating = true;
                // 目标位置
                const { x: toX, y: toY } = carSlotPositions[slotIdx];
                // 动画
                this.tweens.add({
                    targets: carG,
                    x: toX - carSize / 2,
                    y: toY - carSize / 2,
                    duration: ANIMATION_DURATION.CAR_MOVE_TO_SLOT,
                    onComplete: () => {
                        // 更新状态
                        const carInfo = carGridState[row][col];
                        carSlotState[slotIdx] = carInfo;
                        carGridState[row][col] = 0;
                        // 车位车辆对象
                        carSlotObjArr[slotIdx].color = carInfo[0];
                        carSlotObjArr[slotIdx].capacity = carInfo[1];
                        carSlotObjArr[slotIdx].passenger = 0;
                        carSlotObjArr[slotIdx].graphics = carG;
                        carSlotObjArr[slotIdx].arrivalTime = ++arrivalCounter; // 新增：记录到达顺序
                        
                        // 移动容量文本
                        if (carG.capacityText) {
                            carG.capacityText.destroy();
                        }
                        
                        // 修正：乘客数文本对象应挂在carSlotObjArr[slotIdx]上
                        if (carSlotObjArr[slotIdx].passengerText) {
                            carSlotObjArr[slotIdx].passengerText.destroy();
                        }
                        carG.clear();
                        drawCar(carG, 0, 0, COLOR_MAP[carInfo[0]], carSize);
                        // 显示乘客数（确保与对象绑定）
                        const passengerText = this.add.text(
                            toX, // 居中
                            toY, // 居中
                            `0/${carInfo[1]}`,
                            { fontSize: '18px', color: '#222', fontStyle: 'bold' }
                        ).setOrigin(0.5, 0.5).setDepth(30);
                        carSlotObjArr[slotIdx].passengerText = passengerText;
                        carG.passengerText = passengerText;
                        carG.disableInteractive();
                        carG.setDepth(5);
                        carGraphicsGrid[row][col] = null;
                        isAnimating = false;
                        updateCarMovable();
                        // 开始人上车流程
                        tryMovePeopleToCar.call(this);
                    }
                });
                
                // 同步移动容量文本
                if (carG.capacityText) {
                    this.tweens.add({
                        targets: carG.capacityText,
                        x: toX,
                        y: toY,
                        duration: ANIMATION_DURATION.CAR_MOVE_TO_SLOT
                    });
                }
            });
        }
    }

    // 初始高亮
    updateCarMovable();

    // 人上车主流程
    function tryMovePeopleToCar() {
        if (isAnimating) return;
        // 队首人
        const first = peopleQueue[0];
        if (!first) return;
        // 找到所有可上车的车位（颜色相同且乘客<容量）
        let candidates = carSlotObjArr.filter(obj => 
            obj.color && COLOR_MAP[obj.color] === first.color && obj.passenger < obj.capacity
        );
        if (candidates.length === 0) return;
        // 按到达顺序排序（先到的优先）
        candidates.sort((a, b) => {
            // 如果arrivalTime相同或都是-1，则按车位顺序
            if (a.arrivalTime === b.arrivalTime) {
                return a.slotIdx - b.slotIdx;
            }
            // 如果有一个是-1，它应该排在后面
            if (a.arrivalTime === -1) return 1;
            if (b.arrivalTime === -1) return -1;
            // 否则按到达顺序排序
            return a.arrivalTime - b.arrivalTime;
        });
        const car = candidates[0];
        isAnimating = true;
        // 动画：人移动到车上
        const toX = carSlotPositions[car.slotIdx].x;
        const toY = carSlotPositions[car.slotIdx].y;
        // 修正：移动前先destroy原图形，再新建一个人用于动画
        first.graphics.destroy();
        const movingPerson = this.add.graphics();
        drawPerson(movingPerson, 0, 0, first.color, cellSize - 20);
        movingPerson.setPosition(peopleQueueStartPos[0].x, peopleQueueStartPos[0].y);
        movingPerson.setDepth(21);
        this.tweens.add({
            targets: movingPerson,
            x: toX,
            y: toY,
            duration: ANIMATION_DURATION.PERSON_MOVE_TO_CAR,
            onComplete: () => {
                // 销毁人
                movingPerson.destroy();
                // 乘客数+1，更新显示
                car.passenger++;
                if (car.passengerText) {
                    car.passengerText.setText(`${car.passenger}/${car.capacity}`);
                    car.passengerText.setPosition(carSlotPositions[car.slotIdx].x, carSlotPositions[car.slotIdx].y);
                }
                if (car.graphics && car.graphics.passengerText) {
                    car.graphics.passengerText.setText(`${car.passenger}/${car.capacity}`);
                    car.graphics.passengerText.setPosition(carSlotPositions[car.slotIdx].x, carSlotPositions[car.slotIdx].y);
                }
                // 队列推进
                peopleQueue.shift();
                // 新人补尾
                peopleQueueEndIdx++;
                if (itemQueue && peopleQueueEndIdx < itemQueue.length) {
                    const color = COLOR_MAP[itemQueue[peopleQueueEndIdx]];
                    if (color) {
                        const { x, y } = peopleQueueStartPos[peopleQueue.length];
                        const g = this.add.graphics();
                        drawPerson(g, 0, 0, color, cellSize - 20);
                        g.setPosition(x, y);
                        g.setDepth(20);
                        peopleQueue.push({ color, graphics: g, idx: peopleQueueEndIdx });
                    }
                }
                // 队列整体前移动画
                let finishedCount = 0;
                for (let i = 0; i < peopleQueue.length; i++) {
                    // 移动前先destroy原图形，再新建一个人用于动画
                    const oldG = peopleQueue[i].graphics;
                    oldG.destroy();
                    const { x, y } = peopleQueueStartPos[i];
                    const g = this.add.graphics();
                    drawPerson(g, 0, 0, peopleQueue[i].color, cellSize - 20);
                    g.setPosition(oldG.x, oldG.y);
                    g.setDepth(20);
                    peopleQueue[i].graphics = g;
                    this.tweens.add({
                        targets: g,
                        x, y,
                        duration: ANIMATION_DURATION.PERSON_QUEUE_SHIFT,
                        onComplete: () => {
                            finishedCount++;
                            // 最后一个人移动完后，继续判断
                            if (finishedCount === peopleQueue.length) {
                                isAnimating = false;
                                // 车满则离场
                                if (car.passenger >= car.capacity) {
                                    carLeave.call(this, car);
                                } else {
                                    tryMovePeopleToCar.call(this);
                                }
                            }
                        }
                    });
                }
                // 如果队列为空，直接解锁
                if (peopleQueue.length === 0) isAnimating = false;
            }
        });
    }

    // 车满离场
    function carLeave(car) {
        if (!car.graphics) return;
        isAnimating = true;
        this.tweens.add({
            targets: car.graphics,
            y: car.graphics.y - 200,
            alpha: 0,
            duration: ANIMATION_DURATION.CAR_LEAVE,
            onComplete: () => {
                if (car.passengerText) car.passengerText.destroy();
                if (car.graphics && car.graphics.capacityText) car.graphics.capacityText.destroy();
                car.graphics.destroy();
                car.color = 0;
                car.passenger = 0;
                car.capacity = 0;
                car.graphics = null;
                car.passengerText = null;
                car.arrivalTime = -1; // 新增：重置到达时间
                carSlotState[car.slotIdx] = 0;
                isAnimating = false;
                updateCarMovable();
                tryMovePeopleToCar.call(this);
            }
        });
        
        // 同步处理容量文本
        if (car.graphics && car.graphics.capacityText) {
            this.tweens.add({
                targets: car.graphics.capacityText,
                y: car.graphics.y - 200,
                alpha: 0,
                duration: ANIMATION_DURATION.CAR_LEAVE
            });
        }
    }
}

// 更新游戏状态
function update() {
    // 这里可以添加更多游戏逻辑
} 