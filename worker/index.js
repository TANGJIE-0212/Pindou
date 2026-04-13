/**
 * Cloudflare Worker — 拼豆图纸生成器 AI 动漫化代理
 *
 * 功能：
 *  1. 密钥安全：SiliconFlow API Key 存在服务端环境变量，不暴露给前端
 *  2. 限流：每天总计 100 次，每个 IP 每天 3 次
 *  3. CORS：允许前端跨域调用
 *
 * 环境变量 (在 Cloudflare Dashboard 或 wrangler.toml 中设置)：
 *  - SF_API_KEY: SiliconFlow API 密钥 (sk-xxx)
 *
 * KV 命名空间绑定：
 *  - RATE_LIMIT: 用于存储限流计数
 */

export default {
  async fetch(request, env) {
    // ---- CORS 预检 ----
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    // 只接受 POST
    if (request.method !== 'POST') {
      return json({ error: '仅支持 POST 请求' }, 405);
    }

    // ---- 限流检查 ----
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const dailyKey = `daily:${today}`;
    const ipKey = `ip:${today}:${ip}`;

    const [dailyCount, ipCount] = await Promise.all([
      env.RATE_LIMIT.get(dailyKey).then(v => parseInt(v || '0')),
      env.RATE_LIMIT.get(ipKey).then(v => parseInt(v || '0'))
    ]);

    if (dailyCount >= 100) {
      return json({
        error: '今日全站生成次数已达上限（100次/天），明天再来吧~',
        remaining: { daily: 0, ip: Math.max(0, 3 - ipCount) }
      }, 429);
    }

    if (ipCount >= 3) {
      return json({
        error: '您今日的免费次数已用完（3次/IP/天）',
        remaining: { daily: 100 - dailyCount, ip: 0 }
      }, 429);
    }

    // ---- 解析请求 ----
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    if (!body.image) {
      return json({ error: '缺少图片数据' }, 400);
    }

    // ---- 调用 SiliconFlow API ----
    try {
      const sfResp = await fetch('https://api.siliconflow.cn/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen-Image-Edit-2509',
          prompt: body.prompt || 'Convert this photo into a cute flat-color cartoon / anime illustration style. Use clean outlines, solid fill colors with minimal gradients, bright and vivid palette. Keep the main subject clearly recognizable. The style should look like a simplified cartoon sticker — ideal for pixel art / perler bead patterns.',
          image: body.image,
          num_inference_steps: 50,
          cfg: 4.0
        })
      });

      const data = await sfResp.json();

      if (!sfResp.ok) {
        const msg = data?.message || data?.error?.message || `API 错误 (${sfResp.status})`;
        return json({ error: msg }, sfResp.status);
      }

      const imageUrl = data.images?.[0]?.url;
      if (!imageUrl) {
        return json({ error: '未获取到图片结果' }, 502);
      }

      // ---- 限流计数 +1 (TTL 24小时自动过期) ----
      await Promise.all([
        env.RATE_LIMIT.put(dailyKey, String(dailyCount + 1), { expirationTtl: 86400 }),
        env.RATE_LIMIT.put(ipKey, String(ipCount + 1), { expirationTtl: 86400 })
      ]);

      return json({
        url: imageUrl,
        remaining: {
          daily: 100 - dailyCount - 1,
          ip: 3 - ipCount - 1
        }
      });

    } catch (err) {
      return json({ error: '服务暂时不可用: ' + err.message }, 500);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
