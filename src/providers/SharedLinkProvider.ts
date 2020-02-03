'use strict'

import {
    DocumentLinkProvider as vsDocumentLinkProvider,
    TextDocument,
    DocumentLink,
    Position,
    window,
    Range
} from "vscode"
import * as util from '../util'

export default class LinkProvider implements vsDocumentLinkProvider {
    ignore_Controllers
    route_methods

    constructor() {
        this.ignore_Controllers = util.ignore_Controllers
        this.route_methods = util.route_methods
    }

    async provideDocumentLinks(doc: TextDocument): Promise<DocumentLink[]> {
        let range = window.activeTextEditor.visibleRanges[0]
        let reg_route = new RegExp(`(?<=(${this.route_methods})\\()['"].*?['"]`, 'g')
        let reg_controller = new RegExp(/['"]\S+(?=Controller)(.*?)(?<!\.php)['"]/, 'g')
        let documentLinks = []

        for (let i = range.start.line; i <= range.end.line; i++) {
            let line = doc.lineAt(i)
            let txt = line.text
            let result_route = txt.match(reg_route)
            let result_controller = txt.match(reg_controller)

            if (result_route) {
                documentLinks.push(...await this.forRoutes(result_route, doc, line, txt))
            }

            if (result_controller) {
                documentLinks.push(...await this.forControllers(result_controller, doc, line, txt))
            }
        }

        return documentLinks
    }

    async forRoutes(result, doc, line, txt) {
        let documentLinks = []

        for (let found of result) {
            let files = await util.getRouteFilePath(found, doc)

            if (files.length) {
                for (const file of files) {
                    if (file) {
                        let start = new Position(line.lineNumber, txt.indexOf(found))
                        let end = start.translate(0, found.length)

                        let documentlink = new DocumentLink(new Range(start, end), file.fileUri)
                        documentlink.tooltip = file.tooltip
                        documentLinks.push(documentlink)
                    }
                }
            }
        }

        return documentLinks
    }

    async forControllers(result, doc, line, txt) {
        let documentLinks = []

        for (let found of result) {
            if (!new RegExp(`['"](${this.ignore_Controllers})['"]`).test(found)) {
                let files = await util.getControllerFilePaths(found, doc)

                if (files.length) {
                    for (const file of files) {
                        if (file) {
                            let start = new Position(line.lineNumber, txt.indexOf(found))
                            let end = start.translate(0, found.length)

                            let documentlink = new DocumentLink(new Range(start, end), file.fileUri)
                            documentlink.tooltip = file.tooltip
                            documentLinks.push(documentlink)
                        }
                    }
                }
            }
        }

        return documentLinks
    }
}
