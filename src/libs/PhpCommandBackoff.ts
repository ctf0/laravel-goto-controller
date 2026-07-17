const PHP_COMMAND_BACKOFF = [5, 15, 30, 60]

let backoffUntil = 0
let backoffIndex = 0

export function isPhpCommandBackoffActive(): boolean {
    return backoffUntil > Date.now()
}

export function beginPhpCommandBackoff(): boolean {
    const now = Date.now()

    if (backoffUntil > now) {
        return false
    }

    const backoffSeconds = PHP_COMMAND_BACKOFF[backoffIndex]
    backoffIndex = Math.min(backoffIndex + 1, PHP_COMMAND_BACKOFF.length - 1)
    backoffUntil = now + backoffSeconds * 1_000

    return true
}

export function resetPhpCommandBackoff(): void {
    backoffUntil = 0
    backoffIndex = 0
}
