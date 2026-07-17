import * as vscode from 'vscode'
import escapeStringRegexp from 'escape-string-regexp'
import {getThrottle, getThrottleSearchExclude} from '../libs/Config'

export type ThrottleFile = {
    label   : string
    fileUri : string
}

type ThrottleConfig = ReturnType<typeof getThrottle>

export class ThrottleLinkProvider implements vscode.DocumentLinkProvider {
    private definitionIndex : Map<string, ThrottleFile[]> | undefined
    private usageIndex      : Map<string, ThrottleFile[]> | undefined
    private cacheKey        = ''

    private methodRegex({method}: ThrottleConfig): RegExp {
        return new RegExp(`(?<=${escapeStringRegexp(method)}\\()['"]([^'"$*]*?)['"]`, 'g')
    }

    private callerRegex({caller}: ThrottleConfig): RegExp {
        return new RegExp(`${escapeStringRegexp(caller)}[A-Za-z_][A-Za-z0-9_.-]*`, 'g')
    }

    refresh(): void {
        this.cacheKey = ''
        this.definitionIndex = undefined
        this.usageIndex = undefined
    }

    async provideDocumentLinks(doc: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
        if (doc.languageId !== 'php') {
            return []
        }

        const config = getThrottle()
        const [definitionIndex, usageIndex] = await this.getIndexes(config)
        const links: vscode.DocumentLink[] = []
        const text = doc.getText()

        // usage side: throttle:name -> definition files
        for (const match of text.matchAll(this.callerRegex(config))) {
            const name = match[0].slice(config.caller.length)
            const files = definitionIndex.get(name)

            if (files?.length) {
                links.push(this.createLink(this.rangeAt(doc, match.index, match[0].length), files, name))
            }
        }

        // definition side: RateLimiter::for('name') -> usage files
        for (const match of text.matchAll(this.methodRegex(config))) {
            const files = usageIndex.get(match[1])

            if (files?.length) {
                const query = `${config.caller}${match[1]}`
                links.push(this.createLink(this.rangeAt(doc, match.index + 1, match[1].length), files, query))
            }
        }

        return links
    }

    private rangeAt(doc: vscode.TextDocument, index: number, length: number): vscode.Range {
        return new vscode.Range(doc.positionAt(index), doc.positionAt(index + length))
    }

    private async getIndexes(
        config: ThrottleConfig,
    ): Promise<[Map<string, ThrottleFile[]>, Map<string, ThrottleFile[]>]> {
        const cacheKey = `${config.method}|${config.caller}`

        if (this.cacheKey === cacheKey && this.definitionIndex && this.usageIndex) {
            return [this.definitionIndex, this.usageIndex]
        }

        const files = await this.readFiles()
        const definitionIndex = this.buildIndex(files, this.methodRegex(config), (match) => match[1])
        const usageIndex = this.buildIndex(files, this.callerRegex(config), (match) => match[0].slice(config.caller.length))

        this.cacheKey = cacheKey
        this.definitionIndex = definitionIndex
        this.usageIndex = usageIndex

        return [definitionIndex, usageIndex]
    }

    private buildIndex(
        files: {file: ThrottleFile, text: string}[],
        regex: RegExp,
        keyOf: (match: RegExpExecArray) => string,
    ): Map<string, ThrottleFile[]> {
        const index = new Map<string, ThrottleFile[]>()

        for (const {file, text} of files) {
            const keys = new Set([...text.matchAll(regex)].map(keyOf))

            for (const key of keys) {
                const related = index.get(key) || []
                related.push(file)
                index.set(key, related)
            }
        }

        return index
    }

    private async readFiles(): Promise<{file: ThrottleFile, text: string}[]> {
        const uris = await vscode.workspace.findFiles('**/*.php', getThrottleSearchExclude().join(','))
        const files: {file: ThrottleFile, text: string}[] = []

        for (let index = 0; index < uris.length; index += 16) {
            files.push(...await this.readBatch(uris.slice(index, index + 16)))
        }

        return files
    }

    private readBatch(uris: vscode.Uri[]) {
        return Promise.all(uris.map(async(uri) => ({
            file : {
                label   : vscode.workspace.asRelativePath(uri, false),
                fileUri : uri.fsPath,
            },
            text : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'),
        })))
    }

    private createLink(
        range: vscode.Range,
        files: ThrottleFile[],
        query: string,
    ): vscode.DocumentLink {
        const args = encodeURIComponent(JSON.stringify([files, query]))
        const link = new vscode.DocumentLink(
            range,
            vscode.Uri.parse(`command:lgc.openLink?${args}`),
        )
        link.tooltip = files.length === 1 ? files[0].label : 'Open related files'

        return link
    }
}
