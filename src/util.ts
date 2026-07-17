import path from 'node:path'
import * as config from './libs/Config'

export function removeNamePrefix(name: string): string {
    const prefixes = config.getRemoveNamePrefix()
    const prefix = prefixes.find((item) => name.startsWith(item))

    return prefix ? name.slice(prefix.length) : name
}

export function resolveClassPath(filePath: string, cwd: string, dockerVolumePath?: string): string {
    const volumePath = dockerVolumePath?.replace(/\/+$/, '')

    if (volumePath && (filePath === volumePath || filePath.startsWith(`${volumePath}/`))) {
        return path.normalize(path.join(cwd, filePath.slice(volumePath.length)))
    }

    return path.normalize(filePath.startsWith(cwd) ? filePath : path.join(cwd, filePath))
}

export function getRouteTarget(action: string): [string, string] {
    const separator = action.includes('@') ? '@' : action.includes('::') ? '::' : undefined
    const [controller, actionMethod = '__invoke'] = separator
        ? action.split(separator)
        : [action, '__invoke']

    return [controller.replace(/^\\/, ''), actionMethod]
}

export function shellQuote(text: string): string {
    return `'${text.replace(/'/g, `'\\''`)}'`
}

export function resolveUrl(url: string): string {
    return `/${url}`.replace('//', '/')
}
