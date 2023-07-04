/* eslint-disable linebreak-style */
import {promisify} from 'util';
import {fullPath} from './utils';
import {exec} from 'child_process';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {Range, Diagnostic, DiagnosticSeverity} from 'vscode-languageserver/node';

const execPromise = promisify(exec);

const badCfyLint = '\n{"level": "error", "line": 1, "rule": "imports", "message": "Linting unavailable. Please ensure that cfy-lint is installed in the VS Code interpreter (see README)."}\n';

const cfyLintExecutor = async (command: string) => {
    try {
        const { stdout, stderr } = await execPromise(command);
        if (!stdout == null) {
            console.log('Unexpected STDOUT: ' + stdout);
        }
        return stderr;
    } catch {
        return badCfyLint;
    }
};

export const commandName = 'cfy-lint';

export interface cfyLintMessage {
    level:string;
    line:number;
    rule:string;
    message:string;
}

export function lineIsLint(line:string) {
    if ((line.startsWith('{')) && (line.endsWith('}'))) {
        return true; 
    }
    return false;
}

export function insertMessages(result:string) {
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

export function assignSeverity(parsed:cfyLintMessage) {
    if (parsed.level === 'warning') {
        return DiagnosticSeverity.Warning;
    } else {
        return DiagnosticSeverity.Error;
    }
}

function generateDiagnostic(parsed:cfyLintMessage, textDocument:TextDocument) {
    const text = textDocument.getText();
    const splitText = text.split(/\r?\n/);
    const line = splitText[parsed.line - 1];
    const cleanedLine = line.trim();
    const pattern = new RegExp(cleanedLine);
    const m = pattern.exec(text);
    if ((m == null) || (m === undefined)) {
        return null;
    }
    const range:Range = Range.create(
        textDocument.positionAt(m.index),
        textDocument.positionAt(m.index + m[0].length)
    );
    if (parsed.rule === 'empty-lines') {
        if (parsed.line > 0) {
            range.start.line = parsed.line - 1;
            range.end.line = parsed.line - 1;
        } else {
            range.start.line = parsed.line;
            range.end.line = parsed.line;
        }
        range.start.character = 0;
        range.end.character = 0;
    }
    const diagnostic:Diagnostic = Diagnostic.create(
        range,
        parsed.message,
        assignSeverity(parsed),
        0,
        JSON.stringify(parsed),
    );
    return diagnostic;
}

export async function cfyLint(textDocument:TextDocument) {
    const diagnostics:Diagnostic[] = [];
    const blueprintPath = fullPath(textDocument.uri);
    const commandFlags = ['-f', 'json', '-b'];
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

export async function cfyLintFix(textDocument:TextDocument, fix:string) {
    const blueprintPath = fullPath(textDocument.uri);
    const commandFlags = ['-f', 'json', '-b'];
    if (!commandFlags.includes(blueprintPath)) {commandFlags.push(blueprintPath);}
    if (!commandFlags.includes(fix)) { commandFlags.push(`--fix ${fix}`);}
    const flags = commandFlags.join(' ');
    await cfyLintExecutor(commandName + ' ' + flags);
}

const getCfyLintTasks = (): Promise<any> => {
    return new Promise((resolve, reject) => {
        exec('tasklist', (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                const processNames  = stdout
                    .split('\n')
                    .slice(2)
                    .filter(name => name.includes('cfy-lint'));
                resolve(processNames);
            }
        });
    });
};


export const maxCfyLint = async (): Promise<boolean> => {
    const processNames  = await getCfyLintTasks();
    console.log(processNames);
    const max = 3;
    console.log('** processNames lenght : ', processNames.length);

    if (processNames.length >= max) {
        return false;
    }
    return true;
};