import * as vscode from 'vscode'
import {RouteCodeLensProvider} from './providers/RouteCodeLensProvider'
import {RouteDecorationProvider} from './providers/RouteDecorationProvider'
import {RouteHoverProvider} from './providers/RouteHoverProvider'
import {ThrottleLinkProvider} from './providers/ThrottleLinkProvider'
import {ControllerLinkProvider} from './providers/ControllerLinkProvider'
import {registerCommands} from './libs/Commands'
import {getClassMap, getMiddleware, getRoutes, handleConfigurationChange, isRouteForMethod} from './libs/LaravelData'

const EXT = 'php'

export async function activate({subscriptions}: vscode.ExtensionContext) {
    await getRoutes()

    const codeLensProvider = new RouteCodeLensProvider(getRoutes, getClassMap, isRouteForMethod)
    const decorationProvider = new RouteDecorationProvider(getRoutes, getClassMap, getMiddleware, isRouteForMethod)
    const hoverProvider = new RouteHoverProvider(getRoutes, getClassMap, getMiddleware, isRouteForMethod)
    const throttleLinkProvider = new ThrottleLinkProvider()
    const controllerLinkProvider = new ControllerLinkProvider(getClassMap)

    subscriptions.push(
        vscode.languages.registerCodeLensProvider(EXT, codeLensProvider),
        codeLensProvider,
        decorationProvider,
        vscode.languages.registerHoverProvider(EXT, hoverProvider),
        vscode.languages.registerDocumentLinkProvider(EXT, throttleLinkProvider),
        vscode.languages.registerDocumentLinkProvider(EXT, controllerLinkProvider),
        vscode.window.onDidChangeActiveTextEditor((editor) => decorationProvider.update(editor)),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document === vscode.window.activeTextEditor?.document) {
                decorationProvider.update(vscode.window.activeTextEditor)
            }
        }),
        vscode.workspace.onDidChangeConfiguration((event) => {
            handleConfigurationChange(event)
            codeLensProvider.refresh()
            decorationProvider.refresh()
            throttleLinkProvider.refresh()
        }),
        ...registerCommands(getMiddleware),
    )

    decorationProvider.refresh()
}

export function deactivate(): void {}
