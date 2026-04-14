/**
 * algo-ours.js — 我们的 k-means 聚类 + 轮廓分离量化算法
 * 依赖 algo-shared.js 中的：colDist, closestIdx, buildBackgroundMask, clamp
 *
 * 全局暴露：window.quantizeOurs(imgData, w, h, numC, allRgb, EMPTY)
 */

(function () {
  'use strict';

  // Detect dark outline pixels: dark foreground pixels next to much lighter neighbors
  function detectOutlinePixels(px, w, h, bgMask) {
    const mask = new Array(px.length).fill(false);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (bgMask[idx]) continue;
        const p = px[idx];
        const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
        if (lum >= 80) continue;
        let hasLightNeighbor = false;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const n = px[ny * w + nx];
            const nLum = 0.299 * n[0] + 0.587 * n[1] + 0.114 * n[2];
            if (nLum - lum > 70) { hasLightNeighbor = true; break; }
          }
          if (hasLightNeighbor) break;
        }
        if (hasLightNeighbor) mask[idx] = true;
      }
    }
    return mask;
  }

  // Compute edge importance per pixel
  function computeEdgeWeights(px, w, h, bgMask) {
    const weights = new Array(px.length).fill(1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (bgMask[idx]) continue;
        const p = px[idx];
        let maxDiff = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nIdx = ny * w + nx;
            if (bgMask[nIdx]) continue;
            const n = px[nIdx];
            const diff = Math.abs(p[0] - n[0]) + Math.abs(p[1] - n[1]) + Math.abs(p[2] - n[2]);
            if (diff > maxDiff) maxDiff = diff;
          }
        }
        if (maxDiff > 120) weights[idx] = 3;
        else if (maxDiff > 60) weights[idx] = 2;
      }
    }
    return weights;
  }

  function samplePixelsForClustering(pixels, maxSamples) {
    if (pixels.length <= maxSamples) return pixels;
    const step = pixels.length / maxSamples;
    const sampled = [];
    for (let i = 0; i < maxSamples; i++) {
      sampled.push(pixels[Math.floor(i * step)]);
    }
    return sampled;
  }

  function initClusterCenters(pixels, k) {
    let darkest = pixels[0], darkestLum = Infinity;
    for (let i = 0; i < pixels.length; i += Math.max(1, Math.floor(pixels.length / 500))) {
      const p = pixels[i];
      const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
      if (lum < darkestLum) { darkestLum = lum; darkest = p; }
    }
    const centers = [darkest.slice()];
    while (centers.length < k) {
      let bestPixel = pixels[0];
      let bestScore = -1;
      for (let i = 0; i < pixels.length; i += Math.max(1, Math.floor(pixels.length / 400))) {
        const p = pixels[i];
        let nearest = Infinity;
        for (const c of centers) nearest = Math.min(nearest, colDist(p, c));
        if (nearest > bestScore) {
          bestScore = nearest;
          bestPixel = p;
        }
      }
      centers.push(bestPixel.slice());
    }
    return centers.map(c => c.slice());
  }

  function clusterPixels(pixels, k) {
    const sampled = samplePixelsForClustering(pixels, 4000);
    const centers = initClusterCenters(sampled, k);
    const assignments = new Array(pixels.length).fill(0);

    for (let iter = 0; iter < 6; iter++) {
      const sums = Array.from({ length: centers.length }, () => [0, 0, 0, 0]);
      let moved = false;

      for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];
        let best = 0, bestDist = Infinity;
        for (let c = 0; c < centers.length; c++) {
          const dist = colDist(p, centers[c]);
          if (dist < bestDist) { bestDist = dist; best = c; }
        }
        if (assignments[i] !== best) moved = true;
        assignments[i] = best;
        sums[best][0] += p[0];
        sums[best][1] += p[1];
        sums[best][2] += p[2];
        sums[best][3] += 1;
      }

      for (let c = 0; c < centers.length; c++) {
        if (!sums[c][3]) continue;
        centers[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3])
        ];
      }

      if (!moved && iter > 1) break;
    }

    const counts = new Array(centers.length).fill(0);
    assignments.forEach(idx => counts[idx]++);
    return { centers, assignments, counts };
  }

  function mapClustersToPalette(clusters, paletteRgb) {
    const ranked = clusters.centers.map((center, i) => ({
      center, i, count: clusters.counts[i]
    })).sort((a, b) => b.count - a.count);

    const chosen = new Map();
    for (const item of ranked) {
      let bestPalette = 0, bestDist = Infinity;
      for (let p = 0; p < paletteRgb.length; p++) {
        const dist = colDist(item.center, paletteRgb[p]);
        const duplicatePenalty = [...chosen.values()].includes(p) ? 8 : 0;
        if (dist + duplicatePenalty < bestDist) {
          bestDist = dist + duplicatePenalty;
          bestPalette = p;
        }
      }
      chosen.set(item.i, bestPalette);
    }
    return clusters.centers.map((_, i) => chosen.get(i) ?? 0);
  }

  function cleanupGrid(gridData, w, h, allRgb, EMPTY) {
    const isSmall = w <= 40 || h <= 40;
    if (w <= 20 && h <= 20) return gridData;

    const passes = isSmall ? 1 : 2;
    let out = gridData.map(row => [...row]);
    for (let pass = 0; pass < passes; pass++) {
      const next = out.map(row => [...row]);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const curColor = out[y][x];
          if (curColor !== EMPTY) {
            const cRgb = allRgb[curColor];
            if (cRgb && 0.299 * cRgb[0] + 0.587 * cRgb[1] + 0.114 * cRgb[2] < 60) continue;
          }
          const counts = new Map();
          let same = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (!ox && !oy) continue;
              const nx = x + ox, ny = y + oy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const c = out[ny][nx];
              if (c === EMPTY) continue;
              counts.set(c, (counts.get(c) || 0) + 1);
              if (c === out[y][x]) same++;
            }
          }
          let dominant = EMPTY, dominantCount = 0;
          for (const [color, count] of counts.entries()) {
            if (count > dominantCount) { dominant = color; dominantCount = count; }
          }

          if (out[y][x] === EMPTY) {
            if (dominant !== EMPTY && dominantCount >= 6 && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
              next[y][x] = dominant;
            }
            continue;
          }

          if (dominant !== EMPTY && dominant !== out[y][x]) {
            if (isSmall) {
              if (same === 0 && dominantCount >= 6) next[y][x] = dominant;
            } else {
              if ((same <= 1 && dominantCount >= 5) || (same <= 2 && dominantCount >= 6)) {
                next[y][x] = dominant;
              }
            }
          }
        }
      }
      out = next;
    }
    return out;
  }

  // ---------- main quantize ----------
  window.quantizeOurs = function (imgData, w, h, numC, allRgb, EMPTY) {
    const d = imgData.data, px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);

    const bgColor = imgData.bgColor;
    const bgMask = bgColor ? buildBackgroundMask(px, w, h, bgColor) : new Array(px.length).fill(false);

    const outlineMask = detectOutlinePixels(px, w, h, bgMask);

    const foreground = [];
    const fgIndices = [];
    const outlineIndices = [];
    for (let i = 0; i < px.length; i++) {
      if (bgMask[i]) continue;
      if (outlineMask[i]) {
        outlineIndices.push(i);
      } else {
        foreground.push(px[i]);
        fgIndices.push(i);
      }
    }

    if (!foreground.length && !outlineIndices.length) {
      return Array.from({ length: h }, () => Array.from({ length: w }, () => EMPTY));
    }

    const totalFg = foreground.length + outlineIndices.length;
    const doOutlineSep = outlineIndices.length > 0 && outlineIndices.length < totalFg * 0.3;

    const assigned = new Array(px.length).fill(EMPTY);

    if (doOutlineSep) {
      const outlineColors = new Set();
      for (const idx of outlineIndices) {
        const palIdx = closestIdx(px[idx], allRgb);
        assigned[idx] = palIdx;
        outlineColors.add(palIdx);
      }

      if (foreground.length > 0) {
        const numFgColors = Math.max(2, numC - outlineColors.size);
        const edgeWeights = computeEdgeWeights(px, w, h, bgMask);
        const weightedFg = [];
        for (let i = 0; i < foreground.length; i++) {
          const weight = edgeWeights[fgIndices[i]];
          weightedFg.push(foreground[i]);
          for (let r = 1; r < weight; r++) weightedFg.push(foreground[i]);
        }
        const toCluster = weightedFg.length > foreground.length ? weightedFg : foreground;
        const clusters = clusterPixels(toCluster, Math.min(numFgColors, foreground.length));
        const paletteForCluster = mapClustersToPalette(clusters, allRgb);
        if (weightedFg.length > foreground.length) {
          for (let i = 0; i < foreground.length; i++) {
            let best = 0, bestDist = Infinity;
            for (let c = 0; c < clusters.centers.length; c++) {
              const dist = colDist(foreground[i], clusters.centers[c]);
              if (dist < bestDist) { bestDist = dist; best = c; }
            }
            assigned[fgIndices[i]] = paletteForCluster[best];
          }
        } else {
          for (let i = 0; i < foreground.length; i++) {
            assigned[fgIndices[i]] = paletteForCluster[clusters.assignments[i]];
          }
        }
      }
    } else {
      const allFg = [], allFgIdx = [];
      for (let i = 0; i < px.length; i++) {
        if (bgMask[i]) continue;
        allFg.push(px[i]);
        allFgIdx.push(i);
      }
      if (allFg.length) {
        const edgeWeights = computeEdgeWeights(px, w, h, bgMask);
        const weightedFg = [];
        for (let i = 0; i < allFg.length; i++) {
          const weight = edgeWeights[allFgIdx[i]];
          weightedFg.push(allFg[i]);
          for (let r = 1; r < weight; r++) weightedFg.push(allFg[i]);
        }
        const toCluster = weightedFg.length > allFg.length ? weightedFg : allFg;
        const clusters = clusterPixels(toCluster, Math.min(numC, allFg.length));
        const paletteForCluster = mapClustersToPalette(clusters, allRgb);
        if (weightedFg.length > allFg.length) {
          for (let i = 0; i < allFg.length; i++) {
            let best = 0, bestDist = Infinity;
            for (let c = 0; c < clusters.centers.length; c++) {
              const dist = colDist(allFg[i], clusters.centers[c]);
              if (dist < bestDist) { bestDist = dist; best = c; }
            }
            assigned[allFgIdx[i]] = paletteForCluster[best];
          }
        } else {
          for (let i = 0; i < allFg.length; i++) {
            assigned[allFgIdx[i]] = paletteForCluster[clusters.assignments[i]];
          }
        }
      }
    }

    const g = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) row.push(assigned[y * w + x]);
      g.push(row);
    }
    return cleanupGrid(g, w, h, allRgb, EMPTY);
  };
})();
