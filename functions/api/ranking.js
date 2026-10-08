export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const difficulty = url.searchParams.get('difficulty') || '5';

    try {
        const { results } = await env.DB.prepare(`
            SELECT username, clear_time_str as clearTimeStr, end_battery as endBattery, is_clear as isClear
            FROM ranking
            WHERE difficulty = ?
            ORDER BY is_clear DESC, clear_time_seconds ASC, end_battery DESC
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

    try {
        const body = await request.json();
        const { difficulty, username, clearTimeSeconds, clearTimeStr, startBattery, endBattery, clearedCount, isClear } = body;

        const safeUsername = (username || '名無し').trim().substring(0, 10);

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
