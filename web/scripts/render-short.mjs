import { chromium } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name, fallback) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
  };

  const userPrompt = getArg('prompt', '');
  let durationSec = parseInt(getArg('duration', getArg('length', '30')), 10);
  let hook = getArg('hook', '');
  const outputDir = path.resolve(getArg('outDir', './videos'));

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Parse prompt defaults if provided
  if (userPrompt) {
    const pLower = userPrompt.toLowerCase();
    if (pLower.includes('15') || pLower.includes('quick') || pLower.includes('short')) {
      durationSec = 15;
    } else if (pLower.includes('60') || pLower.includes('everything') || pLower.includes('showcase') || pLower.includes('tour')) {
      durationSec = 60;
    }

    if (!hook) {
      if (pLower.includes('panic') || pLower.includes('bullet') || pLower.includes('time')) {
        hook = 'WHY BULLET CHESS IS PURE PANIC';
      } else if (pLower.includes('everything') || pLower.includes('showcase')) {
        hook = 'EVERYTHING CHEGGAWEB HAS TO OFFER';
      } else if (pLower.includes('pixel')) {
        hook = 'RETRO 8-BIT CHESS REVIEW';
      } else {
        hook = userPrompt.toUpperCase().slice(0, 40);
      }
    }
  }

  if (!hook) {
    hook = durationSec === 60 ? 'EVERYTHING CHEGGAWEB HAS TO OFFER' : '99% OF PLAYERS MISS THIS QUEEN SAC';
  }

  const htmlPath = path.resolve('C:/Users/mbott/.gemini/antigravity/brain/ec5206f2-eeb6-4f31-aa16-5d59e0a3e49b/chegga_video_studio.html');

  console.log('==================================================');
  console.log('   Chegga Automated Front-to-Back Video Producer  ');
  console.log('==================================================');
  if (userPrompt) console.log(`• Natural Prompt: "${userPrompt}"`);
  console.log(`• Hook Headline: "${hook}"`);
  console.log(`• Duration Style: ${durationSec}s format (${durationSec === 15 ? 'TikTok Hook' : durationSec === 30 ? 'Shorts Story' : 'Full Showcase'})`);
  console.log(`• Output Folder: ${outputDir}\n`);

  console.log('1. Launching system browser with 1080x1920 9:16 video recorder...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: outputDir,
      size: { width: 1080, height: 1920 },
    },
    viewport: { width: 1080, height: 1920 },
  });

  const page = await context.newPage();
  console.log('2. Loading video studio render canvas...');
  await page.goto(`file://${htmlPath}`);

  // Inject parameters & trigger prompt generation
  await page.evaluate(({ prompt, dur, h }) => {
    if (prompt) {
      document.getElementById('user-prompt').value = prompt;
      window.generateFromPrompt();
    }
    window.setVideoStyle(dur);
    if (h) {
      document.getElementById('param-hook').value = h;
      window.applyParamChanges();
    }
    window.startPlayback();
  }, { prompt: userPrompt, dur: durationSec, h: hook });

  console.log(`3. Rendering video frames & recording timeline (${durationSec} seconds)...`);
  await page.waitForTimeout((durationSec + 1) * 1000);

  console.log('4. Finalizing video encoding & closing browser...');
  await page.close();
  await context.close();
  await browser.close();

  // Find newly created video in outputDir and rename to clean slug
  const files = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.webm') && f.startsWith('page@'))
    .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length > 0) {
    const rawVideoPath = path.join(outputDir, files[0].name);
    const slug = hook.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chegga-video';
    const cleanFileName = `chegga-${durationSec}s-${slug}-${Date.now().toString().slice(-4)}.webm`;
    const cleanPath = path.join(outputDir, cleanFileName);
    fs.renameSync(rawVideoPath, cleanPath);

    console.log('\n==================================================');
    console.log(`✓ VIDEO GENERATED FRONT-TO-BACK:`);
    console.log(`  Path: ${cleanPath}`);
    console.log(`  Duration: ${durationSec}s`);
    console.log(`  Size: ${(fs.statSync(cleanPath).size / (1024 * 1024)).toFixed(2)} MB`);
    console.log('==================================================\n');
  } else {
    console.log('Video recording completed.');
  }
}

main().catch(err => {
  console.error('Video generation failed:', err);
  process.exit(1);
});
