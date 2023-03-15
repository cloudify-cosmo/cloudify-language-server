/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// When adding new modules, use "npm install @types/libName"
import {cloudify} from './cloudify/cloudify';
import {sync as commandExistsSync} from 'command-exists';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {commandName as cfyLintCommandName, cfyLintFix} from './cloudify/cfy-lint';
import {
    CodeAction, CodeActionKind, Command,
    TextDocuments,
    CompletionItem,
    createConnection,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocumentSyncKind,
    TextDocumentPositionParams,
    DidChangeConfigurationNotification,
} from 'vscode-languageserver/node';

// Create a simple text document manager.
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;
    if (!commandExistsSync(cfyLintCommandName)) {
        console.log('The command ' + cfyLintCommandName + ' is not installed in PATH. ' +
        'Ensure that VSCode Python environment has this command available in PATH.');
    }

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            codeActionProvider: true,
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [ '- ' ]
            },
            executeCommandProvider: {
                commands: [cfyLintCommandName]
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onCodeAction((params) => {
    const textDocument = documents.get(params.textDocument.uri);
    if (textDocument === undefined) {
        return undefined;
    }
    let parsed = {rule: null};
    for (const diagnostic of params.context.diagnostics) {
        if (diagnostic.range.start.line === params.range.start.line) {
            if (typeof diagnostic.source == 'string') {
                parsed = JSON.parse(diagnostic.source);
            }
        }
    }
    return [CodeAction.create(
        'Fix with Cfy-Lint',
        Command.create(
            'Fix with Cfy-Lint',
            cfyLintCommandName,
            params.textDocument,
            `${parsed.rule}=${params.range.start.line + 1}`
        ),
        CodeActionKind.QuickFix)
    ];
});

connection.onExecuteCommand(async (params) => {
    if (params.command === cfyLintCommandName) {
        if (params.arguments !== undefined) {
            await cfyLintFix(params.arguments[0], params.arguments[1]);
        }
    }
    return;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received: ' + _event);
        });
    }
});

// The example settings
interface ExampleSettings {
    maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 100 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    } else {
        globalSettings = <ExampleSettings>(
            (change.settings.cloudifyLanguageServer || defaultSettings)
        );
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'cloudifyLanguageServer'
        });
        documentSettings.set(resource, result);
    }
    return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    if (cloudify.timer.isReady()) {
        validateTextDocument(change.document);
    }
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    // In this simple example we get the settings for every validate run.
    const settings = await getDocumentSettings(textDocument.uri);
    await cloudify.refresh(textDocument);
    const diagnostics = cloudify.diagnostics;
    let problems = 0;
    while (problems < settings.maxNumberOfProblems) {
        problems++;
        for (const diagnostic of diagnostics) {
            if (hasDiagnosticRelatedInformationCapability) {
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: textDocument.uri,
                            range: Object.assign({}, diagnostic.range)
                        },
                        message: diagnostic.message
                    }
                ];
            } 
        }
    }
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event: ' + _change);
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        return cloudify.contextualizedKeywords(_textDocumentPosition);
    }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        cloudify.importPluginOnCompletion(item.label);
        return item;
    }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
