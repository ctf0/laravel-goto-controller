import * as vscode from 'vscode'
import type {Route} from './RouteCodeLensProvider'
import {middlewareLabel} from './RouteHoverProvider'
import type {MiddlewareMap} from './RouteHoverProvider'
import {getMethodsFromContent} from '../libs/Parser'
import * as config from '../libs/Config'
import {removeNamePrefix, resolveUrl} from '../util'

export class RouteDecorationProvider implements vscode.Disposable {
    private readonly type = vscode.window.createTextEditorDecorationType({
        before : {
            color          : new vscode.ThemeColor('editorCodeLens.foreground'),
            margin         : '0 0.5em 0 0',
            textDecoration : config.getLineDecorationStyles(),
        },
    })

    constructor(
        private readonly getRoutes: () => Promise<Route[]>,
        private readonly getClassMap: () => Promise<Map<string, string>>,
        private readonly getMiddleware: () => Promise<MiddlewareMap>,
        private readonly isRouteForMethod: (route: Route, filePath: string, method: string) => boolean,
    ) {}

    dispose(): void {
        this.type.dispose()
    }

    refresh(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.update(editor)
        }
    }

    async update(editor: vscode.TextEditor | undefined): Promise<void> {
        if (!editor || editor.document.languageId !== 'php' || config.getDisplayMode() !== 2) {
            editor?.setDecorations(this.type, [])

            return
        }

        const [availableRoutes, , availableMiddleware] = await Promise.all([
            this.getRoutes(),
            this.getClassMap(),
            this.getMiddleware(),
        ])
        const decorations: vscode.DecorationOptions[] = []
        const renderedActions = new Set<string>()

        for (const method of getMethodsFromContent(editor.document.getText(), 0)) {
            for (const route of availableRoutes) {
                if (!this.isRouteForMethod(route, editor.document.uri.fsPath, method.name)
                  || renderedActions.has(route.action)) {
                    continue
                }

                renderedActions.add(route.action)
                decorations.push({
                    range         : new vscode.Range(method.position, method.position),
                    renderOptions : {
                        before : {contentText: this.renderRouteAttribute(route, availableMiddleware)},
                    },
                })
            }
        }

        editor.setDecorations(this.type, decorations)
    }

    renderRouteAttribute(route: Route, middlewareMap: MiddlewareMap): string {
        const method = route.method.split('|')[0].toLowerCase()
        const methodName = method.charAt(0).toUpperCase() + method.slice(1)
        const middlewareNames = route.middleware
            .map((name) => middlewareLabel(middlewareMap, name))
            .filter((name) => !name.includes('\\'))
        const hasHiddenMiddleware = middlewareNames.length < route.middleware.length
        const middleware = route.middleware.length === 1
            ? this.quoteAttributeValue(middlewareLabel(middlewareMap, route.middleware[0]))
            : `[${[...middlewareNames, ...(hasHiddenMiddleware ? ['...'] : [])].join(', ')}]`

        return `#[${methodName}(${this.quoteAttributeValue(resolveUrl(route.url))}, name:${this.quoteAttributeValue(removeNamePrefix(route.name))}, middleware:${middleware}]`
    }

    quoteAttributeValue(value: string): string {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`
    }
}
