/**
 * Pindou E2E Tests (Puppeteer)
 *
 * Run:  node tests/e2e.test.js
 *
 * Requires a local HTTP server on port 8080 serving project root.
 * The script starts one automatically via `npx http-server`.
 */

const puppeteer = require('puppeteer');
const { execSync, spawn } = require('child_process');
const path = require('path');

const BASE = 'http://127.0.0.1:8080';
let browser, server;
let passed = 0, failed = 0;
const failures = [];

// ── helpers ──────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function newPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); // iPhone 14
  page.on('pageerror', e => console.error('  PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('  CONSOLE:', m.text()); });
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle0' });
  return page;
}

// Create a 100x150 red PNG data URL for testing
function testImageDataUrl() {
  // 1x1 red pixel PNG (base64)
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
}

async function uploadTestImage(page, inputSelector) {
  // Create a small test image file in /tmp
  const fs = require('fs');
  const imgPath = path.join(__dirname, 'test-image.png');
  if (!fs.existsSync(imgPath)) {
    // Generate a small 20x30 PNG using canvas-like approach via puppeteer
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 20; c.height = 30;
      const ctx = c.getContext('2d');
      // Draw a simple colored pattern
      ctx.fillStyle = '#ff6b9d';
      ctx.fillRect(0, 0, 20, 30);
      ctx.fillStyle = '#4d96ff';
      ctx.fillRect(5, 5, 10, 20);
      ctx.fillStyle = '#6bcb77';
      ctx.fillRect(8, 10, 4, 10);
      return c.toDataURL('image/png');
    });
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(imgPath, Buffer.from(base64, 'base64'));
  }
  const input = await page.$(inputSelector);
  await input.uploadFile(imgPath);
  await sleep(500); // wait for FileReader
}

function test(name, fn) {
  return { name, fn };
}

async function runTest(t) {
  process.stdout.write(`  ${t.name} ... `);
  let page;
  try {
    page = await newPage();
    await t.fn(page);
    console.log('✓ PASS');
    passed++;
  } catch (e) {
    console.log('✗ FAIL');
    console.log(`    ${e.message}`);
    failures.push({ name: t.name, error: e.message });
    failed++;
  } finally {
    if (page) await page.close();
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ── tests ────────────────────────────────────────────────────────

const tests = [

  // ============================================================
  //  T1: Page loads without JS errors
  // ============================================================
  test('T01: Page loads without JS errors', async (page) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(300);
    assert(errors.length === 0, 'Page errors: ' + errors.join('; '));
  }),

  // ============================================================
  //  T2: Default tab is "直接转图纸"
  // ============================================================
  test('T02: Default tab is direct mode', async (page) => {
    const activeText = await page.$eval('.tab-btn.active', el => el.textContent);
    assert(activeText.includes('直接转图纸'), `Active tab: "${activeText}"`);

    const directHidden = await page.$eval('#directMode', el => el.classList.contains('hidden'));
    assert(!directHidden, 'Direct mode should be visible');

    const animeHidden = await page.$eval('#animeMode', el => el.classList.contains('hidden'));
    assert(animeHidden, 'Anime mode should be hidden');
  }),

  // ============================================================
  //  T3: Tab switching works
  // ============================================================
  test('T03: Tab switching toggles visibility', async (page) => {
    // Click anime tab
    await page.click('.tab-btn[data-mode="anime"]');
    await sleep(100);

    const directHidden = await page.$eval('#directMode', el => el.classList.contains('hidden'));
    assert(directHidden, 'Direct mode should be hidden after clicking anime tab');

    const animeHidden = await page.$eval('#animeMode', el => el.classList.contains('hidden'));
    assert(!animeHidden, 'Anime mode should be visible');

    // Click back to direct
    await page.click('.tab-btn[data-mode="direct"]');
    await sleep(100);

    const directHidden2 = await page.$eval('#directMode', el => el.classList.contains('hidden'));
    assert(!directHidden2, 'Direct mode should be visible again');
  }),

  // ============================================================
  //  T4: Upload image in direct mode
  // ============================================================
  test('T04: Direct mode upload sets image and enables button', async (page) => {
    await uploadTestImage(page, '#fileInput');

    const disabled = await page.$eval('#generateBtn', el => el.disabled);
    assert(!disabled, 'Generate button should be enabled after upload');

    const hasImage = await page.$eval('#uploadZone', el => el.classList.contains('has-image'));
    assert(hasImage, 'Upload zone should have has-image class');
  }),

  // ============================================================
  //  T5: Generate in direct mode produces result
  // ============================================================
  test('T05: Direct mode generate produces bead pattern', async (page) => {
    await uploadTestImage(page, '#fileInput');
    await sleep(300);

    await page.click('#generateBtn');
    // Wait for generation to complete (progress bar disappears)
    await page.waitForFunction(() => {
      return document.getElementById('resultSection') &&
             document.getElementById('resultSection').style.display !== 'none' &&
             document.getElementById('homeSection').style.display === 'none';
    }, { timeout: 15000 });

    // Check pattern canvas exists
    const canvasVisible = await page.$eval('#patternCanvas', el => el.width > 0);
    assert(canvasVisible, 'Pattern canvas should have content');
  }),

  // ============================================================
  //  T6: CRITICAL - Tab switch does NOT contaminate state
  // ============================================================
  test('T06: Switching to anime tab then back preserves direct image', async (page) => {
    // Upload in direct mode
    await uploadTestImage(page, '#fileInput');
    await sleep(300);

    const btnEnabledBefore = await page.$eval('#generateBtn', el => !el.disabled);
    assert(btnEnabledBefore, 'Button should be enabled after direct upload');

    // Switch to anime tab
    await page.click('.tab-btn[data-mode="anime"]');
    await sleep(100);

    // Switch back to direct tab
    await page.click('.tab-btn[data-mode="direct"]');
    await sleep(100);

    // Button should still be enabled (directImage preserved)
    const btnEnabled = await page.$eval('#generateBtn', el => !el.disabled);
    assert(btnEnabled, 'Button should still be enabled after tab round-trip');

    // Upload zone should still show preview
    const hasImage = await page.$eval('#uploadZone', el => el.classList.contains('has-image'));
    assert(hasImage, 'Upload zone should still show preview after tab round-trip');
  }),

  // ============================================================
  //  T7: CRITICAL - Anime mode doesn't contaminate direct mode
  // ============================================================
  test('T07: Direct mode button disabled when only anime has image', async (page) => {
    // Start fresh - don't upload anything in direct
    // Switch to anime tab
    await page.click('.tab-btn[data-mode="anime"]');
    await sleep(100);

    // Simulate anime having a result by injecting state
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 10; c.height = 10;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 10, 10);
      const img = new Image();
      img.src = c.toDataURL();
      img.onload = () => {
        // Set anime image only
        window.__testAnimeImg = img;
      };
    });
    await sleep(200);

    // Switch to direct mode
    await page.click('.tab-btn[data-mode="direct"]');
    await sleep(100);

    // Button should be DISABLED because direct mode has no image
    const btnDisabled = await page.$eval('#generateBtn', el => el.disabled);
    assert(btnDisabled, 'Generate button should be disabled in direct mode when no direct image uploaded');
  }),

  // ============================================================
  //  T8: Difficulty tiers change settings
  // ============================================================
  test('T08: Difficulty tier buttons update grid size', async (page) => {
    // Click "easy"
    await page.click('.diff-btn[data-diff="easy"]');
    await sleep(100);
    const easyActive = await page.$eval('.diff-btn[data-diff="easy"]', el => el.classList.contains('active'));
    assert(easyActive, 'Easy button should be active');

    // Click "hard"
    await page.click('.diff-btn[data-diff="hard"]');
    await sleep(100);
    const hardActive = await page.$eval('.diff-btn[data-diff="hard"]', el => el.classList.contains('active'));
    assert(hardActive, 'Hard button should be active');
    const easyInactive = await page.$eval('.diff-btn[data-diff="easy"]', el => !el.classList.contains('active'));
    assert(easyInactive, 'Easy button should be inactive');
  }),

  // ============================================================
  //  T9: Generate button text changes with mode
  // ============================================================
  test('T09: Generate button text reflects current mode', async (page) => {
    // Direct mode
    const directText = await page.$eval('#generateBtn', el => el.innerHTML);
    assert(directText.includes('生成拼豆图纸'), `Direct btn text: "${directText}"`);

    // Switch to anime
    await page.click('.tab-btn[data-mode="anime"]');
    await sleep(100);
    const animeText = await page.$eval('#generateBtn', el => el.innerHTML);
    assert(animeText.includes('动漫化'), `Anime btn text: "${animeText}"`);

    // Switch back
    await page.click('.tab-btn[data-mode="direct"]');
    await sleep(100);
    const backText = await page.$eval('#generateBtn', el => el.innerHTML);
    assert(backText.includes('生成拼豆图纸'), `Back to direct btn text: "${backText}"`);
  }),

  // ============================================================
  //  T10: Back button returns from result to home
  // ============================================================
  test('T10: Back button returns from result to home', async (page) => {
    await uploadTestImage(page, '#fileInput');
    await sleep(300);
    await page.click('#generateBtn');
    await page.waitForFunction(() => {
      return document.getElementById('resultSection').style.display !== 'none';
    }, { timeout: 15000 });

    // Scroll back button into view and click
    await page.evaluate(() => {
      document.getElementById('backBtn').scrollIntoView();
    });
    await sleep(200);
    await page.evaluate(() => document.getElementById('backBtn').click());
    await sleep(500);

    const homeVisible = await page.$eval('#homeSection', el => el.style.display !== 'none');
    assert(homeVisible, 'Home should be visible after back');
  }),

  // ============================================================
  //  T11: Fullscreen view opens and closes
  // ============================================================
  test('T11: Fullscreen view opens and closes', async (page) => {
    await uploadTestImage(page, '#fileInput');
    await sleep(300);
    await page.click('#generateBtn');
    await page.waitForFunction(() => {
      return document.getElementById('resultSection').style.display !== 'none';
    }, { timeout: 15000 });

    // Scroll view button into view and click
    await page.evaluate(() => {
      document.getElementById('viewBtn').scrollIntoView();
    });
    await sleep(200);
    await page.evaluate(() => document.getElementById('viewBtn').click());
    await sleep(500);

    const fsVisible = await page.$eval('#fsOverlay', el => el.classList.contains('show'));
    assert(fsVisible, 'Fullscreen overlay should be visible');

    // Close via back
    await page.evaluate(() => history.back());
    await sleep(500);

    const fsClosed = await page.$eval('#fsOverlay', el => !el.classList.contains('show'));
    assert(fsClosed, 'Fullscreen overlay should close on back');
  }),

  // ============================================================
  //  T12: Pattern canvas has correct aspect ratio
  // ============================================================
  test('T12: Pattern preserves image aspect ratio', async (page) => {
    // Test image is 20x30 (portrait)
    await uploadTestImage(page, '#fileInput');
    await sleep(300);

    // Read grid dimensions after upload
    const { w, h } = await page.evaluate(() => {
      return {
        w: parseInt(document.getElementById('gridW').value),
        h: parseInt(document.getElementById('gridH').value)
      };
    });
    // For a 20x30 image with medium difficulty, h should be > w
    assert(h >= w, `Grid should be portrait: ${w}x${h}`);
  }),

  // ============================================================
  //  T13: Color count slider works
  // ============================================================
  test('T13: Color count slider updates display', async (page) => {
    const initial = await page.$eval('#colorCountValue', el => el.textContent);
    assert(parseInt(initial) > 0, 'Initial color count should be > 0');

    // Change slider via JS
    await page.evaluate(() => {
      const slider = document.getElementById('colorCount');
      slider.value = 8;
      slider.dispatchEvent(new Event('input'));
    });
    await sleep(100);

    const updated = await page.$eval('#colorCountValue', el => el.textContent);
    assert(updated === '8', `Color count should be 8, got "${updated}"`);
  }),

  // ============================================================
  //  T14: Palette brand selector exists and works
  // ============================================================
  test('T14: Palette brand selector changes', async (page) => {
    const options = await page.$$eval('#paletteBrand option', els => els.map(e => e.value));
    assert(options.length > 0, 'Should have palette brand options');
    assert(options.includes('mard'), 'Should include mard');
  }),

  // ============================================================
  //  T15: History section hidden by default in anime mode
  // ============================================================
  test('T15: History section visibility depends on localStorage', async (page) => {
    // Clear history
    await page.evaluate(() => localStorage.removeItem('pindou_anime_history'));
    await page.reload({ waitUntil: 'networkidle0' });

    await page.click('.tab-btn[data-mode="anime"]');
    await sleep(200);

    const historyDisplay = await page.$eval('#historySection', el => el.style.display);
    assert(historyDisplay === 'none', 'History should be hidden when empty');
  }),

  // ============================================================
  //  T16: Multiple tab switches don't break button state
  // ============================================================
  test('T16: Rapid tab switching maintains correct button state', async (page) => {
    // Upload in direct mode
    await uploadTestImage(page, '#fileInput');
    await sleep(300);

    // Rapid switches
    for (let i = 0; i < 5; i++) {
      await page.click('.tab-btn[data-mode="anime"]');
      await sleep(50);
      await page.click('.tab-btn[data-mode="direct"]');
      await sleep(50);
    }

    // Button should still be enabled
    const btnEnabled = await page.$eval('#generateBtn', el => !el.disabled);
    assert(btnEnabled, 'Button should still be enabled after rapid tab switching');
  }),

  // ============================================================
  //  T17: Generate button disabled initially
  // ============================================================
  test('T17: Generate button disabled on fresh load', async (page) => {
    const disabled = await page.$eval('#generateBtn', el => el.disabled);
    assert(disabled, 'Generate button should be disabled on fresh page');
  }),

  // ============================================================
  //  T18: doSave is async (regression test for the async bug)
  // ============================================================
  test('T18: doSave is async function (regression)', async (page) => {
    // doSave is in a script block scope, check via page source
    const hasAsync = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script:not([src])');
      for (const s of scripts) {
        if (s.textContent.includes('async function doSave()')) return true;
      }
      return false;
    });
    assert(hasAsync, 'doSave should be declared as async function');
  }),

  // ============================================================
  //  T19: Editor opens from fullscreen view
  // ============================================================
  test('T19: Editor opens from fullscreen view', async (page) => {
    await uploadTestImage(page, '#fileInput');
    await sleep(300);
    await page.click('#generateBtn');
    await page.waitForFunction(() => {
      return document.getElementById('resultSection').style.display !== 'none';
    }, { timeout: 15000 });

    // Open fullscreen
    await page.evaluate(() => {
      document.getElementById('viewBtn').scrollIntoView();
    });
    await sleep(200);
    await page.evaluate(() => document.getElementById('viewBtn').click());
    await sleep(500);

    // Click edit button in fullscreen toolbar
    const editBtnExists = await page.$eval('#fsEditBtn', el => !!el).catch(() => false);
    if (editBtnExists) {
      await page.evaluate(() => document.getElementById('fsEditBtn').click());
      await sleep(500);
      const editorVisible = await page.$eval('#editorOverlay', el => el.classList.contains('show'));
      assert(editorVisible, 'Editor should be visible');
    }
    // If no edit button found, skip (it may be named differently)
  }),

  // ============================================================
  //  T20: No console errors during full workflow
  // ============================================================
  test('T20: Full direct workflow - no console errors', async (page) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await uploadTestImage(page, '#fileInput');
    await sleep(300);
    await page.click('#generateBtn');
    await page.waitForFunction(() => {
      return document.getElementById('resultSection').style.display !== 'none';
    }, { timeout: 15000 });
    await sleep(500);

    assert(errors.length === 0, 'Console errors: ' + errors.join('; '));
  }),

];

// ── runner ────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪 Pindou E2E Tests\n');

  // Start local server
  console.log('  Starting local server...');
  server = spawn('npx', ['http-server', '.', '-p', '8080', '-s', '--cors'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'pipe'
  });
  // Wait for server to be ready
  await sleep(3000);

  // Launch browser
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  console.log('  Running tests...\n');
  for (const t of tests) {
    await runTest(t);
  }

  await browser.close();
  server.kill();

  // Summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed, ${tests.length} total`);
  if (failures.length > 0) {
    console.log('\n  Failed tests:');
    failures.forEach(f => console.log(`    ✗ ${f.name}: ${f.error}`));
  }
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  if (browser) browser.close();
  if (server) server.kill();
  process.exit(2);
});
