import * as vscode from 'vscode'
import type {Route} from './RouteCodeLensProvider'
import {getMethodsFromContent} from './Parser'
import * as config from './Config'
import {renderRouteAttribute} from './util'

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

        const [availableRoutes] = await Promise.all([this.getRoutes(), this.getClassMap()])
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
                        before : {contentText: renderRouteAttribute(route)},
                    },
                })
            }
        }

        editor.setDecorations(this.type, decorations)
    }
}
