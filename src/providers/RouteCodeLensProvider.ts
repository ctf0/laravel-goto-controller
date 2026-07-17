import * as vscode from 'vscode'
import {getMethodsFromContent} from '../libs/Parser'
import {getDisplayMode, getRouteCopyPrefix} from '../libs/Config'
import {removeNamePrefix, resolveUrl} from '../util'

export type Route = {
    method     : string
    url        : string
    name       : string
    action     : string
    middleware : string[]
}

export class RouteCodeLensProvider implements vscode.CodeLensProvider {
    private readonly changes = new vscode.EventEmitter<void>()
    readonly onDidChangeCodeLenses = this.changes.event

    constructor(
        private readonly getRoutes: () => Promise<Route[]>,
        private readonly getClassMap: () => Promise<Map<string, string>>,
        private readonly isRouteForMethod: (route: Route, filePath: string, method: string) => boolean,
    ) {}

    refresh(): void {
        this.changes.fire()
    }

    dispose(): void {
        this.changes.dispose()
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        if (getDisplayMode() !== 1) {
            return []
        }

        const lenses: vscode.CodeLens[] = []
        const renderedActions = new Set<string>()
        const [availableRoutes] = await Promise.all([this.getRoutes(), this.getClassMap()])

        for (const method of getMethodsFromContent(document.getText())) {
            const range = new vscode.Range(method.position, method.position)

            for (const route of availableRoutes) {
                if (!this.isRouteForMethod(route, document.uri.fsPath, method.name) || renderedActions.has(route.action)) {
                    continue
                }

                renderedActions.add(route.action)

                // url
                lenses.push(new vscode.CodeLens(range, {
                    title     : `${route.method}: ${resolveUrl(route.url)}`,
                    command   : 'lgc.routeActions',
                    tooltip   : 'open/copy url',
                    arguments : [route],
                }))

                // name
                const name = removeNamePrefix(route.name)

                if (name) {
                    lenses.push(new vscode.CodeLens(range, {
                        title     : `name: ${name}`,
                        command   : 'lgc.copyToClipboard',
                        tooltip   : 'copy',
                        arguments : [getRouteCopyPrefix().replace('@', name)],
                    }))
                }

                // middleware
                const singleMiddleware = route.middleware.length === 1

                lenses.push(new vscode.CodeLens(range, {
                    title     : `middleware: ${singleMiddleware ? route.middleware[0] : '[...]'}`,
                    command   : 'lgc.showMiddleware',
                    tooltip   : singleMiddleware ? '' : 'show list',
                    arguments : [route],
                }))
            }
        }

        return lenses
    }
}
