/**
 * algo-shared.js — 共享的图像预处理 + 工具函数
 * adjustedPixels / sharpenCanvas / detectSubjectCrop / estimateBackground /
 * fitCrop / buildBackgroundMask / isBackgroundLike / hexToRgb / colDist / closestIdx / clamp
 */

// ---------- color helpers ----------
function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function colDist(a, b) {
  const rm = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

function closestIdx(rgb, pal) {
  let m = Infinity, best = 0;
  for (let i = 0; i < pal.length; i++) {
    const d = colDist(rgb, pal[i]);
    if (d < m) { m = d; best = i; }
  }
  return best;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------- image preprocessing ----------
function adjustedPixels(img, w, h) {
  const c = document.createElement('canvas');
  const src = detectSubjectCrop(img, w / h);

  // Step-down resize: halve progressively instead of one big jump
  let srcCanvas = document.createElement('canvas');
  srcCanvas.width = src.sw; srcCanvas.height = src.sh;
  let srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, src.sw, src.sh);

  // Sharpen before downscale to preserve edges
  if (src.sw > w * 3) {
    sharpenCanvas(srcCtx, srcCanvas.width, srcCanvas.height, 0.3);
  }

  // Progressive halving
  let curW = src.sw, curH = src.sh;
  while (curW > w * 2 || curH > h * 2) {
    const nw = Math.max(w, Math.ceil(curW / 2));
    const nh = Math.max(h, Math.ceil(curH / 2));
    const tmp = document.createElement('canvas');
    tmp.width = nw; tmp.height = nh;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(srcCanvas, 0, 0, curW, curH, 0, 0, nw, nh);
    srcCanvas = tmp;
    curW = nw; curH = nh;
  }

  // Final resize
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, 0, 0, curW, curH, 0, 0, w, h);

  if (w <= 50) {
    sharpenCanvas(ctx, w, h, 0.4);
  }

  const id = ctx.getImageData(0, 0, w, h);
  id.bgColor = src.bgColor || null;
  return id;
}

function sharpenCanvas(ctx, w, h, amount) {
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;
  const out = new Uint8ClampedArray(d);
  const a = amount;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = d[i + c] * (1 + 4 * a);
        const neighbors = (d[i - 4 + c] + d[i + 4 + c] + d[i - w * 4 + c] + d[i + w * 4 + c]) * a;
        out[i + c] = Math.max(0, Math.min(255, Math.round(center - neighbors)));
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}

function detectSubjectCrop(img, targetRatio) {
  const sampleMax = 160;
  const scale = Math.min(1, sampleMax / Math.max(img.width, img.height));
  const sw = Math.max(24, Math.round(img.width * scale));
  const sh = Math.max(24, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;

  const bg = estimateBackground(data, sw, sh);
  let minX = sw, minY = sh, maxX = -1, maxY = -1;
  const threshold = 32;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const dist = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
      if (dist > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    const full = fitCrop(0, 0, img.width, img.height, targetRatio);
    full.bgColor = bg;
    return full;
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const cover = (boxW * boxH) / (sw * sh);
  if (cover < 0.02) {
    const full = fitCrop(0, 0, img.width, img.height, targetRatio);
    full.bgColor = bg;
    return full;
  }

  const padX = Math.max(2, Math.round(boxW * 0.12));
  const padY = Math.max(2, Math.round(boxH * 0.12));
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(sw - 1, maxX + padX);
  maxY = Math.min(sh - 1, maxY + padY);

  const cropX = minX / scale;
  const cropY = minY / scale;
  const cropW = (maxX - minX + 1) / scale;
  const cropH = (maxY - minY + 1) / scale;
  const crop = fitCrop(cropX, cropY, cropW, cropH, targetRatio, img.width, img.height);
  crop.bgColor = bg;
  return crop;
}

function estimateBackground(data, w, h) {
  const samples = [];
  const edge = Math.max(2, Math.round(Math.min(w, h) * 0.08));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < edge || y < edge || x >= w - edge || y >= h - edge) {
        const i = (y * w + x) * 4;
        samples.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }
  if (!samples.length) return [255, 255, 255];
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const mid = samples[Math.floor(samples.length * 0.6)] || samples[Math.floor(samples.length / 2)];
  return mid;
}

function fitCrop(sx, sy, sw, sh, targetRatio, maxW, maxH) {
  const boundW = maxW || (sx + sw);
  const boundH = maxH || (sy + sh);
  let cropX = sx, cropY = sy, cropW = sw, cropH = sh;
  const srcRatio = cropW / cropH;

  if (srcRatio > targetRatio) {
    cropH = cropW / targetRatio;
    cropY -= (cropH - sh) / 2;
  } else {
    cropW = cropH * targetRatio;
    cropX -= (cropW - sw) / 2;
  }

  if (cropX < 0) cropX = 0;
  if (cropY < 0) cropY = 0;
  if (cropX + cropW > boundW) cropX = boundW - cropW;
  if (cropY + cropH > boundH) cropY = boundH - cropH;

  cropX = clamp(Math.round(cropX), 0, boundW - 1);
  cropY = clamp(Math.round(cropY), 0, boundH - 1);
  cropW = clamp(Math.round(cropW), 1, boundW - cropX);
  cropH = clamp(Math.round(cropH), 1, boundH - cropY);

  return { sx: cropX, sy: cropY, sw: cropW, sh: cropH };
}

// ---------- background detection ----------
function buildBackgroundMask(px, w, h, bgColor) {
  const mask = new Array(px.length).fill(false);
  const queue = [];
  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (mask[idx]) return;
    if (!isBackgroundLike(px, w, h, x, y, bgColor)) return;
    mask[idx] = true;
    queue.push(idx);
  };

  for (let x = 0; x < w; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(0, y);
    pushIfBg(w - 1, y);
  }

  while (queue.length) {
    const idx = queue.shift();
    const x = idx % w;
    const y = Math.floor(idx / w);
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }
  return mask;
}

function isBackgroundLike(px, w, h, x, y, bgColor) {
  const rgb = px[y * w + x];
  const manhattan = Math.abs(rgb[0] - bgColor[0]) + Math.abs(rgb[1] - bgColor[1]) + Math.abs(rgb[2] - bgColor[2]);
  if (manhattan > 42) return false;

  let localDiff = 0;
  let count = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const near = px[ny * w + nx];
      localDiff += Math.abs(rgb[0] - near[0]) + Math.abs(rgb[1] - near[1]) + Math.abs(rgb[2] - near[2]);
      count++;
    }
  }
  const avgLocal = count ? localDiff / count : 0;
  return avgLocal < 28;
}
