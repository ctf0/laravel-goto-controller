import * as PhpParser from 'php-parser'
import * as vscode from 'vscode'

const Parser = new PhpParser.Engine({
    parser : {
        locations      : true,
        extractTokens  : true,
        suppressErrors : true,
    },
    ast : {
        withPositions : true,
    },
})

export function buildASTFromContent(content: string) {
    return getNodes(Parser.parseCode(content, '*.php')?.children)
}

export function getMethodsFromContent(content: string, lines: number = 1): {name: string, position: vscode.Position}[] {
    const methods = []

    walk(Parser.parseCode(content, '*.php'), (node) => {
        if (node.kind === 'method' && node.name?.name && node.loc?.start) {
            methods.push({
                name     : node.name.name,
                position : new vscode.Position((node.name.loc?.start.line ?? node.loc.start.line) - lines, node.loc.start.column),
            })
        }
    })

    return methods
}

function walk(node, visit) {
    if (!node || typeof node !== 'object') {
        return
    }

    visit(node)

    for (const [key, child] of Object.entries(node)) {
        if (key === 'loc' || key === 'tokens') {
            continue
        }

        if (Array.isArray(child)) {
            child.forEach((item) => walk(item, visit))
        } else {
            walk(child, visit)
        }
    }
}

function getNodes(items) {
    items = items?.filter((item) => item.kind === 'expressionstatement')
    const list = []

    for (const item of items) {
        const expression = item.expression
        const args = expression.arguments

        if (args) {
            if (args.length > 1) {
                list.push(args)
                continue
            }

            if (args.length === 1 && args[0].body?.children?.length) {
                list.push(...getNodes(args[0].body?.children))
                continue
            }
        }

        list.push(expression.what?.what?.arguments)
    }

    return list
}

export function getRangeFromLoc(start: {line: number, column: number}, end: {line: number, column: number}): vscode.Range {
    return new vscode.Range(
        new vscode.Position(start.line - 1, start.column + 1),
        new vscode.Position(end.line - 1, end.column - 1),
    )
}

export type ControllerGroupMethod = {
    name  : string
    range : vscode.Range
}

export type ControllerGroup = {
    controller : string
    methods    : ControllerGroupMethod[]
}

export function getControllerGroups(content: string): ControllerGroup[] {
    const groups: ControllerGroup[] = []
    const ast = Parser.parseCode(content, '*.php')
    const parents = buildParentMap(ast)
    const imports = getImports(ast)

    walk(ast, (node) => {
        if (node.kind !== 'call' || !isRouteStaticCall(node.what)) {
            return
        }

        const controllerCall = findAttachedCall(parents, node, 'controller')

        if (!controllerCall) {
            return
        }

        const groupCall = findAttachedCall(parents, controllerCall, 'group')

        if (!groupCall) {
            return
        }

        const controller = resolveClassName(getClassNameFromArg(controllerCall.arguments?.[0]), imports)
        const methods = getRouteMethods(groupCall.arguments)

        if (controller && methods.length) {
            groups.push({controller, methods})
        }
    })

    return groups
}

function getImports(ast): Map<string, string> {
    const imports = new Map<string, string>()

    walk(ast, (node) => {
        if (node.kind !== 'usegroup') {
            return
        }

        for (const item of node.items) {
            const alias = item.alias?.name
            const shortName = alias || item.name.split('\\').pop()

            if (shortName) {
                imports.set(shortName, item.name)
            }
        }
    })

    return imports
}

function resolveClassName(name: string | undefined, imports: Map<string, string>): string | undefined {
    if (!name) {
        return undefined
    }

    if (name.includes('\\')) {
        return name.replace(/^\\/, '')
    }

    return imports.get(name) ?? name
}

function buildParentMap(ast): Map<object, object> {
    const parents = new Map<object, object>()

    walk(ast, (node) => {
        for (const [key, child] of Object.entries(node)) {
            if (key === 'loc' || key === 'tokens') {
                continue
            }

            if (Array.isArray(child)) {
                child.forEach((item) => {
                    if (item && typeof item === 'object') {
                        parents.set(item, node)
                    }
                })
            } else if (child && typeof child === 'object') {
                parents.set(child, node)
            }
        }
    })

    return parents
}

function findAttachedCall(parents: Map<object, object>, node, name: string) {
    let current = node

    while (current) {
        const lookup = parents.get(current)

        if (lookup?.kind !== 'propertylookup') {
            return undefined
        }

        if (lookup.offset?.name === name) {
            const call = parents.get(lookup)

            return call?.kind === 'call' ? call : undefined
        }

        current = parents.get(lookup)
    }

    return undefined
}

function getClassNameFromArg(arg): string | undefined {
    if (arg?.kind === 'staticlookup' && arg.offset?.name === 'class') {
        return arg.what?.name
    }

    return undefined
}

function getRouteMethods(args): ControllerGroupMethod[] {
    const methods: ControllerGroupMethod[] = []
    const closure = args?.find((arg) => arg.kind === 'closure')

    if (!closure?.body?.children) {
        return methods
    }

    walk(closure.body, (node) => {
        if (node.kind !== 'call' || !isRouteStaticCall(node.what)) {
            return
        }

        const methodArg = node.arguments?.[1]

        if (methodArg?.kind === 'string' && !methodArg.value.includes('@')) {
            methods.push({
                name  : methodArg.value,
                range : getRangeFromLoc(methodArg.loc.start, methodArg.loc.end),
            })
        }
    })

    return methods
}

function isRouteStaticCall(node): boolean {
    return node?.kind === 'staticlookup' && node.what?.name === 'Route'
}
