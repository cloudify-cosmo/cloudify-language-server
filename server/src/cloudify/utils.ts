/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    CompletionItem,
    CompletionItemKind,
} from 'vscode-languageserver/node';
import { documentCursor } from './parsing';
import { names as documentationNames } from './documentation';


export function getNodeType(cursor:documentCursor) {
    for (let i = cursor.lineNumber - 1; i >= 0; i--) {
        const line = cursor.lines[i];
        // If the line isn't 0 indentation or contain any strings,
        // then it's not the start of a new section.

        if (line === undefined) {
            continue;
        }
        if (line.match(/\s+type:[A-Za-z0-9\s]/)) {
            return getTypeArgument(line);
        }
    }
    return '';

}

export function getTypeArgument(line:string):string {
    const split = line.split(/\s+type:(?:\s)/);
    if (split != null) {
        if (split.length == 2) {
            return split[1];
        }
    }
    return '';
}

export function getParentSection(cursor:documentCursor) {
    let parentSection = '';
    parentSection = _getParentSection(cursor.lineNumber, cursor.lines,  2);
    if (parentSection !== '') {
        parentSection = _getParentSection(cursor.lineNumber, cursor.lines, 4);
    }
    return parentSection;
}

function _getParentSection(lineNumber:number, lines:string[], offset:number) {
    for (let i = lineNumber - 1; i >= 0; i--) {
        const line = lines[i];
        // If the line isn't 0 indentation or contain any strings,
        // then it's not the start of a new section.

        if ((line === undefined) || (line.length == offset)) {
            continue;
        }
        const indentation = getIndentation(line);
        if (indentation != offset) {
            continue;
        }
        return line.slice(indentation);
    }
    return '';
}


export function validIndentationAndKeyword(line:string, keyword:string):boolean {
    const indentation:number = getIndentation(line);
    if ((!validIndentation(line)) && (line.slice(indentation).includes(keyword))) {
        return true;
    }
    return false;

}

export function validIndentation(s:string):boolean {
    return isListEven(s.split(/\s/));
}

function isListEven(split:string[]):boolean {
    return (((split.length) % 2) == 1);
}

export function getIndentation(s:string): number {
    const split = s.split(/[^\s\\]/g);
    return getIndentationSplit(split);
}

function getIndentationSplit(split:string[]) {
    if ((split[0] === '') || (split[0] === undefined)) {
        return 0;
    } else {
        return split[0].length;
    }
}

export function isIndented(line1:string, line2:string) {
    const lineLengthDiff = getIndentation(line1) - getIndentation(line2);
    if ((lineLengthDiff > 0) && (lineLengthDiff % 2 == 0)) {
        return true;
    }
    return false;
}

export function isCursorNewlyIndented(cursor:documentCursor) {
    if (cursor.lines === undefined) {
        return false;
    }
    return isIndented(
        cursor.lines[cursor.lines.length - 1],
        cursor.lines[cursor.lines.length - 2]
    );
}

export function fullPath (uri:string) {
    uri = uri.replace(/^file:\/{0,2}/, '/');
    uri = uri.replace('c%3A', '');
    uri = uri.replace(/^\/{2,}/, '/');
    return uri;
}

export function getCompletionItem(newLabel:string, newData:number): CompletionItem {
    // console.log(newLabel);
    let documentation = '';
    if (newLabel in documentationNames) {
        documentation = documentationNames[newLabel];
    } else if (newLabel.includes('cloudify.nodes.aws')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/infrastructure/aws/';
    } else if (newLabel.includes('cloudify.nodes.azure')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/infrastructure/azure/';
    } else if (newLabel.includes('cloudify.nodes.azure')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/infrastructure/azure/';
    } else if (newLabel.includes('cloudify.nodes.gcp')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/infrastructure/gcp/';
    } else if (newLabel.includes('cloudify.nodes.vsphere')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/infrastructure/vsphere/';
    } else if (newLabel.includes('cloudify.nodes.kubernetes')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/orchestration/kubernetes/';
    } else if (newLabel.includes('cloudify.nodes.helm')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/orchestration/helm/';
    } else if (newLabel.includes('cloudify.nodes.terraform')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/orchestration/terraform/';
    } else if (newLabel.includes('cloudify.nodes.docker')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/orchestration/docker/';
    } else if (newLabel.includes('cloudify.nodes.ansible')) {
        documentation = 'https://docs.cloudify.co/latest/working_with/official_plugins/orchestration/ansible/';
    }
    return {
        label: newLabel,
        kind: CompletionItemKind.Text,
        data: newData,
        documentation: documentation
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
