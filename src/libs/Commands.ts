import * as vscode from 'vscode'
import {Route} from '../providers/RouteCodeLensProvider'
import {getAppUrl, showMiddlewarePath} from './Config'
import {extensionPrefix} from './OutputChannel'
import {middlewareLabel} from '../providers/RouteHoverProvider'
import type {MiddlewareMap, MiddlewareTarget} from '../providers/RouteHoverProvider'
import {resolveUrl} from '../util'

let appUrl = ''

export function registerCommands(getMiddleware: () => Promise<MiddlewareMap>): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('lgc.routeActions', chooseRouteAction),
        vscode.commands.registerCommand('lgc.copyToClipboard', copyToClipboard),
        vscode.commands.registerCommand('lgc.openMiddleware', openMiddleware),
        vscode.commands.registerCommand('lgc.showMiddleware', (value: Route | {middleware: string}) =>
            typeof value.middleware === 'string' ? showMiddlewareTargets(value.middleware, getMiddleware) : showMiddleware(value, getMiddleware)),
        vscode.commands.registerCommand('lgc.noAction', () => undefined),
        vscode.commands.registerCommand('lgc.addAppUrl', saveAppUrl),
    ]
}

async function chooseRouteAction(route: Route) {
    const url = buildUrl(route.url)
    const choices = route.method.split('|').includes('GET') && url
        ? ['Open URL', 'Copy URL']
        : ['Copy URL']
    const choice = choices.length === 1
        ? choices[0]
        : await vscode.window.showQuickPick(choices, {placeHolder: `${route.method} ${resolveUrl(route.url)}`})

    if (choice === 'Open URL') {
        await vscode.env.openExternal(vscode.Uri.parse(url))
    } else if (choice === 'Copy URL') {
        const copiedUrl = url || route.url
        await vscode.env.clipboard.writeText(copiedUrl)
        vscode.window.showInformationMessage(`${extensionPrefix} : ${copiedUrl}`)
    }
}

async function copyToClipboard(value: string) {
    await vscode.env.clipboard.writeText(value)
    vscode.window.showInformationMessage(`${extensionPrefix} : "${value}" copied`)
}

async function openMiddleware({path, line}: MiddlewareTarget) {
    const position = new vscode.Position(Math.max(0, line - 1), 0)
    await vscode.window.showTextDocument(vscode.Uri.file(path), {selection: new vscode.Range(position, position)})
}

async function chooseMiddlewareTarget(targets: MiddlewareTarget[]) {
    const showPath = showMiddlewarePath()
    const choice = await vscode.window.showQuickPick(targets.map((target) => ({
        label   : target.class,
        tooltip : showPath ? vscode.workspace.asRelativePath(target.path) : undefined,
        target,
    })))

    if (choice) {
        await openMiddleware(choice.target)
    }
}

async function showMiddlewareTargets(name: string, getMiddleware: () => Promise<MiddlewareMap>) {
    const targets = (await getMiddleware())[name.split(':', 1)[0]]

    if (targets?.length && targets.length > 1) {
        await chooseMiddlewareTarget(targets)
    }
}

async function showMiddleware(route: Route, getMiddleware: () => Promise<MiddlewareMap>) {
    const middleware = await getMiddleware()
    const showPath = showMiddlewarePath()
    const choices = route.middleware.length
        ? route.middleware.map((name) => {
            const targets = middleware[name.split(':', 1)[0]]

            return {
                label  : middlewareLabel(middleware, name),
                detail : showPath && targets?.length === 1 ? vscode.workspace.asRelativePath(targets[0].path) : undefined,
            }
        })
        : [{label: 'No middleware'}]

    const choice = await vscode.window.showQuickPick(choices, {
        placeHolder : `${route.method} ${resolveUrl(route.url)} middleware`,
    })

    if (!choice || choice.label === 'No middleware') {
        return
    }

    const targets = middleware[choice.label.split(':', 1)[0]]

    if (targets?.length === 1) {
        await openMiddleware(targets[0])
    } else if (targets?.length && targets.length > 1) {
        await chooseMiddlewareTarget(targets)
    }
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
