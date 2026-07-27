export function average(numbers) {
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}
