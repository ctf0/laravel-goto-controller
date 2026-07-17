import * as vscode from 'vscode'

export const extensionPrefix = 'Laravel Goto Controller'

const outputChannel = vscode.window.createOutputChannel(extensionPrefix)

export function logCommandResult(command: string, stdout: string, stderr: string): void {
    logMessage(`$ ${command}`)
    logMessage(stdout || '(no stdout)')

    if (stderr) {
        logMessage(`[stderr]\n${stderr}`)
    }

    logMessage('--------------------------------')
    logMessage('--------------------------------')
}

export function logMessage(message: string): void {
    outputChannel.appendLine(message)
}
