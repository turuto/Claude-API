// Runs `fn` over `items` with at most `limit` calls in flight at once — the async
// equivalent of Python's ThreadPoolExecutor(max_workers=...). Each worker pulls the next
// unclaimed index until the queue is empty, so slow items don't block workers that could
// pick up the next one.
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

// Logs "<label> N/total test cases" every time completion crosses a new 20% mark, instead
// of once per item — keeps long dataset/eval runs from flooding the console.
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
