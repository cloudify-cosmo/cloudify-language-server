/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// When adding new modules, use "npm install @types/libName"
import {documentation as intrinsicFunctions} from './cloudify/sections/intrinsic-functions';
import { localNames as sections } from './cloudify/documentation';
import { CloudifyWords } from './cloudify/cloudify';
import {sync as commandExistsSync} from 'command-exists';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {
    cfyLintFix,
    commandName as cfyLintCommandName
} from './cloudify/cfy-lint';
import {
    Command,
    CodeAction,
    CodeActionKind,
    TextDocuments,
    CompletionItem,
    createConnection,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    SemanticTokensLegend,
    TextDocumentSyncKind,
    SemanticTokensBuilder,
    TextDocumentPositionParams,
    SemanticTokensRegistrationType,
    SemanticTokensClientCapabilities,
    SemanticTokensRegistrationOptions,
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
export const cloudify = new CloudifyWords();


let semanticTokensLegend: SemanticTokensLegend;
enum TokenTypes {
    comment = 0,
    keyword = 1,
    string = 2,
    number = 3,
    regexp = 4,
    type = 5,
    class = 6,
    interface = 7,
    enum = 8,
    typeParameter = 9,
    function = 10,
    member = 11,
    property = 12,
    variable = 13,
    parameter = 14,
    _ = 15
}

enum TokenModifiers {
    abstract = 0,
    deprecated = 1,
    _ = 2,
}


function computeLegend(capability: SemanticTokensClientCapabilities): SemanticTokensLegend {

    const clientTokenTypes = new Set<string>(capability.tokenTypes);
    const clientTokenModifiers = new Set<string>(capability.tokenModifiers);

    const tokenTypes: string[] = [];
    for (let i = 0; i < TokenTypes._; i++) {
        const str = TokenTypes[i];
        if (clientTokenTypes.has(str)) {
            tokenTypes.push(str);
        } else {
            if (str in sections) {
                tokenTypes.push('keyword');
            } else if (str in intrinsicFunctions) {
                tokenTypes.push('function');
            } else {
                tokenTypes.push('type');
            }
        }
    }

    const tokenModifiers: string[] = [];
    for (let i = 0; i < TokenModifiers._; i++) {
        const str = TokenModifiers[i];
        if (clientTokenModifiers.has(str)) {
            tokenModifiers.push(str);
        }
    }

    return { tokenTypes, tokenModifiers };
}

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;
    if (!commandExistsSync(cfyLintCommandName)) {
        console.error('The command ' + cfyLintCommandName + ' is not installed in PATH. ' + 'Ensure that VSCode Python environment has this command available in PATH.');
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
    //eslint-disable-next-line
    semanticTokensLegend = computeLegend(params.capabilities.textDocument!.semanticTokens!);

    const result: InitializeResult = {
        capabilities: {
            codeActionProvider: true,
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['{', '}', ':']
            },
            executeCommandProvider: {
                commands: [cfyLintCommandName]
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: hasWorkspaceFolderCapability
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
                try {
                    parsed = JSON.parse(diagnostic.source);
                } catch (e) {
                    console.error('Failed to parse JSON, verify current file is YAML.');
                    return [];
                }
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

    const registrationOptions: SemanticTokensRegistrationOptions = {
        documentSelector: null,
        legend: semanticTokensLegend,
        range: false,
        full: {
            delta: true
        }
    };
    void connection.client.register(SemanticTokensRegistrationType.type, registrationOptions);

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
    if (cloudify.importsReload == true) {
        await cloudify.importPlugins();
        cloudify.importsReload = false;
    }

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
    connection.languages.semanticTokens.on( () => {
        return {data: []};
    });
}

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event: ' + _change);
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        cloudify.refreshCursor(_textDocumentPosition);
        cloudify.privateRefresh();
        return cloudify.currentKeywords;
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

const tokenBuilders: Map<string, SemanticTokensBuilder> = new Map();

function getTokenBuilder(document: TextDocument): SemanticTokensBuilder {
    let result = tokenBuilders.get(document.uri);
    if (result !== undefined) {
        return result;
    }
    result = new SemanticTokensBuilder();
    tokenBuilders.set(document.uri, result);
    return result;
}

function buildTokens(builder: SemanticTokensBuilder) {
    for (const item of cloudify.semanticTokens) {
        builder.push(
            item.line, item.character, item.length, item.tokenType, item.tokenModifier
        );
    }
}

connection.languages.semanticTokens.on((params) => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) {
        return { data: [] };
    }
    const builder = getTokenBuilder(document);
    buildTokens(builder);
    return builder.build();
});

connection.languages.semanticTokens.onDelta((params) => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) {
        return { edits: [] };
    }
    const builder = getTokenBuilder(document);
    builder.previousResult(params.previousResultId);
    buildTokens(builder);
    return builder.buildEdits();
});
