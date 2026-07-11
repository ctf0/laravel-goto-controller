import * as vscode from 'vscode'
import {getMethodsFromContent} from './Parser'
import {getDisplayMode} from './Config'
import {removeNamePrefix} from './util'

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
                lenses.push(new vscode.CodeLens(range, {
                    title     : `method: ${route.method}`,
                    command   : 'lgc.routeActions',
                    arguments : [route],
                }))
                lenses.push(new vscode.CodeLens(range, {
                    title     : `uri: ${route.url}`,
                    command   : 'lgc.noAction',
                    arguments : [route],
                }))
                const name = removeNamePrefix(route.name)

                if (name) {
                    lenses.push(new vscode.CodeLens(range, {
                        title     : `name: ${name}`,
                        command   : 'lgc.noAction',
                        arguments : [route],
                    }))
                }

                lenses.push(new vscode.CodeLens(range, {
                    title     : `middleware: ${route.middleware.length === 1 ? route.middleware[0] : '[]'}`,
                    command   : 'lgc.showMiddleware',
                    arguments : [route],
                }))
            }
        }

        return lenses
    }
}
