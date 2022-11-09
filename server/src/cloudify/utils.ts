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

export interface JSONItems<T> {
    [key: string]: T;
}

export class TimeManager {
    readonly _obj = new Date();
    readonly start = this._obj.getTime();
    curr:number;
    last:number;
    interval:number;

    constructor(interval:number) {
        this.interval = interval;
        this.last = this.curr = this._obj.getTime();
    }

    assignCurr=()=> {
        this.curr = this._obj.getTime();
    };

    assignLast=()=> {
        this.last = this.curr;
    };

    isReady=()=>{
        this.assignCurr();
        if (this.last + this.interval >= this.curr) {
            this.assignLast();
            return true;
        } else {
            return false;
        }
    };

}
