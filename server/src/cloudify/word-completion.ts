/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {TimeManager, getCompletionItem} from './utils';
import {CompletionItem} from 'vscode-languageserver/node';

export class words {
    timer:TimeManager;
    keywords: CompletionItem[];
    constructor() {
        this.timer = new TimeManager(0.05);
        this.keywords = [];
    }
    appendKeyword = (keyword:string)=>{
        const keywordNames = this.keywords.map((obj) => obj.label);
        if (!keywordNames.includes(keyword)) {
            const currentIndex = this.keywords.length;
            this.keywords.push(
                getCompletionItem(keyword, currentIndex)
            );    
        }
    };
    appendCompletionItem = (keyword:string, target:CompletionItem[])=>{
        const keywordNames = target.map((obj) => obj.label);
        if (!keywordNames.includes(keyword)) {
            const currentIndex = target.length;
            target.push(
                getCompletionItem(keyword, currentIndex)
            );    
        }
    };
    appendCompletionItems=(keywords:string[], target:CompletionItem[])=>{
        for (const keyword of keywords) {
            this.appendCompletionItem(keyword, target);
        }
    };
    appendPluginCompletionItems=(keywords:string[], target:CompletionItem[])=>{
        for (let keyword of keywords) {
            keyword = 'plugin:' + keyword;
            this.appendCompletionItem(keyword, target);
        }
    };
}
