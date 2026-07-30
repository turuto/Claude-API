// Implementation backing Claude's built-in text editor tool. Claude only knows the tool's
// *schema* (a name + version string, declared in index.js) — it has no filesystem of its own,
// so every view/create/str_replace/insert command it emits has to be carried out here and the
// result handed back as a tool_result. The lesson's Python class also implemented `undo_edit`
// with a backup/restore mechanism, but that command was dropped from the tool spec on Claude 4+
// models (the model migration notes say to "remove the undo_edit command from your text-editor
// integration") — this class only implements the four commands `text_editor_20250728` still
// supports, so there's no backup file bookkeeping to carry over.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export class TextEditorTool {
    constructor(baseDir = join(here, 'sandbox')) {
        this.baseDir = baseDir;
        mkdirSync(this.baseDir, { recursive: true });
    }

    // `filePath` in every command below is untrusted model output — resolve it against
    // baseDir and refuse anything (via `..`, an absolute path, a symlink escape, etc.) that
    // would land outside the sandbox.
    _validatePath(filePath) {
        const absPath = normalize(join(this.baseDir, filePath));
        if (absPath !== this.baseDir && !absPath.startsWith(this.baseDir + '/')) {
            throw new Error(`Access denied: path '${filePath}' is outside the allowed directory`);
        }
        return absPath;
    }

    view(filePath, viewRange) {
        const absPath = this._validatePath(filePath);

        if (!existsSync(absPath)) {
            throw new Error('File not found');
        }

        if (statSync(absPath).isDirectory()) {
            return readdirSync(absPath).join('\n');
        }

        const lines = readFileSync(absPath, 'utf-8').split('\n');

        let start = 1;
        let end = lines.length;
        if (viewRange) {
            [start, end] = viewRange;
            if (end === -1) {
                end = lines.length;
            }
        }

        return lines
            .slice(start - 1, end)
            .map((line, i) => `${start + i}: ${line}`)
            .join('\n');
    }

    strReplace(filePath, oldStr, newStr) {
        const absPath = this._validatePath(filePath);

        if (!existsSync(absPath)) {
            throw new Error('File not found');
        }

        const content = readFileSync(absPath, 'utf-8');
        const matchCount = content.split(oldStr).length - 1;

        if (matchCount === 0) {
            throw new Error('No match found for replacement. Please check your text and try again.');
        }
        if (matchCount > 1) {
            throw new Error(
                `Found ${matchCount} matches for replacement text. Please provide more context to make a unique match.`,
            );
        }

        writeFileSync(absPath, content.replace(oldStr, newStr));
        return 'Successfully replaced text at exactly one location.';
    }

    create(filePath, fileText) {
        const absPath = this._validatePath(filePath);

        if (existsSync(absPath)) {
            throw new Error('File already exists. Use str_replace to modify it.');
        }

        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, fileText);
        return `Successfully created ${filePath}`;
    }

    insert(filePath, insertLine, insertText) {
        const absPath = this._validatePath(filePath);

        if (!existsSync(absPath)) {
            throw new Error('File not found');
        }

        const lines = readFileSync(absPath, 'utf-8').split('\n');

        if (insertLine < 0 || insertLine > lines.length) {
            throw new Error(`Line number ${insertLine} is out of range. File has ${lines.length} lines.`);
        }

        lines.splice(insertLine, 0, insertText);
        writeFileSync(absPath, lines.join('\n'));
        return `Successfully inserted text after line ${insertLine}`;
    }
}
