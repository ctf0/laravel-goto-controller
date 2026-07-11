import * as vscode from 'vscode'
import {Route} from './RouteCodeLensProvider'
import {getAppUrl} from './Config'

let appUrl = ''

export function registerCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('lgc.routeActions', chooseRouteAction),
        vscode.commands.registerCommand('lgc.showMiddleware', showMiddleware),
        vscode.commands.registerCommand('lgc.noAction', () => undefined),
        vscode.commands.registerCommand('lgc.addAppUrl', saveAppUrl),
    ]
}

async function chooseRouteAction(route: Route) {
    const url = buildUrl(route.url)
    const choices = route.method.split('|').includes('GET') && url
        ? ['Open URL', 'Copy URL']
        : ['Copy URL']
    const choice = await vscode.window.showQuickPick(choices, {placeHolder: `${route.method} ${route.url}`})

    if (choice === 'Open URL') {
        await vscode.env.openExternal(vscode.Uri.parse(url))
    } else if (choice === 'Copy URL') {
        const copiedUrl = url || route.url
        await vscode.env.clipboard.writeText(copiedUrl)
        vscode.window.showInformationMessage(`Route URL copied: ${copiedUrl}`)
    }
}

function showMiddleware(route: Route) {
    return vscode.window.showQuickPick(route.middleware.length ? route.middleware : ['No middleware'], {
        placeHolder : `${route.method} ${route.url} middleware`,
    })
}

function buildUrl(url: string): string {
    const baseUrl = getAppUrl() || appUrl

    if (/^https?:\/\//i.test(url) || !baseUrl) {
        return url
    }

    return `${baseUrl}/${url.replace(/^\/+/, '')}`
}

async function saveAppUrl() {
    const appUrlInput = await vscode.window.showInputBox({
        placeHolder   : 'project APP_URL',
        value         : appUrl || await vscode.env.clipboard.readText(),
        validateInput : (input) => input ? '' : 'You have to add an APP_URL',
    })

    if (appUrlInput) {
        appUrl = appUrlInput.replace(/\/+$/, '')
    }
}
