// -----------------------
// グローバル状態管理
// -----------------------
let currentBattery = 100;
let activeNotifications = [];
let spawnIntervalId = null;
let notificationIdCounter = 1;
let isClockStarted = false; // 時計の二重起動防止用
let clearedNotificationsCount = 0; // 処理した通知の累積カウント
let savedUserName = ""; // ユーザー名
let targetClearCount = 10; // クリアに必要な通知処理数（デフォルト10件）
let gameStartTime = 0; // ゲーム開始時刻（勤務時間の計測用）

// -----------------------
// 画面制御ロジック
// -----------------------
function startGame() {
    // 画面切り替え
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('clear-screen').classList.add('hidden');
    
    // リザルト演出のリセット
    document.querySelector('.phone-frame').classList.remove('clear-bg');
    
    // 難易度（通知ノルマ）の選択状態を確実に反映
    changeDifficulty();
    
    // ゲーム状態のリセット
    activeNotifications = [];
    notificationIdCounter = 1;
    clearedNotificationsCount = 0;
    gameStartTime = Date.now(); // 勤務時間の計測開始時刻を記録
    document.getElementById('notification-container').innerHTML = '';
    
    init(); // ゲームの初期化処理を開始
}

function showHowToPlay() {
    document.getElementById('how-to-play-screen').classList.remove('hidden');
}

function hideHowToPlay() {
    document.getElementById('how-to-play-screen').classList.add('hidden');
}

function backToTitle() {
    document.getElementById('clear-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
}

function toggleWallpaper() {
    const toggle = document.getElementById('wallpaper-toggle');
    const phoneFrame = document.querySelector('.phone-frame');
    if (toggle && phoneFrame) {
        if (toggle.checked) {
            phoneFrame.classList.remove('no-wallpaper');
        } else {
            phoneFrame.classList.add('no-wallpaper');
        }
    }
}

function changeDifficulty() {
    const select = document.getElementById('difficulty-select');
    targetClearCount = parseInt(select.value, 10);
    
    const msg = document.getElementById('difficulty-msg');
    if (msg) {
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 2000);
    }
}

function saveUsername() {
    const input = document.getElementById('username-input');
    const msg = document.getElementById('username-msg');
    savedUserName = input.value.trim();
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
}

// -----------------------
// 経過時間・フォーマット計算ロジック
// -----------------------
function calculateTimeAgo(createdAt) {
    const diffInSeconds = Math.floor((Date.now() - createdAt) / 1000);
    if (diffInSeconds < 60) return 'たった今';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}分前`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    return `${diffInHours}時間前`;
}

function formatElapsedTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}分${seconds}秒`;
}

function getDifficultyText(count) {
    switch (count) {
        case 5: return 'パート(5件)';
        case 10: return 'ノーマル(10件)';
        case 20: return 'フルタイム(20件)';
        default: return `カスタム(${count}件)`;
    }
}

// -----------------------
// ランダム通知生成ロジック
// -----------------------
function createRandomNotification() {
    const id = notificationIdCounter++;
    const createdAt = Date.now(); // 通知が生成された時刻を記録
    let types = ['missedCall', 'chat', 'calendar', 'overtime', 'email', 'expense', 'systemAlert', 'survey', 'health'];
    
    // 充電100%以上ならヘルスケア通知を出さない
    if (currentBattery >= 100) {
        types = types.filter(t => t !== 'health');
    }

    const selectedType = types[Math.floor(Math.random() * types.length)];
    const isSpecialCase = Math.random() < 0.5; // 分岐用のランダムフラグ
    const n = savedUserName ? `${savedUserName}さん、` : ''; // ユーザー名差し込み用

    switch (selectedType) {
        case 'missedCall': {
            const missedCount = Math.floor(Math.random() * 300) + 1;
            return {
                id,
                createdAt,
                appName: '電話',
                title: isSpecialCase ? `不在着信：社長 (${missedCount}件)` : `不在着信：上司 (${missedCount}件)`,
                icon: 'fa-phone',
                bgColor: 'bg-green-500',
                actions: isSpecialCase ? [
                    { label: '土下座しながらかけ直す', type: 'slave', damage: 20, msg: '首の皮一枚繋がりました。' },
                    { label: '退職届を準備する', type: 'rebel', damage: 30, msg: 'もう何も怖くありません。' }
                ] : [
                    { label: 'すぐかけ直す', type: 'slave', damage: 10, msg: '上司「遅い！どこほっつき歩いてた！」' },
                    { label: '電源を切る', type: 'rebel', damage: 20, msg: '物理的にシャットダウンしました。' }
                ]
            };
        }
        case 'chat': {
            return {
                id,
                createdAt,
                appName: '社内チャット',
                title: isSpecialCase ? `部長：${n}休日にごめん、これお願い` : `部長：${n}例の件、今日中によろしく`,
                icon: 'fa-comment-dots',
                bgColor: 'bg-blue-500',
                actions: isSpecialCase ? [
                    { label: '休日対応する', type: 'slave', damage: 10, msg: '貴重な休みが消滅しました。' },
                    { label: '月曜に見る', type: 'rebel', damage: 25, msg: '週末の平穏を守り抜きました。' }
                ] : [
                    { label: '「承知いたしました」', type: 'slave', damage: 15, msg: '終電コースが確定しました。' },
                    { label: 'スタンプのみ返す', type: 'rebel', damage: 25, msg: '部長がブチギレています。' }
                ]
            };
        }
        case 'calendar': {
            const hour = Math.floor(Math.random() * 5) + 1;
            return {
                id,
                createdAt,
                appName: 'カレンダー',
                title: isSpecialCase ? `このあと ${hour}:00 役員報告会` : `このあと ${hour}:00 緊急会議(任意)`,
                icon: 'fa-calendar',
                bgColor: 'bg-red-500',
                actions: isSpecialCase ? [
                    { label: '準備して挑む', type: 'slave', damage: 20, msg: '胃に穴が開きそうです。' },
                    { label: 'すっぽかす', type: 'rebel', damage: 30, msg: '伝説の社員になりました。' }
                ] : [
                    { label: '急いで参加する', type: 'slave', damage: 10, msg: '業務時間外でした。(無給)' },
                    { label: '仮病を使う', type: 'rebel', damage: 15, msg: '「腹痛のため休みます」と連絡しました。' }
                ]
            };
        }
        case 'overtime': {
            const hours = Math.floor(Math.random() * 100);
            const mins = Math.floor(Math.random() * 100);
            const hoursStr = hours.toString().padStart(2, '0');
            const minsStr = mins.toString().padStart(2, '0');
            const isHighOvertime = hours >= 45;
            const targetName = savedUserName ? `${savedUserName}の` : '今月の';

            return {
                id,
                createdAt,
                appName: '勤怠管理',
                title: `${targetName}残業時間：${hoursStr}時間${minsStr}分`,
                icon: 'fa-stopwatch',
                bgColor: 'bg-yellow-500',
                actions: isHighOvertime ? [
                    { label: '見なかったことにする', type: 'slave', damage: 5, msg: '次は労基に連絡します。' },
                    { label: '労基の番号を検索', type: 'rebel', damage: 20, msg: '「まだ早い」と怒られました。' }
                ] : [
                    { label: '確認する', type: 'slave', damage: 5, msg: '勤怠を確認しました。' },
                    { label: '少しだけ残業をつける', type: 'rebel', damage: 10, msg: '塵も積もれば山となります。' }
                ]
            };
        }
        case 'email': {
            const count = (Math.floor(Math.random() * 2000) + 100).toLocaleString();
            return {
                id,
                createdAt,
                appName: 'メール',
                title: isSpecialCase ? `未読 ${count}件(重要あり)` : `未読 ${count}件`,
                icon: 'fa-envelope',
                bgColor: 'bg-blue-400',
                actions: isSpecialCase ? [
                    { label: '重要メールだけ探す', type: 'slave', damage: 10, msg: '目がかすんできました。' },
                    { label: 'すべて迷惑メールへ', type: 'rebel', damage: 25, msg: '重大な損失が発生した予感がします。' }
                ] : [
                    { label: '上から順に処理する', type: 'slave', damage: 15, msg: '果てしない作業が続きます。' },
                    { label: 'すべて削除する', type: 'rebel', damage: 20, msg: '大事なメールも消え去りました。' }
                ]
            };
        }
        case 'expense': {
            return {
                id,
                createdAt,
                appName: '経費精算',
                title: isSpecialCase ? '高額な経費申請が却下されました' : '経費申請が却下されました',
                icon: 'fa-receipt',
                bgColor: 'bg-purple-500',
                actions: isSpecialCase ? [
                    { label: '泣く泣く自腹', type: 'slave', damage: 30, msg: '今月の生活費が尽きました。' },
                    { label: '会社に直接抗議', type: 'rebel', damage: 30, msg: 'しばらく出入り禁止になりました。' }
                ] : [
                    { label: '自腹で支払う', type: 'slave', damage: 25, msg: '財布と精神に痛手を受けました。' },
                    { label: '経理に直談判する', type: 'rebel', damage: 20, msg: '経理部を全般的に敵に回しました。' }
                ]
            };
        }
        case 'systemAlert': {
            return {
                id,
                createdAt,
                appName: 'システムアラート',
                title: isSpecialCase ? '【超緊急】サーバーダウン' : '【緊急】大規模なシステム障害発生！',
                icon: 'fa-triangle-exclamation',
                bgColor: 'bg-red-600',
                actions: isSpecialCase ? [
                    { label: '叩き起こされて対応', type: 'slave', damage: 35, msg: '睡眠時間が消滅しました。' },
                    { label: 'スマホの電源を切る', type: 'rebel', damage: 20, msg: '朝起きたら大変なことになっていました。' }
                ] : [
                    { label: '休日出勤して復旧', type: 'slave', damage: 30, msg: '大事な休日が全滅しました。' },
                    { label: '担当外と言い張る', type: 'rebel', damage: 15, msg: '責任転嫁に成功しました。' }
                ]
            };
        }
        case 'health': {
            return {
                id,
                createdAt,
                appName: 'ヘルスケア',
                title: isSpecialCase ? '心拍数が異常です。休息を！' : '長時間の作業が続いています',
                icon: 'fa-heart-pulse',
                bgColor: 'bg-pink-500',
                actions: isSpecialCase ? [
                    { label: '救急車を呼ぶ', type: 'slave', damage: 0, msg: '一命を取り留めました。' },
                    { label: '気合いで乗り切る', type: 'rebel', damage: 20, msg: '限界を超えました。' }
                ] : [
                    { label: 'エナドリを飲む', type: 'rebel', damage: -60, msg: 'カフェインを入れて気力を回復しました！' },
                    { label: '無視して働く', type: 'slave', damage: 10, msg: '過労一直線です。' }
                ]
            };
        }
        default: {
            return {
                id,
                createdAt,
                appName: '人事部',
                title: isSpecialCase ? `【要出頭】${n}人事面談のお知らせ` : '【要回答】従業員満足度アンケート',
                icon: 'fa-clipboard-list',
                bgColor: 'bg-teal-500',
                actions: isSpecialCase ? [
                    { label: 'おとなしく面談に行く', type: 'slave', damage: 20, msg: 'みっちり絞られました。' },
                    { label: '無断欠席する', type: 'rebel', damage: 30, msg: '退職へのカウントダウンが始まりました。' }
                ] : [
                    { label: '最高評価を連打', type: 'slave', damage: 5, msg: '会社への忠誠(嘘)を誓いました。' },
                    { label: '本音の不満を全回答', type: 'rebel', damage: 25, msg: '後日、別室へ呼び出しが決定しました。' }
                ]
            };
        }
    }
}

// -----------------------
// 初期化・タイマー開始
// -----------------------
window.onload = () => {
    setRandomDate();
    startClock();
    isClockStarted = true;
};

function init() {
    setRandomDate();
    setRandomBattery();
    
    if (!isClockStarted) {
        startClock();
        isClockStarted = true;
    }

    startNotificationSpawner();
}

function startNotificationSpawner() {
    if (spawnIntervalId) clearInterval(spawnIntervalId);
    spawnIntervalId = setInterval(() => {
        if (currentBattery <= 0) return;

        if (activeNotifications.length >= 50) {
            showGameOverScreen('overflow');
            return;
        }

        const newNotif = createRandomNotification();
        activeNotifications.unshift(newNotif); // 先頭に追加
        renderNotifications();
    }, 2500);
}

function setRandomDate() {
    const dateDisplay = document.getElementById('date-display');
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1; 
    const daysOfWeek = ['(日)', '(月)', '(火)', '(水)', '(木)', '(金)', '(土)'];
    const randomDayOfWeek = daysOfWeek[Math.floor(Math.random() * daysOfWeek.length)];

    dateDisplay.textContent = `${month}月${day}日 ${randomDayOfWeek}`;
}

function setRandomBattery() {
    currentBattery = Math.floor(Math.random() * 100) + 1;
    updateBatteryDisplay(currentBattery);
}

function updateBatteryDisplay(percent) {
    const batteryText = document.getElementById('battery-text');
    const batteryIcon = document.getElementById('battery-icon');

    if (!batteryText || !batteryIcon) return;

    batteryText.textContent = `${percent}%`;

    batteryIcon.className = 'fa-solid text-lg';
    batteryText.classList.remove('text-red-500');

    if (percent > 80) {
        batteryIcon.classList.add('fa-battery-full');
    } else if (percent > 50) {
        batteryIcon.classList.add('fa-battery-three-quarters');
    } else if (percent > 25) {
        batteryIcon.classList.add('fa-battery-half');
    } else if (percent > 10) {
        batteryIcon.classList.add('fa-battery-quarter', 'text-red-500');
        batteryText.classList.add('text-red-500');
    } else {
        batteryIcon.classList.add('fa-battery-empty', 'text-red-500');
        batteryText.classList.add('text-red-500');
    }
}

function startClock() {
    const timeDisplay = document.getElementById('time-display');
    
    function update() {
        const now = new Date();
        const hours = now.getHours().toString();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeDisplay.textContent = `${hours}:${minutes}`;
    }
    
    update();
    setInterval(update, 1000);
}

// -----------------------
// UI描画・インタラクション
// -----------------------
function renderNotifications() {
    const container = document.getElementById('notification-container');
    container.innerHTML = '';

    activeNotifications.sort((a, b) => b.createdAt - a.createdAt);

    activeNotifications.forEach(notif => {
        const card = document.createElement('div');
        card.className = `glass-card p-3 text-white shrink-0`;
        card.id = `notif-${notif.id}`;
        // アクションボタンがない場合はカーソルをデフォルト（指マークにしない）にする
        if (!notif.actions || notif.actions.length === 0) {
            card.style.cursor = 'default';
        }
        card.onclick = () => toggleExpand(notif.id);

        const mainContent = document.createElement('div');
        mainContent.className = 'flex items-center gap-3';
        mainContent.innerHTML = `
            <div class="w-10 h-10 rounded-xl ${notif.bgColor} flex items-center justify-center shrink-0 shadow">
                <i class="fa-solid ${notif.icon} text-lg text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-bold tracking-wide text-white">${notif.appName}</span>
                    <span class="text-[10px] text-gray-300 ml-2 shrink-0">${calculateTimeAgo(notif.createdAt)}</span>
                </div>
                <div class="text-xs font-medium text-gray-100 mt-0.5 leading-snug break-words">${notif.title}</div>
            </div>
        `;

        const actionsArea = document.createElement('div');
        actionsArea.className = 'actions-area flex gap-2';
        
        if (notif.actions) {
            notif.actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = `flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                    action.type === 'slave' 
                    ? 'bg-blue-600/80 hover:bg-blue-500' 
                    : 'bg-red-600/80 hover:bg-red-500'
                }`;
                btn.textContent = action.label;
                
                btn.onclick = (e) => {
                    e.stopPropagation();
                    
                    // クリア通知のボタンアクション分岐
                    if (notif.isSpecialClear) {
                        showToast(action.msg);
                        setTimeout(() => {
                            if (action.actionId === 'restart') {
                                startGame();
                            } else {
                                document.getElementById('notification-container').innerHTML = '';
                                backToTitle();
                            }
                        }, 500);
                    } else {
                        handleAction(notif.id, action.msg, action.damage, action.type);
                    }
                };
                
                actionsArea.appendChild(btn);
            });
        }

        card.appendChild(mainContent);
        card.appendChild(actionsArea);
        
        container.appendChild(card);
    });
}

function toggleExpand(id) {
    // 通知データを取得し、アクションボタンがない場合は開かない（無反応にする）
    const notif = activeNotifications.find(n => n.id === id);
    if (!notif || !notif.actions || notif.actions.length === 0) return;

    const card = document.getElementById(`notif-${id}`);
    if (!card) return;
    
    document.querySelectorAll('.glass-card.expanded').forEach(el => {
        if (el.id !== `notif-${id}`) {
            el.classList.remove('expanded');
        }
    });

    card.classList.toggle('expanded');
}

function handleAction(id, message, damage = 10, actionType = 'slave') {
    const card = document.getElementById(`notif-${id}`);
    if (!card) return;

    currentBattery = Math.min(100, Math.max(0, currentBattery - damage));
    updateBatteryDisplay(currentBattery);

    card.classList.add('slide-out-right');
    showToast(message);

    setTimeout(() => {
        card.remove();
        activeNotifications = activeNotifications.filter(n => n.id !== id);
        clearedNotificationsCount++;

        if (currentBattery <= 0) {
            showGameOverScreen('battery');
        } else if (clearedNotificationsCount >= targetClearCount && activeNotifications.length === 0) {
            showClearScreen();
        }
    }, 400);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function showGameOverScreen(reason = 'battery') {
    if (spawnIntervalId) clearInterval(spawnIntervalId);

    const clearScreen = document.getElementById('clear-screen');
    const icon = document.getElementById('end-icon');
    const title = document.getElementById('end-title');
    const desc = document.getElementById('end-desc');

    if (reason === 'battery') {
        icon.className = 'fa-solid fa-battery-empty text-6xl mb-4 text-red-500';
        title.textContent = '電源切れ';
        desc.textContent = 'バッテリーが切れ、音信不通になりました...';
    } else if (reason === 'overflow') {
        icon.className = 'fa-solid fa-dumpster-fire text-6xl mb-4 text-yellow-500';
        title.textContent = '処理落ち';
        desc.textContent = '通知が溜まりすぎて熱暴走しました...';
    }

    clearScreen.classList.remove('hidden');
}

function showClearScreen() {
    if (spawnIntervalId) clearInterval(spawnIntervalId);

    // リザルト演出：壁紙をクリア専用に切り替え、日付を MISSION CLEAR に変更
    document.querySelector('.phone-frame').classList.add('clear-bg');
    document.getElementById('date-display').textContent = 'MISSION CLEAR';

    const baseTime = Date.now();
    const elapsedTime = formatElapsedTime(baseTime - gameStartTime);
    const difficultyText = getDifficultyText(targetClearCount);

    // 1. ユーザー名通知 (設定時のみ)
    if (savedUserName) {
        activeNotifications.push({
            id: 'result-user-' + baseTime,
            createdAt: baseTime,
            appName: '社員情報',
            title: `担当者：${savedUserName} 様`,
            icon: 'fa-user',
            bgColor: 'bg-blue-500',
            actions: []
        });
    }

    // 2. 勤務時間通知
    activeNotifications.push({
        id: 'result-time-' + baseTime,
        createdAt: baseTime + 100,
        appName: '勤務実績',
        title: `勤務時間：${elapsedTime}`,
        icon: 'fa-stopwatch',
        bgColor: 'bg-amber-500',
        actions: []
    });

    // 3. 難易度通知
    activeNotifications.push({
        id: 'result-diff-' + baseTime,
        createdAt: baseTime + 200,
        appName: '難易度',
        title: `難易度：${difficultyText}`,
        icon: 'fa-layer-group',
        bgColor: 'bg-purple-500',
        actions: []
    });

    // 4. MISSION CLEAR 通知 (最後に配信されるため、1番上に表示される)
    const clearNotif = {
        id: 'clear-' + baseTime,
        createdAt: baseTime + 300,
        appName: 'システム管理',
        title: 'MISSION CLEAR! すべての通知を捌き切りました！',
        icon: 'fa-circle-check',
        bgColor: 'bg-green-500',
        isSpecialClear: true, // クリア通知判定フラグ
        actions: [
            { label: 'もう一度遊ぶ', type: 'slave', msg: '再起動します...', actionId: 'restart' },
            { label: 'タイトルに戻る', type: 'rebel', msg: 'お疲れ様でした。', actionId: 'title' }
        ]
    };

    activeNotifications.push(clearNotif);
    renderNotifications();
}
