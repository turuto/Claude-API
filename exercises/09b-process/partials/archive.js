import { access, rename } from 'node:fs/promises';

async function fileExists(fileUrl) {
    try {
        await access(fileUrl);
        return true;
    } catch {
        return false;
    }
}

// Before overwriting an existing report, rename it out of the way (output.html ->
// output001.html, then output002.html, ...) instead of silently losing the previous run's
// results — so successive prompt iterations can be compared side by side.
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
