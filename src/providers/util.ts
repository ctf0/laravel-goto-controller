import path from 'node:path'
import * as config from './Config'
import type {Route} from './RouteCodeLensProvider'

export function removeNamePrefix(name: string): string {
    const prefixes = config.getRemoveNamePrefix()
    const prefix = prefixes.find((item) => name.startsWith(item))

    return prefix ? name.slice(prefix.length) : name
}

export function renderRouteAttribute(route: Route): string {
    const method = route.method.split('|')[0].toLowerCase()
    const methodName = method.charAt(0).toUpperCase() + method.slice(1)

    return `#[${methodName}(${quoteAttributeValue(route.url)}, name: ${quoteAttributeValue(removeNamePrefix(route.name))}, middleware: ${route.middleware.length === 1 ? quoteAttributeValue(route.middleware[0]) : '[]'}]`
}

export function quoteAttributeValue(value: string): string {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`
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
