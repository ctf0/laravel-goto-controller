import * as vscode from 'vscode'
import type {Route} from './RouteCodeLensProvider'
import {getMethodsFromContent} from './Parser'
import * as config from './Config'
import {removeNamePrefix} from './util'

export class RouteHoverProvider implements vscode.HoverProvider {
    constructor(
        private readonly getRoutes: () => Promise<Route[]>,
        private readonly getClassMap: () => Promise<Map<string, string>>,
        private readonly isRouteForMethod: (route: Route, filePath: string, method: string) => boolean,
    ) {}

    async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
        if (document.languageId !== 'php' || config.getDisplayMode() !== 3) {
            return undefined
        }

        const methods = getMethodsFromContent(document.getText())
        const method = methods.find((m) => m.position.line === position.line)

        if (!method) {
            return undefined
        }

        const [availableRoutes] = await Promise.all([this.getRoutes(), this.getClassMap()])
        const matchedRoutes: Route[] = []
        const renderedActions = new Set<string>()

        for (const route of availableRoutes) {
            if (!this.isRouteForMethod(route, document.uri.fsPath, method.name) || renderedActions.has(route.action)) {
                continue
            }

            renderedActions.add(route.action)
            matchedRoutes.push(route)
        }

        if (matchedRoutes.length === 0) {
            return undefined
        }

        const names = [...new Set(matchedRoutes.map((r) => removeNamePrefix(r.name)).filter(Boolean))]
        const cardParts: string[] = []

        for (const route of matchedRoutes) {
            cardParts.push(`**${route.method}** \`${route.url}\``)
        }

        if (names.length > 0) {
            if (names.length === 1) {
                cardParts.push(`Name: \`${names[0]}\``)
            } else {
                cardParts.push('Name:\n' + names.map((n) => `  - \`${n}\``).join('\n'))
            }
        }

        for (const route of matchedRoutes) {
            if (route.middleware.length > 0) {
                cardParts.push(`Middleware: [${route.middleware.map((m) => `\`${m}\``).join(', ')}]`)
            }
        }

        const markdown = new vscode.MarkdownString()
        markdown.appendMarkdown(cardParts.join('\n\n'))

        return new vscode.Hover(markdown)
    }
}
