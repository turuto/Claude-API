// Runs `fn` over `items`, doing at most `limit` of them at the same time instead of one
// after another. This is what `maxConcurrentTasks` controls in index.js.
export async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await fn(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

    return results;
}

// Prints a progress update (e.g. "Generated 2/3 test cases") every time another 20% of
// the work finishes, instead of printing a line for every single item.
export function createProgressLogger(label, total) {
    let completed = 0;
    let lastMilestone = 0;

    return function logProgress() {
        completed++;
        const currentPercentage = Math.floor((completed / total) * 100);
        const milestone = Math.floor(currentPercentage / 20) * 20;

        if (milestone > lastMilestone) {
            console.log(`${label} ${completed}/${total} test cases`);
            lastMilestone = milestone;
        }
    };
}
