import * as vscode from 'vscode'
import {execaCommand} from 'execa'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {Route, RouteCodeLensProvider} from './providers/RouteCodeLensProvider'
import {RouteDecorationProvider} from './providers/RouteDecorationProvider'
import {MiddlewareMap, RouteHoverProvider} from './providers/RouteHoverProvider'
import {extensionPrefix, logCommandResult, logMessage} from './libs/OutputChannel'
import * as config from './libs/Config'
import {registerCommands} from './libs/Commands'
import {resolveClassPath, getRouteTarget, shellQuote} from './util'
import {beginPhpCommandBackoff, isPhpCommandBackoffActive, resetPhpCommandBackoff} from './libs/PhpCommandBackoff'

let routeCache: Route[] | undefined
let routeCacheRequest: Promise<Route[]> | undefined
let classMap: Map<string, string> | undefined
let classMapRequest: Promise<Map<string, string>> | undefined
let middlewareMap: MiddlewareMap | undefined
let middlewareMapRequest: Promise<MiddlewareMap> | undefined

export async function activate({subscriptions}: vscode.ExtensionContext) {
    await getRoutes()

    const codeLensProvider = new RouteCodeLensProvider(getRoutes, getClassMap, isRouteForMethod)
    const decorationProvider = new RouteDecorationProvider(getRoutes, getClassMap, getMiddleware, isRouteForMethod)
    const hoverProvider = new RouteHoverProvider(getRoutes, getClassMap, getMiddleware, isRouteForMethod)

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
            if (config.changed(event, 'classmap_file', 'routeListCommand', 'phpCommand')) {
                resetPhpCommandBackoff()
            }

            if (config.changed(event, 'classmap_file', 'phpCommand')) {
                classMap = undefined
                classMapRequest = undefined
            }

            if (config.changed(event, 'routeListCommand', 'phpCommand')) {
                routeCache = undefined
                routeCacheRequest = undefined
            }

            if (config.changed(event, 'displayMode', 'removeNamePrefix', 'classmap_file', 'phpCommand', 'routeListCommand')) {
                codeLensProvider.refresh()
                decorationProvider.refresh()
            }
        }),
        ...registerCommands(getMiddleware),
    )

    decorationProvider.refresh()
}

async function getClassMap(): Promise<Map<string, string>> {
    if (classMap) {
        return classMap
    }

    if (isPhpCommandBackoffActive()) {
        return new Map()
    }

    const request = classMapRequest ??= loadClassMap()
        .then((loadedClassMap) => {
            resetPhpCommandBackoff()

            return classMap = loadedClassMap
        })
        .finally(() => {
            classMapRequest = undefined
        })

    try {
        return await request
    } catch (error) {
        notifyPhpCommandError(error)
        classMap = new Map()

        return classMap
    }
}

async function getMiddleware(): Promise<MiddlewareMap> {
    if (middlewareMap) {
        return middlewareMap
    }

    if (isPhpCommandBackoffActive()) {
        return {}
    }

    const request = middlewareMapRequest ??= loadMiddleware()
        .then((loadedMiddleware) => {
            resetPhpCommandBackoff()

            return middlewareMap = loadedMiddleware
        })
        .finally(() => {
            middlewareMapRequest = undefined
        })

    try {
        return await request
    } catch (error) {
        notifyPhpCommandError(error)
        middlewareMap = {}

        return middlewareMap
    }
}

async function getRoutes(): Promise<Route[]> {
    if (routeCache) {
        return routeCache
    }

    if (isPhpCommandBackoffActive()) {
        return []
    }

    const request = routeCacheRequest ??= loadRoutes()
        .then((loadedRoutes) => {
            resetPhpCommandBackoff()
            routeCache = loadedRoutes

            return routeCache
        })
        .finally(() => {
            routeCacheRequest = undefined
        })

    try {
        return await request
    } catch (error) {
        notifyPhpCommandError(error)

        return routeCache ?? []
    }
}

function notifyPhpCommandError(error: unknown): void {
    if (!beginPhpCommandBackoff()) {
        return
    }

    vscode.window.showErrorMessage(`${extensionPrefix}: ${error instanceof Error ? error.message : error}`)
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

async function loadMiddleware(): Promise<MiddlewareMap> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    const phpCommand = config.getPhpCommand()
    const dockerVolumePath = config.getDockerVolumePath()

    if (!cwd) {
        return {}
    }

    const phpCode = readFileSync(path.join(__dirname, '../scripts/load-middleware.php'), 'utf8')
    const command = `${phpCommand} -r ${shellQuote(phpCode)}`
    const {stdout, stderr} = await execaCommand(command, {cwd, shell: true})
    logCommandResult(command, stdout, stderr)
    const middleware = JSON.parse(stdout) as MiddlewareMap

    for (const targets of Object.values(middleware)) {
        for (const target of targets) {
            target.path = resolveClassPath(target.path, cwd, dockerVolumePath)
        }
    }

    for (const target of Object.values(middleware).flat()) {
        middleware[target.class] ??= [target]
    }

    logMessage(`Middleware map:\n${JSON.stringify(middleware, null, 2)}`)

    return middleware
}

function isRouteForMethod(route: Route, filePath: string, method: string): boolean {
    const [controller, actionMethod] = getRouteTarget(route.action)

    return path.normalize(classMap?.get(controller) || '') === path.normalize(filePath) && actionMethod === method
}
