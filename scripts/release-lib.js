// Pure helpers for the release flow (scripts/release.js and .github/workflows/release.yml).

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function nextVersion(current, type) {
    const match = SEMVER.exec(current);
    if (!match) throw new Error(`Current version ${current} is not x.y.z`);
    const [major, minor, patch] = match.slice(1).map(Number);
    if (type === 'major') return `${major + 1}.0.0`;
    if (type === 'minor') return `${major}.${minor + 1}.0`;
    if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
    if (SEMVER.test(type)) return type;
    throw new Error(`Version type must be patch, minor, major or x.y.z, not ${type}`);
}

// Sets "version" in a JSON file's text without reformatting the rest of it, so manifest.json
// changes by exactly one line.
export function setJsonVersion(text, version) {
    let replaced = 0;
    const result = text.replace(/^(\s*"version":\s*")[^"]*(")/m, (_, start, end) => {
        replaced++;
        return `${start}${version}${end}`;
    });
    if (!replaced) throw new Error('No "version" field found');
    return result;
}

const UNRELEASED = /^## Unreleased(?: \([^)]*\))?[ \t]*$/m;

// Turns the CHANGELOG's Unreleased section into the section for this version.
export function promoteUnreleased(changelog, version) {
    const match = UNRELEASED.exec(changelog);
    if (!match) throw new Error('CHANGELOG.md has no "## Unreleased" section');
    const notes = sectionBody(changelog, match.index);
    if (!notes) throw new Error('The Unreleased section of CHANGELOG.md is empty');
    if (new RegExp(`^## ${escape(version)}\\s*$`, 'm').test(changelog)) {
        throw new Error(`CHANGELOG.md already has a section for ${version}`);
    }
    return changelog.slice(0, match.index) + `## ${version}` + changelog.slice(match.index + match[0].length);
}

// The CHANGELOG text for one released version, without its heading.
export function releaseNotes(changelog, version) {
    const match = new RegExp(`^## ${escape(version)}[ \\t]*$`, 'm').exec(changelog);
    if (!match) throw new Error(`CHANGELOG.md has no "## ${version}" section`);
    const notes = sectionBody(changelog, match.index);
    if (!notes) throw new Error(`The ${version} section of CHANGELOG.md is empty`);
    return notes;
}

// A release tag must name the version that package.json and manifest.json both carry.
export function versionProblems({ tag, packageVersion, manifestVersion }) {
    const problems = [];
    if (packageVersion !== manifestVersion) {
        problems.push(`package.json has ${packageVersion} but manifest.json has ${manifestVersion}`);
    }
    if (!SEMVER.test(manifestVersion)) problems.push(`manifest.json version ${manifestVersion} is not x.y.z`);
    if (tag !== undefined && tag !== `v${manifestVersion}`) {
        problems.push(
            `tag ${tag} does not match manifest.json version ${manifestVersion} (expected v${manifestVersion})`
        );
    }
    return problems;
}

function sectionBody(changelog, headingIndex) {
    const start = changelog.indexOf('\n', headingIndex) + 1;
    const next = changelog.slice(start).search(/^## /m);
    return (next === -1 ? changelog.slice(start) : changelog.slice(start, start + next)).trim();
}

function escape(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
