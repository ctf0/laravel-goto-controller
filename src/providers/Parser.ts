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
                position : new vscode.Position(node.loc.start.line - lines, node.loc.start.column),
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
