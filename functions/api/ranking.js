// ③ レートリミット用のIP記録マップ
const ipRequests = new Map();

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const difficulty = url.searchParams.get('difficulty') || '5';

    try {
        const { results } = await env.DB.prepare(`
            SELECT username, clear_time_str as clearTimeStr, start_battery as startBattery, end_battery as endBattery, is_clear as isClear, cleared_count as clearedCount
            FROM ranking
            WHERE difficulty = ?
            ORDER BY is_clear DESC, clear_time_seconds ASC, end_battery DESC, cleared_count DESC
            LIMIT 100
        `).bind(difficulty).all();

        return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    // ③ レートリミット処理（IPアドレスごとの制限）
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    
    if (ipRequests.has(ip)) {
        const lastRequestTime = ipRequests.get(ip);
        if (now - lastRequestTime < 1000) { // 1秒以内の連続送信をブロック
            return new Response(JSON.stringify({ error: "リクエストが多すぎます。少し待ってからお試しください" }), { status: 429 });
        }
    }
    ipRequests.set(ip, now);
    
    // メモリ肥大化防止のため定期的にクリア
    if (ipRequests.size > 1000) ipRequests.clear();

    try {
        const body = await request.json();
        const { difficulty, username, clearTimeSeconds, clearTimeStr, startBattery, endBattery, clearedCount, isClear, signature } = body;

        // ① バリデーションチェック
        if (typeof clearTimeSeconds !== 'number' || clearTimeSeconds < 12.5) {
            return new Response(JSON.stringify({ error: "不正なクリア時間です" }), { status: 400 });
        }
        if (username && username.length > 10) {
            return new Response(JSON.stringify({ error: "ユーザー名が長すぎます" }), { status: 400 });
        }

        const safeUsername = (username || '名無し').trim().substring(0, 10);

        // ② ハッシュ値（署名）の検証
        const SECRET_KEY = "notif_survival_secret";
        const message = `${difficulty}-${safeUsername}-${clearTimeSeconds}-${clearedCount}-${SECRET_KEY}`;
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (signature !== expectedSignature) {
            return new Response(JSON.stringify({ error: "データの改ざんを検知しました" }), { status: 403 });
        }

        await env.DB.prepare(`
            INSERT INTO ranking (difficulty, username, clear_time_seconds, clear_time_str, start_battery, end_battery, cleared_count, is_clear)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            difficulty || '5',
            safeUsername,
            clearTimeSeconds || 0,
            clearTimeStr || '00分00秒',
            startBattery || 100,
            endBattery || 0,
            clearedCount || 0,
            isClear ? 1 : 0
        ).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
