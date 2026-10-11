import { chromium } from 'playwright';

const visible = process.env.SIM_HEADLESS !== '1';
const url = process.env.SIM_URL || 'http://127.0.0.1:5180/?environment=scenesmith_house_187';
// Playwright's default headless build (`chrome-headless-shell`) renders WebGL with
// SwiftShader, which caps this scene at ~1 Hz. The full Chromium build in new-headless
// mode reaches the GPU through ANGLE's EGL backend instead. SIM_GPU_HEADLESS=0 opts out;
// with no usable GPU, Chromium still falls back to SwiftShader.
const gpuHeadless = !visible && process.env.SIM_GPU_HEADLESS !== '0';
const browser = await chromium.launch({
  headless: !visible,
  ...(gpuHeadless && {
    channel: 'chromium',
    args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'],
  }),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => console.error(`[browser:error] ${error.stack || error}`));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.waitForFunction(
  () => window.mujocoApp?.getState?.().model && window.mujocoBridge?.status?.().connected,
  null,
  { timeout: 180_000 },
);
console.log(`MuJoCo browser is ready at ${url}`);
process.send?.({ type: 'ready', url });

const stop = async () => {
  await browser.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
await new Promise(() => {});
