import * as vscode from 'vscode'
import type {Route} from './RouteCodeLensProvider'
import {getMethodsFromContent} from '../libs/Parser'
import * as config from '../libs/Config'
import {getRouteCopyPrefix} from '../libs/Config'
import {removeNamePrefix, resolveUrl} from '../util'

export type MiddlewareTarget = {
    class : string
    path  : string
    line  : number
}

export type MiddlewareMap = Record<string, MiddlewareTarget[]>

export function middlewareLabel(middleware: MiddlewareMap, name: string): string {
    const baseName = name.split(':', 1)[0]

    if (!baseName.includes('\\')) {
        return name
    }

    const targets = middleware[baseName]

    if (!targets?.length) {
        return name
    }

    const classes = new Set(targets.map(({class: middlewareClass}) => middlewareClass))
    const alias = Object.entries(middleware).find(([key, items]) =>
        !classes.has(key) && key !== baseName && items.some(({class: middlewareClass}) => classes.has(middlewareClass)),
    )?.[0]

    return alias ? `${alias}${name.slice(baseName.length)}` : name
}

type HoverContext = {
    previousHover?  : vscode.Hover
    verbosityDelta? : number
}

type VerboseHoverConstructor = new (
    contents: unknown,
    range?: vscode.Range,
    canIncreaseVerbosity?: boolean,
    canDecreaseVerbosity?: boolean,
) => vscode.Hover

const VerboseHover = (vscode as typeof vscode & {VerboseHover: VerboseHoverConstructor}).VerboseHover

export class RouteHoverProvider implements vscode.HoverProvider {
    private lastHover : vscode.Hover | undefined
    private verbosity = 0

    constructor(
        private readonly getRoutes: () => Promise<Route[]>,
        private readonly getClassMap: () => Promise<Map<string, string>>,
        private readonly getMiddleware: () => Promise<MiddlewareMap>,
        private readonly isRouteForMethod: (route: Route, filePath: string, method: string) => boolean,
    ) {}

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token?: vscode.CancellationToken,
        context?: HoverContext,
    ): Promise<vscode.Hover | undefined> {
        if (document.languageId !== 'php') {
            return undefined
        }

        const tabSize = config.getTabSize(document)
        const indent = '&nbsp;'.repeat(tabSize)

        if (!context || context.previousHover !== this.lastHover) {
            this.verbosity = config.expandHoverVerbosity() ? 1 : 0
        } else {
            this.verbosity = Math.max(0, this.verbosity + (context.verbosityDelta || 0))
        }

        const methods = getMethodsFromContent(document.getText())
        const method = methods.find((m) => m.position.line === position.line)

        if (!method) {
            return undefined
        }

        const [availableRoutes, availableMiddleware] = await Promise.all([this.getRoutes(), this.getMiddleware()])
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

        const cardParts: string[] = []

        // method, uri & name
        for (const route of matchedRoutes) {
            const urlCmnd = commandLink(`\`${resolveUrl(route.url)}\``, 'lgc.routeActions', route)

            cardParts.push(`${route.method}: ${urlCmnd}`)

            const name = removeNamePrefix(route.name)

            if (name) {
                const nameCmnd = commandLink(`\`${name}\``, 'lgc.copyToClipboard', getRouteCopyPrefix().replace('@', name))

                cardParts.push(`Name: ${nameCmnd}`)
            }
        }

        // middleware
        for (const route of matchedRoutes) {
            if (route.middleware.length > 0) {
                const useNewLine = route.middleware.some((middleware) => middlewareLabel(availableMiddleware, middleware).includes('\\'))

                const middlewares = route.middleware.map((middleware) => {
                    const targets = availableMiddleware[middleware.split(':', 1)[0]]
                    const label = middlewareLabel(availableMiddleware, middleware)
                    const mw = `${useNewLine ? indent : ''}\`${label}\``

                    if (targets?.length === 1) {
                        return commandLink(mw, 'lgc.openMiddleware', targets[0])
                    }

                    return targets?.length
                        ? commandLink(mw, 'lgc.showMiddleware', {middleware})
                        : mw
                })

                const separator = useNewLine ? '\n\n' : ''
                const cmnd = middlewares.join(useNewLine ? '\n\n' : ', ')

                cardParts.push(`Middleware: [${separator}${cmnd}${separator}]`)
            }
        }

        // VerboseHover
        const markdown = new vscode.MarkdownString(this.verbosity
            ? cardParts.join('\n\n')
            : 'Route metadata')
        markdown.isTrusted = {enabledCommands: ['lgc.routeActions', 'lgc.copyToClipboard', 'lgc.openMiddleware', 'lgc.showMiddleware']}
        const hover = new VerboseHover(markdown, undefined, this.verbosity === 0, this.verbosity > 0)
        this.lastHover = hover

        return hover
    }
}

function commandLink(label: string, command: string, argument: unknown): string {
    return `[${label}](command:${command}?${encodeURIComponent(JSON.stringify([argument]))})`
}
