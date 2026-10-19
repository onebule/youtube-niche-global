// A process-only HTTP smoke test for the isolated preview route.
// Requires a pre-started Next.js server. No user credentials or API calls.
const base = process.env.STUDIO_SMOKE_BASE_URL;
const expected = Number(process.env.STUDIO_SMOKE_EXPECT_STATUS);
if (!base || ![200, 404].includes(expected)) {
  console.error('Set STUDIO_SMOKE_BASE_URL and STUDIO_SMOKE_EXPECT_STATUS=200|404');
  process.exit(2);
}
const paths = ['/studio-parity', '/studio-parity/canvas'];
for (const path of paths) {
  let response;
  let error;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch(new URL(path, base), {
        headers: { accept: 'text/html' },
        redirect: 'manual',
        signal: AbortSignal.timeout(2000),
      });
      break;
    } catch (e) {
      error = e;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  if (!response) throw new Error('Server unreachable: ' + String(error));
  const html = await response.text();
  if (response.status !== expected) {
    console.error(path + ': expected ' + expected + ', got ' + response.status);
    process.exitCode = 1;
  } else if (expected === 200 && (!html.includes('SignalCraft') || !html.includes('NO GENERATION') && path.endsWith('canvas'))) {
    console.error(path + ': response lacks expected isolated preview markers');
    process.exitCode = 1;
  } else {
    console.log('PASS: ' + path + ' returned HTTP ' + expected);
  }
}
