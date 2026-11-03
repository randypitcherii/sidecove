import test from 'node:test';
import assert from 'node:assert/strict';
import {
    nextVersion,
    setJsonVersion,
    promoteUnreleased,
    releaseNotes,
    versionProblems
} from '../../../scripts/release-lib.js';

const changelog = `# Changelog

## Unreleased (1.3.0)

- **New thing:** it works.
- Another line.

## 1.2.0

An earlier release.

- Old change.
`;

test('the next version follows the requested bump or an explicit version', () => {
    assert.equal(nextVersion('1.2.0', 'patch'), '1.2.1');
    assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0');
    assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
    assert.equal(nextVersion('1.2.3', '1.4.0'), '1.4.0');
    assert.throws(() => nextVersion('1.2.3', 'beta'), /patch, minor, major or x.y.z/);
    assert.throws(() => nextVersion('1.2', 'patch'), /not x.y.z/);
});

test('setting the version changes only the version line of a JSON file', () => {
    const manifest =
        '{\n  "manifest_version": 3,\n  "name": "Sidecove",\n  "version": "1.2.0",\n  "permissions": ["tabs"]\n}\n';
    const updated = setJsonVersion(manifest, '1.3.0');
    assert.equal(updated, manifest.replace('"version": "1.2.0"', '"version": "1.3.0"'));
    assert.throws(() => setJsonVersion('{}', '1.3.0'), /No "version"/);
});

test('the Unreleased section becomes the release section and its notes are readable', () => {
    const released = promoteUnreleased(changelog, '1.3.0');
    assert.match(released, /^## 1\.3\.0$/m);
    assert.doesNotMatch(released, /Unreleased/);
    assert.equal(releaseNotes(released, '1.3.0'), '- **New thing:** it works.\n- Another line.');
    assert.equal(releaseNotes(released, '1.2.0'), 'An earlier release.\n\n- Old change.');
    assert.throws(() => promoteUnreleased(released, '1.4.0'), /no "## Unreleased"/);
    assert.throws(() => promoteUnreleased(changelog, '1.2.0'), /already has a section for 1.2.0/);
    assert.throws(() => promoteUnreleased('## Unreleased\n\n## 1.0.0\n- x\n', '1.1.0'), /empty/);
    assert.throws(() => releaseNotes(changelog, '9.9.9'), /no "## 9.9.9"/);
});

test('a tag must match a version that package.json and manifest.json share', () => {
    assert.deepEqual(versionProblems({ tag: 'v1.3.0', packageVersion: '1.3.0', manifestVersion: '1.3.0' }), []);
    assert.deepEqual(versionProblems({ packageVersion: '1.3.0', manifestVersion: '1.3.0' }), []);
    assert.match(
        versionProblems({ tag: 'v1.3.1', packageVersion: '1.3.0', manifestVersion: '1.3.0' })[0],
        /does not match/
    );
    assert.match(versionProblems({ packageVersion: '1.3.0', manifestVersion: '1.2.0' })[0], /package.json has 1.3.0/);
    assert.match(
        versionProblems({ tag: 'v1.3.0-rc.1', packageVersion: '1.3.0', manifestVersion: '1.3.0' })[0],
        /does not match/
    );
});
