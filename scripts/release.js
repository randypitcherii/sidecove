// Sidecove release flow. A release is a pull request; the tag comes after it merges.
//   npm run release <patch|minor|major|x.y.z>   branch release/vX.Y.Z with the version bump
//                                               and the CHANGELOG's Unreleased section renamed
//   npm run release:tag                         after that PR merges: tag main as vX.Y.Z and push
//                                               the tag, which starts .github/workflows/release.yml
//   node scripts/release.js check [vX.Y.Z]      exit 1 unless package.json, manifest.json (and the tag) agree
//   node scripts/release.js notes <x.y.z>       print the release notes for a version
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nextVersion, setJsonVersion, promoteUnreleased, releaseNotes, versionProblems } from './release-lib.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = name => path.join(root, name);
const read = name => fs.readFileSync(file(name), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const repository = 'matthewmoorcroft/sidecove';

function fail(message) {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function versions() {
    return {
        packageVersion: JSON.parse(read('package.json')).version,
        manifestVersion: JSON.parse(read('manifest.json')).version
    };
}

function requireCleanMain() {
    if (git('status', '--porcelain')) fail('The working tree has uncommitted changes.');
    if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Run this on main.');
    git('fetch', '--quiet', 'origin', 'main', '--tags');
    if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main'))
        fail('main is not the same as origin/main; pull first.');
}

function prepare(type) {
    if (!type) fail('Usage: npm run release <patch|minor|major|x.y.z>');
    requireCleanMain();
    const { packageVersion } = versions();
    const version = nextVersion(packageVersion, type);
    const branch = `release/v${version}`;
    const changelog = promoteUnreleased(read('CHANGELOG.md'), version);

    git('switch', '--create', branch);
    for (const name of ['package.json', 'manifest.json'])
        fs.writeFileSync(file(name), setJsonVersion(read(name), version));
    const lock = JSON.parse(read('package-lock.json'));
    lock.version = version;
    lock.packages[''].version = version;
    fs.writeFileSync(file('package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
    fs.writeFileSync(file('CHANGELOG.md'), changelog);
    git('add', 'package.json', 'package-lock.json', 'manifest.json', 'CHANGELOG.md');
    git('commit', '--quiet', '--message', `Release ${version}`);

    console.log(`✅ ${branch}: version ${packageVersion} -> ${version}, CHANGELOG section "## ${version}".`);
    console.log('Next:');
    console.log(`  1. git push --set-upstream origin ${branch}`);
    console.log(`  2. Open a pull request into main: https://github.com/${repository}/compare/main...${branch}`);
    console.log('  3. When CI passes and it merges, run "npm run release:tag" on an up-to-date main.');
}

function tag() {
    requireCleanMain();
    const { manifestVersion } = versions();
    const name = `v${manifestVersion}`;
    const problems = versionProblems({ tag: name, ...versions() });
    if (problems.length) fail(problems.join('\n'));
    releaseNotes(read('CHANGELOG.md'), manifestVersion);
    if (git('tag', '--list', name)) fail(`Tag ${name} already exists. Did the release PR bump the version?`);
    git('tag', '--annotate', name, '--message', `Sidecove ${manifestVersion}`);
    git('push', 'origin', name);
    console.log(
        `✅ Pushed ${name}. Follow the Release workflow: https://github.com/${repository}/actions/workflows/release.yml`
    );
}

function check(tagName) {
    const problems = versionProblems({ tag: tagName, ...versions() });
    if (problems.length) fail(problems.join('\n'));
    console.log(
        `✅ package.json and manifest.json are ${versions().manifestVersion}${tagName ? `, matching ${tagName}` : ''}.`
    );
}

function notes(version) {
    if (!version) fail('Usage: node scripts/release.js notes <x.y.z>');
    const previous = git('tag', '--list', 'v*', '--sort=-v:refname', '--merged', 'HEAD')
        .split('\n')
        .find(name => name && name !== `v${version}`);
    const lines = [
        releaseNotes(read('CHANGELOG.md'), version),
        '',
        '## Install',
        '',
        '1. Download `sidecove-extension.zip` below and unzip it.',
        '2. Open `chrome://extensions/`, turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder.',
        '',
        'Sidecove needs Chrome 116 or later.',
        '',
        '## Verify the download',
        '',
        '```bash',
        'sha256sum -c sidecove-extension.zip.sha256',
        `gh attestation verify sidecove-extension.zip --repo ${repository}`,
        '```',
        '',
        'The first checks the zip against its published checksum; the second checks that GitHub Actions built it from this repository.'
    ];
    if (previous)
        lines.push('', `**Full changelog:** https://github.com/${repository}/compare/${previous}...v${version}`);
    process.stdout.write(`${lines.join('\n')}\n`);
}

const [command, argument] = process.argv.slice(2);
try {
    if (command === 'prepare') prepare(argument);
    else if (command === 'tag') tag();
    else if (command === 'check') check(argument);
    else if (command === 'notes') notes(argument);
    else fail('Usage: node scripts/release.js <prepare <type>|tag|check [vX.Y.Z]|notes <x.y.z>>');
} catch (error) {
    fail(error.message);
}
