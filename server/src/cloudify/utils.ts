/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    CompletionItem,
    CompletionItemKind,
} from 'vscode-languageserver/node';

export function getCompletionItem(newLabel:string, newData:number): CompletionItem {
    return {
        label: newLabel,
        kind: CompletionItemKind.Text,
        data: newData,
    };
}

export function appendCompletionItems(mainList:CompletionItem[], newList:string[]) {
    let currentIndex:number = mainList.length;
    for (const keyword of newList) {
        mainList.push(getCompletionItem(keyword, currentIndex));
        currentIndex++;
    }
    return mainList;
}
