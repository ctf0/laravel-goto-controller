import * as PhpParser from 'php-parser';
import * as vscode from 'vscode';

const Parser = new PhpParser.Engine({
    parser: {
        locations     : true,
        extractTokens : true,
    },
    ast: {
        withPositions: true,
    },
});

export function buildASTFromContent(content: string) {
    try {
        return Parser
            .parseCode(content, '*.php')
            ?.children
            ?.filter((item) => item.kind === 'expressionstatement')
            ?.map((item) => {
                const expression = item.expression;

                if (expression.arguments.length > 1) {
                    return expression.arguments;
                }

                return expression.what.what.arguments;
            });
    } catch (error) {
        // console.error(error);
        throw new Error(error);
    }
}

export function getRangeFromLoc(start: { line: number; column: number; }, end: { line: number; column: number; }): vscode.Range {
    return new vscode.Range(
        new vscode.Position(start.line - 1, start.column + 1),
        new vscode.Position(end.line - 1, end.column - 1),
    );
}
