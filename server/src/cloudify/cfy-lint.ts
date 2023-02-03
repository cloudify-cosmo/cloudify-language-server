/* eslint-disable linebreak-style */
import {promisify} from 'util';
import {fullPath} from './utils';
import {exec} from 'child_process';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {Diagnostic, DiagnosticSeverity} from 'vscode-languageserver/node';

const execPromise = promisify(exec);

const cfyLintExecutor = async (command: string) => {
    try {
        const { stdout, stderr } = await execPromise(command);
        if (!stdout == null) {
            console.log('Unexpected STDOUT: ' + stdout);
        }
        return stderr;
    } catch {
        // pass
    }
    return '';
};

export const commandName = 'cfy-lint';
const commandFlags = ['-f', 'json', '-b'];

interface cfyLintMessage {
    level:string;
    line:number;
    rule:string;
    message:string;
}

function lineIsLint(line:string) {
    if ((line.startsWith('{')) && (line.endsWith('}'))) {
        return true; 
    }
    return false;
}

function insertMessages(result:string) {
    const messages = [];
    try {
        const lines = result.toString().split(/\r?\n/);
        lines.pop();
        for (const line of lines) {
            if (lineIsLint(line)) {
                messages.push(line);
            }
        }
        return messages;
    } catch {
        // pass
    }
    return messages;
}

function assignSeverity(parsed:cfyLintMessage) {
    if (parsed.level === 'warning') {
        return DiagnosticSeverity.Warning;
    } else {
        return DiagnosticSeverity.Error;
    }
}

function generateDiagnostic(parsed:cfyLintMessage, textDocument:TextDocument) {
    const text = textDocument.getText();
    const splitText = text.split('\n');
    const line = splitText[parsed.line - 1];
    const cleanedLine = line.trim();
    const pattern = new RegExp(cleanedLine);
    const m = pattern.exec(text);
    if (m == null) {
        return null;
    }
    const diagnostic:Diagnostic = {
        severity: assignSeverity(parsed),
        message: parsed.message,
        source: parsed.message,
        range: {
            start: textDocument.positionAt(m.index),
            end: textDocument.positionAt(m.index + m[0].length)
        },
    };
    if (parsed.rule === 'empty-lines') {
        if (parsed.line > 0) {
            diagnostic.range.start.line = parsed.line - 1;
            diagnostic.range.end.line = parsed.line - 1;
        } else {
            diagnostic.range.start.line = parsed.line;
            diagnostic.range.end.line = parsed.line;
        }
        diagnostic.range.start.character = 0;
        diagnostic.range.end.character = 0;
    }
    return diagnostic;
}

export async function cfyLint(textDocument:TextDocument) {
    const diagnostics:Diagnostic[] = [];
    const blueprintPath = fullPath(textDocument.uri);
    if (!commandFlags.includes(blueprintPath)) {commandFlags.push(blueprintPath);}
    const flags = commandFlags.join(' ');
    const result = await cfyLintExecutor(commandName + ' ' + flags);
    const messages:string[] = insertMessages(result);
    for (const message of messages) {
        try {
            const parsed:cfyLintMessage = JSON.parse(message);
            const diagnostic:Diagnostic|null = generateDiagnostic(parsed, textDocument);
            if (diagnostic == null) {
                continue;
            } else {
                diagnostics.push(diagnostic);
            }
        } catch {
            // pass
        }
    }
    return diagnostics;
}
