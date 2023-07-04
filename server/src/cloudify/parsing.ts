/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs';
import { parse } from 'yaml';
import { TextDocumentPositionParams } from 'vscode-languageserver/node';
import {
    fullPath,
    JSONItems,
    getIndentation,
} from './utils';

export function getParsed(uri:string) {
    let parsed:JSONItems<object|string|[]> = {};
    try {
        const file = readFile(uri);
        parsed = parse(file);
    } catch (error) {
        console.log('There was an error: ' + error);
    }
    return parsed;
}

export function readFile (uri:string) {
    uri = fullPath(uri);
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
    const lines:string[] = data.split(/\r\n?|\n/);
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

export class documentCursor {
    raw:TextDocumentPositionParams|null;
    character:number;
    lineNumber:number;
    private _indentation:number;
    private _line:string;
    private _lines:string[];
    private _word:string;
    private _words:string[];

    constructor(textDoc:TextDocumentPositionParams|null) {
        this.raw = textDoc;
        if (this.raw == null) {
            this.character = 0;
            this.lineNumber = 0;
        } else {
            this.character = this.raw.position.character;
            this.lineNumber = this.raw.position.line + 1;
        }
        this._lines = [];
        this._line = '';
        this._indentation = 0;
        this._word = '';
        this._words = [];
    }

    getCurrentPositionYAML=()=>{
        let totalCharsPosition = this.character;
        console.log(`At this line: ${totalCharsPosition}.`);
        for (let i = 0; i < this.lineNumber - 1; i++) {
            totalCharsPosition += this._lines[i].length + 1;
        }
        console.log(`Total Chars: ${totalCharsPosition}.`);
        return totalCharsPosition;
    }

    public get lines() {
        if (this._lines.length == 0) {
            if (this.raw == null) {
                this._lines = [];
            } else {
                this._lines = readLines(this.raw.textDocument.uri);
            }
        }
        return this._lines;
    }
    public get line() {
        if (this._line === '') {
            this._line = readLine(this.lines, this.lineNumber - 1);
        }
        return this._line;
    }
    public get indentation() {
        if (this._indentation == 0) {
            this._indentation = getIndentation(this.line);
        }
        return this._indentation;
    }
    public get word() {
        if (this._word === '') {
            this._word = getWordFromIndex(this.line, this.character);
        }
        return this._word;
    }
    public get words() {
        if (this._words.length == 0 ) {
            this._words = this.line.split(/\s/);
        }
        return this._words;
    }
    isNewSection=():boolean=>{
        return (this.indentation == 0);
    };

}
