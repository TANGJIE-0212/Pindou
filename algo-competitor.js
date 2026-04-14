/**
 * algo-competitor.js — 竞品方案：逐像素直接匹配最近调色板色
 * 参考 pindou.metamo.cn 的算法：
 *   1. 每像素独立计算与调色板的欧氏距离，选最近色
 *   2. 不做 k-means 聚类
 *   3. 如果用了太多颜色，迭代合并最少用的颜色到最近的邻色
 *
 * 依赖 algo-shared.js 中的：colDist, closestIdx, buildBackgroundMask
 *
 * 全局暴露：window.quantizeCompetitor(imgData, w, h, numC, allRgb, EMPTY)
 */

(function () {
  'use strict';

  /**
   * 轻量邻域平滑 (参考竞品的 smoothing 0.25)
   * 对每个像素与 3×3 邻域均值做加权混合
   */
  function neighborSmooth(px, w, h, strength) {
    if (strength <= 0) return px;
    const out = px.map(p => [...p]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0, cnt = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const n = px[ny * w + nx];
            sr += n[0]; sg += n[1]; sb += n[2]; cnt++;
          }
        }
        const orig = px[y * w + x];
        const idx = y * w + x;
        out[idx] = [
          Math.round(orig[0] + (sr / cnt - orig[0]) * strength),
          Math.round(orig[1] + (sg / cnt - orig[1]) * strength),
          Math.round(orig[2] + (sb / cnt - orig[2]) * strength)
        ];
      }
    }
    return out;
  }

  /**
   * 颜色缩减：如果用了超过 numC 种调色板色，
   * 迭代将使用最少的颜色合并到它在调色板中最近的已使用邻色。
   */
  function reduceColors(assigned, w, h, numC, allRgb, EMPTY) {
    // 统计使用了哪些调色板索引
    const usage = new Map();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = assigned[y][x];
        if (c === EMPTY) continue;
        usage.set(c, (usage.get(c) || 0) + 1);
      }
    }

    // 如果已经在限制内，直接返回
    if (usage.size <= numC) return assigned;

    // 建立合并映射：反复移除最少使用的颜色
    const mergeMap = new Map(); // oldIdx -> newIdx
    while (usage.size > numC) {
      // 找使用最少的颜色
      let minColor = -1, minCount = Infinity;
      for (const [color, count] of usage) {
        if (count < minCount) { minCount = count; minColor = color; }
      }
      if (minColor === -1) break;

      // 在调色板中找最近的已使用色
      let bestTarget = -1, bestDist = Infinity;
      for (const [color] of usage) {
        if (color === minColor) continue;
        const d = colDist(allRgb[minColor], allRgb[color]);
        if (d < bestDist) { bestDist = d; bestTarget = color; }
      }
      if (bestTarget === -1) break;

      // 合并
      mergeMap.set(minColor, bestTarget);
      usage.set(bestTarget, usage.get(bestTarget) + minCount);
      usage.delete(minColor);
    }

    if (mergeMap.size === 0) return assigned;

    // 解析传递合并：如果 A→B, B→C，则 A→C
    function resolve(c) {
      const visited = new Set();
      while (mergeMap.has(c) && !visited.has(c)) {
        visited.add(c);
        c = mergeMap.get(c);
      }
      return c;
    }

    // 应用合并
    const out = assigned.map(row => [...row]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = out[y][x];
        if (c !== EMPTY && mergeMap.has(c)) {
          out[y][x] = resolve(c);
        }
      }
    }
    return out;
  }

  // ---------- main quantize ----------
  window.quantizeCompetitor = function (imgData, w, h, numC, allRgb, EMPTY) {
    const d = imgData.data, px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);

    const bgColor = imgData.bgColor;
    const bgMask = bgColor ? buildBackgroundMask(px, w, h, bgColor) : new Array(px.length).fill(false);

    // 轻量平滑（竞品参数: 0.25）
    const smoothed = neighborSmooth(px, w, h, 0.25);

    // 逐像素直接匹配最近调色板色
    const grid = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (bgMask[idx]) {
          row.push(EMPTY);
        } else {
          row.push(closestIdx(smoothed[idx], allRgb));
        }
      }
      grid.push(row);
    }

    // 颜色缩减到 numC 以内
    return reduceColors(grid, w, h, numC, allRgb, EMPTY);
  };
})();
