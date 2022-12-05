/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs';
import {
    TextDocumentPositionParams,
} from 'vscode-languageserver/node';
import {parse} from 'yaml';
import {
    JSONItems,
} from './utils';

export interface cursor {
    indentation:number;
    line:string;
    lineNumber:number;
    lines:string[];
    word:string;
    words:string[];
 }

export function getParsed(uri:string) {
    // console.log('Reading ' + uri);
    let parsed:JSONItems<object|string|[]> = {};
    try {
        const file = readFile(uri);
        parsed = parse(file);    
    } catch {
        // console.log('Error');
    }
    // console.log('Read ' + parsed);
    return parsed;
}

export function readFile (uri:string) {
    if (uri.startsWith('file://')) {
        uri = uri.replace('file://', '');
    } else if (uri.startsWith('file:/')) {
        uri = uri.replace('file:/', '');
    }
    const file = fs.readFileSync(uri, 'utf8');
    return file;
}

function getWordFromIndex(line:string, index:number):string {
    const splitLines:string[] = [line.slice(0, index), line.slice(index)];
    const splitLine:string = splitLines[splitLines.length - 1].trim();
    return line.slice(index, index + splitLine.length);
}

export function readLines(uri:string): string[] {
    const data:string = readFile(uri).toString();
    const lines:string[] = data.split('\n');
    return lines;
}

export function readLine (lines:string[], line:number):string {
    let ctr = 0;
    for (const l of lines) {
        if (ctr === line) {
            return l;
        } else {
            ++ctr;
        }
    }
    return '';
}

export function getCursor(textDoc:TextDocumentPositionParams):cursor {
    const lines:string[] = readLines(textDoc.textDocument.uri);
    const currentLine:string = readLine(lines, textDoc.position.line);

    const currentLineSplit:string[] = currentLine.split(/\s+/);
    const currentWord:string = getWordFromIndex(currentLine, textDoc.position.character);
    return {
        indentation: 0,
        line: currentLine,
        lines: lines,
        lineNumber: textDoc.position.line,
        word: currentWord,
        words:currentLineSplit,
    } as cursor;
}
