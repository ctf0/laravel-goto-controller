import * as vscode from 'vscode'
import {getControllerGroups} from '../libs/Parser'
import {logMessage} from '../libs/OutputChannel'
import type {ThrottleFile} from './ThrottleLinkProvider'

export class ControllerLinkProvider implements vscode.DocumentLinkProvider {
    constructor(
        private readonly getClassMap: () => Promise<Map<string, string>>,
    ) {}

    async provideDocumentLinks(doc: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
        if (doc.languageId !== 'php') {
            return []
        }

        const classMap = await this.getClassMap()
        const groups = getControllerGroups(doc.getText())
        const links: vscode.DocumentLink[] = []

        for (const group of groups) {
            const filePath = classMap.get(group.controller)

            logMessage(`[ControllerLink] resolving "${group.controller}" -> ${filePath ?? 'NOT FOUND'}`)

            if (!filePath) {
                continue
            }

            const file: ThrottleFile = {
                label   : vscode.workspace.asRelativePath(filePath, false),
                fileUri : filePath,
            }

            for (const method of group.methods) {
                const args = encodeURIComponent(JSON.stringify([[file], method.name]))
                const link = new vscode.DocumentLink(
                    method.range,
                    vscode.Uri.parse(`command:lgc.openLink?${args}`),
                )
                link.tooltip = `${group.controller}::${method.name}()`

                links.push(link)
            }
        }

        return links
    }
}
