import * as vscode from 'vscode'

const outputChannel = vscode.window.createOutputChannel('Laravel Goto Controller')

export function logCommandResult(command: string, stdout: string, stderr: string): void {
    outputChannel.appendLine(`$ ${command}`)
    outputChannel.appendLine(stdout || '(no stdout)')

    if (stderr) {
        outputChannel.appendLine(`[stderr]\n${stderr}`)
    }

    outputChannel.appendLine('--------------------------------')
    outputChannel.appendLine('--------------------------------')
}
