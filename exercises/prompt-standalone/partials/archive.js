import { access, rename } from 'node:fs/promises';

async function fileExists(fileUrl) {
    try {
        await access(fileUrl);
        return true;
    } catch {
        return false;
    }
}

// Before writing a new report, saves the previous one under a different name
// (output.html -> output001.html, output002.html, ...) instead of overwriting it, so you
// can compare an earlier run against your latest edit.
export async function archiveIfExists(fileUrl) {
    if (!(await fileExists(fileUrl))) {
        return;
    }

    const dir = new URL('.', fileUrl);
    const filename = fileUrl.pathname.split('/').pop();
    const dotIndex = filename.lastIndexOf('.');
    const name = filename.slice(0, dotIndex);
    const ext = filename.slice(dotIndex);

    let counter = 1;
    let archiveUrl = new URL(`${name}${String(counter).padStart(3, '0')}${ext}`, dir);
    while (await fileExists(archiveUrl)) {
        counter++;
        archiveUrl = new URL(`${name}${String(counter).padStart(3, '0')}${ext}`, dir);
    }

    await rename(fileUrl, archiveUrl);
}
