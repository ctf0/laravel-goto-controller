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
    async provideDocumentLinks(doc: TextDocument): Promise<DocumentLink[]> {

        let range = window.activeTextEditor.visibleRanges[0]
        let reg = new RegExp(/(?<=route\()['"].*?['"]/, 'g')
        let documentLinks = []

        for (let i = range.start.line; i <= range.end.line; i++) {
            let line = doc.lineAt(i)
            let txt = line.text
            let result = txt.match(reg)

            if (result != null) {
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
            }
        }

        return documentLinks
    }
}
