import * as vscode from 'vscode'
import {execaCommand} from 'execa'
import path from 'node:path'
import {Route, RouteCodeLensProvider} from './providers/RouteCodeLensProvider'
import {RouteDecorationProvider} from './providers/RouteDecorationProvider'
import {RouteHoverProvider} from './providers/RouteHoverProvider'
import {logCommandResult} from './providers/OutputChannel'
import * as config from './providers/Config'
import {registerCommands} from './providers/Commands'
import {resolveClassPath, getRouteTarget, shellQuote} from './providers/util'

let routeCache: Route[] = []
let routeCacheUpdatedAt = 0
let routeCacheRequest: Promise<Route[]> | undefined
let classMap: Map<string, string> | undefined
let classMapRequest: Promise<Map<string, string>> | undefined

export async function activate({subscriptions}: vscode.ExtensionContext) {
    await getRoutes()

    const codeLensProvider = new RouteCodeLensProvider(getRoutes, getClassMap, isRouteForMethod)
    const decorationProvider = new RouteDecorationProvider(getRoutes, getClassMap, isRouteForMethod)
    const hoverProvider = new RouteHoverProvider(getRoutes, getClassMap, isRouteForMethod)

    subscriptions.push(
        vscode.languages.registerCodeLensProvider('php', codeLensProvider),
        codeLensProvider,
        decorationProvider,
        vscode.languages.registerHoverProvider('php', hoverProvider),
        vscode.window.onDidChangeActiveTextEditor((editor) => decorationProvider.update(editor)),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document === vscode.window.activeTextEditor?.document) {
                decorationProvider.update(vscode.window.activeTextEditor)
            }
        }),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (config.changed(event, 'classmap_file', 'phpCommand')) {
                classMap = undefined
                classMapRequest = undefined
            }

            if (config.changed(event, 'routeCacheTimeout', 'routeListCommand', 'phpCommand')) {
                routeCacheUpdatedAt = 0
            }

            if (config.changed(event, 'displayMode', 'removeNamePrefix', 'classmap_file', 'phpCommand', 'routeListCommand', 'routeCacheTimeout')) {
                codeLensProvider.refresh()
                decorationProvider.refresh()
            }
        }),
        ...registerCommands(),
    )

    decorationProvider.refresh()
}

async function getClassMap(): Promise<Map<string, string>> {
    if (classMap) {
        return classMap
    }

    const request = classMapRequest ??= loadClassMap()
        .then((loadedClassMap) => classMap = loadedClassMap)
        .finally(() => {
            classMapRequest = undefined
        })

    try {
        return await request
    } catch (error) {
        vscode.window.showErrorMessage(`Laravel classmap failed: ${error instanceof Error ? error.message : error}`)
        classMap = new Map()

        return classMap
    }
}

async function getRoutes(): Promise<Route[]> {
    const timeoutMinutes = config.getRouteCacheTimeout()

    if (routeCacheUpdatedAt && Date.now() - routeCacheUpdatedAt < timeoutMinutes * 60 * 1000) {
        return routeCache
    }

    const request = routeCacheRequest ??= loadRoutes()
        .then((loadedRoutes) => {
            routeCache = loadedRoutes
            routeCacheUpdatedAt = Date.now()

            return routeCache
        })
        .finally(() => {
            routeCacheRequest = undefined
        })

    try {
        return await request
    } catch (error) {
        vscode.window.showErrorMessage(`Laravel route list failed: ${error instanceof Error ? error.message : error}`)

        return routeCache
    }
}

async function loadRoutes(): Promise<Route[]> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    const phpCommand = config.getPhpCommand()
    const routeListCommand = config.getRouteListCommand()

    if (!cwd) {
        return []
    }

    const command = `${phpCommand} ${routeListCommand}`
    const {stdout, stderr} = await execaCommand(command, {cwd, shell: true})
    logCommandResult(command, stdout, stderr)

    return JSON.parse(stdout).map((route: {uri: string, name?: string, action: string, method: string, middleware?: string | string[]}) => ({
        method     : route.method,
        url        : route.uri,
        name       : route.name || '',
        action     : route.action,
        middleware : Array.isArray(route.middleware)
            ? route.middleware
            : route.middleware ? route.middleware.split(',').map((item) => item.trim()).filter(Boolean) : [],
    }))
}

async function loadClassMap(): Promise<Map<string, string>> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    const classmapFile = config.getClassmapFile()
    const phpCommand = config.getPhpCommand()
    const dockerVolumePath = config.getDockerVolumePath()
    const classmapUris = await vscode.workspace.findFiles(classmapFile, null, 1)

    if (!cwd || !classmapUris.length) {
        return new Map()
    }

    const classmapUri = classmapUris[0]
    const relativeClassmapPath = path.relative(cwd, classmapUri.fsPath).split(path.sep).join('/')
    const classmapPath = dockerVolumePath
        ? `${dockerVolumePath.replace(/\/+$/, '')}/${relativeClassmapPath}`
        : classmapUri.fsPath
    const phpCode = `echo json_encode(require ${JSON.stringify(classmapPath)}, JSON_PRETTY_PRINT);`
    const command = `${phpCommand} -r ${shellQuote(phpCode)}`
    const {stdout, stderr} = await execaCommand(command, {cwd, shell: true})
    logCommandResult(command, stdout, stderr)
    const classmap = JSON.parse(stdout) as Record<string, string>

    return new Map(Object.entries(classmap).map(([className, filePath]) => [
        className,
        resolveClassPath(filePath, cwd, dockerVolumePath),
    ]))
}

function isRouteForMethod(route: Route, filePath: string, method: string): boolean {
    const [controller, actionMethod] = getRouteTarget(route.action)

    return path.normalize(classMap?.get(controller) || '') === path.normalize(filePath) && actionMethod === method
}
