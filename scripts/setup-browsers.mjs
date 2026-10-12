#!/usr/bin/env node
// Prepares the Playwright browsers used by `npm run test:e2e`.
//
// On Debian/Ubuntu `npx playwright install --with-deps` is enough. On other
// Linux distributions the browsers download, but WebKit's build expects two
// libraries it does not bundle (ICU 74 and libjpeg.so.8, which Playwright ships
// for Ubuntu). This script fetches those exact libraries from the Ubuntu pool,
// extracts them and drops them into WebKit's own `sys/lib`, which the bundled
// launcher already puts on its library path. Nothing needs root.
import { execFileSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { get } from 'node:https';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });

const browsersPath =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  join(homedir(), '.cache', 'ms-playwright');

const PACKAGES = [
  { dir: 'main/i/icu', prefix: 'libicu74' },
  { dir: 'main/libj/libjpeg-turbo', prefix: 'libjpeg-turbo8' },
];

function webkitLibDirs() {
  if (!existsSync(browsersPath)) return [];
  return readdirSync(browsersPath)
    .filter((n) => n.startsWith('webkit-'))
    .flatMap((n) =>
      ['minibrowser-wpe', 'minibrowser-gtk'].map((m) =>
        join(browsersPath, n, m, 'sys', 'lib'),
      ),
    )
    .filter(existsSync);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        return download(new URL(res.headers.location, url), dest).then(
          resolve,
          reject,
        );
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function latestDebName({ dir, prefix }) {
  const html = await fetchText(`http://archive.ubuntu.com/ubuntu/pool/${dir}/`);
  const names = [
    ...html.matchAll(new RegExp(`href="(${prefix}_[^"]*_amd64\\.deb)"`, 'g')),
  ]
    .map((m) => m[1])
    .sort();
  if (!names.length) throw new Error(`no ${prefix} package found`);
  return names[names.length - 1];
}

function extractDeb(deb, outDir) {
  mkdirSync(outDir, { recursive: true });
  run('ar', ['x', deb], { cwd: outDir });
  const member = readdirSync(outDir).find((f) => f.startsWith('data.tar'));
  if (!member) throw new Error(`no data.tar in ${deb}`);
  if (member.endsWith('.zst'))
    run('zstd', ['-d', '-q', '-f', member, '-o', 'data.tar'], { cwd: outDir });
  else if (member.endsWith('.xz'))
    run('xz', ['-d', '-k', member], { cwd: outDir });
  run('tar', ['xf', 'data.tar'], { cwd: outDir });
}

async function main() {
  console.log('Installing Playwright Firefox and WebKit...');
  try {
    run('npx', ['playwright', 'install', 'webkit', 'firefox']);
  } catch {
    // Non-fatal: the host-dependency check exits non-zero on non-Ubuntu hosts
    // even though the browsers downloaded successfully.
  }

  const targetDirs = webkitLibDirs();
  if (process.platform !== 'linux' || targetDirs.length === 0) return;
  if (targetDirs.every((d) => existsSync(join(d, 'libicuuc.so.74')))) {
    console.log('WebKit compatibility libraries already staged.');
    return;
  }

  const work = join(tmpdir(), `playwright-webkit-libs-${process.pid}`);
  mkdirSync(work, { recursive: true });
  try {
    for (const pkg of PACKAGES) {
      const name = await latestDebName(pkg);
      const deb = join(work, name);
      console.log(`Fetching ${name}`);
      await download(
        `http://archive.ubuntu.com/ubuntu/pool/${pkg.dir}/${name}`,
        deb,
      );
      extractDeb(deb, join(work, 'x'));
      rmSync(deb, { force: true });
    }
    const libRoot = join(work, 'x', 'usr', 'lib', 'x86_64-linux-gnu');
    const libs = readdirSync(libRoot).filter((f) => /^lib(icu|jpeg)/.test(f));
    if (!libs.length) throw new Error('no libraries extracted');
    for (const dir of webkitLibDirs()) {
      for (const lib of libs)
        run('cp', ['-a', join(libRoot, lib), join(dir, lib)]);
    }
    console.log(
      `Staged ${libs.length} libraries into ${webkitLibDirs().length} WebKit lib dirs.`,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
