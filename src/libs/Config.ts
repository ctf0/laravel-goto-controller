import * as vscode from 'vscode'

const section = 'laravelGotoController'

function config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(section)
}

export function changed(event: vscode.ConfigurationChangeEvent, ...keys: string[]): boolean {
    return keys.some((key) => event.affectsConfiguration(`${section}.${key}`))
}

export function getDisplayMode(): 0 | 1 | 2 {
    return config().get<0 | 1 | 2>('displayMode', 0)
}

export function expandHoverVerbosity(): boolean {
    return config().get<boolean>('expandHoverVerbosity', false)
}

export function showMiddlewarePath(): boolean {
    return config().get<boolean>('showMiddlewarePath', true)
}

export function getRouteCopyPrefix(): string {
    return config().get<string>('routeCopyPrefix')
}

export function getRemoveNamePrefix(): string[] {
    return config().get<string[]>('removeNamePrefix', [])
}

export function getPhpCommand(): string {
    return config().get<string>('phpCommand', 'php')
}

export function getRouteListCommand(): string {
    return config().get<string>('routeListCommand', 'artisan route:list --columns=uri,name,action,method --json')
}

export function getClassmapFile(): string {
    return config().get<string>('classmap_file', 'vendor/composer/autoload_classmap.php')
}

export function getDockerVolumePath(): string | undefined {
    return config().get<string>('dockerVolumePath')
}

export function getAppUrl(): string {
    return config().get<string>('appUrl')?.replace(/\/+$/, '') || ''
}

export function getLineDecorationStyles(): string {
    return config().get<string>('lineDecorationStyles')
}

export function getTabSize(document): number {
    return vscode.workspace.getConfiguration('editor', document.uri).get<number | 'auto'>('tabSize')
}
