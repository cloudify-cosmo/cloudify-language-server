
import {
    Pair,
    Scalar,
    YAMLMap,
    stringify,
    parseDocument,
} from 'yaml';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {nodeTemplates} from './constants/default-node-template-properties';
import {CompletionItem, Diagnostic, TextDocumentPositionParams} from 'vscode-languageserver/node';
import {cfyLint} from './cfy-lint';
import {words} from './word-completion';
import {readFile, documentCursor} from './parsing';
import {
    isPair,
    isMatch,
    isScalar,
    isYAMLMap,
    isYAMLSeq,
    isTopLevel,
    getNodeType,
    getParentSection,
    pairIsInstrinsicFunction,
} from './utils';
import {getNodeTypesForPluginVersion} from './marketplace';
import {
    NodeTypeItem,
    list as nodeTypeKeywords,
} from './sections/node-types';
import {
    list as pluginNames,
    regex as pluginNameRegex
} from './sections/plugins';
import {
    lineContainsFn,
    lineMayContainFn,
    wordsMayIndicateFn,
    lineContainsGetInput,
    lineContainsConcatFn,
    lineContainsGetNodeTemplate,
    keywords as intrinsicFunctionKeywords,
} from './sections/intrinsic-functions';
import {
    CloudifyYAML,
    BlueprintContext,
    cloudifyTopLevelNames
} from './blueprint';
import {
    pluginRegex,
    getImportableYamls,
    name as importsName,
    keywords as importKeywords,
} from './sections/imports';
import {
    inputTypes,
    inputTemplate,
    name as inputsName,
    keywords as inputKeywords,
} from './sections/inputs';
import {
    name as toscaDefinitionsVersionName,
    keywords as toscaDefinitionsVersionKeywords
} from './sections/tosca-definitions-version';
import {
    getPropertiesAsString,
    name as nodeTemplateName,
    keywords as nodeTemplateKeywords,
} from './sections/node-templates';


class CloudifyWords extends words {

    ctx:CloudifyYAML;
    textDoc:TextDocumentPositionParams|null;
    relativeImports:string[];
    importedPlugins:string[];
    importedNodeTypeNames:string[];
    importedNodeTypes:CompletionItem[];
    importedNodeTypeObjects:NodeTypeItem[];
    inputs:Object;
    nodeTemplates:Object;
    diagnostics:Diagnostic[];

    constructor() {
        super();
        this.ctx = new CloudifyYAML();
        this.textDoc = null;
        this.importedPlugins = [];
        this.relativeImports = [];
        this.importedNodeTypeNames = [];
        this.importedNodeTypes = [];
        this.importedNodeTypeObjects = [];
        this.inputs = {};
        this.nodeTemplates = {};
        this.diagnostics = [];
    }

    public async refresh(textDocument:TextDocument) {
        if (this.ctx.dslVersion === '') {
            this.ctx = new BlueprintContext(textDocument.uri);
        } else if ((this.ctx instanceof BlueprintContext) && (this.timer.isReady())) {
            this.ctx.refresh();
            await this.importPlugins();
            this.inputs = this.ctx.assignInputs();
            this.nodeTemplates = this.ctx.assignNodeTemplates();
        }
        if (this.cfyLintTimer.isReady()) {
            // this.diagnostics = await cfyLint(textDocument).then((result) => {return result;});
            this.diagnostics = [];
        }
        privateRefresh();
    }

    addRelativeImports=(documentUri:string, target:CompletionItem[])=>{
        for (const value of getImportableYamls(documentUri)) {
            this.appendCompletionItem(value, target);
        }
    };

    public async importPlugins() {

        if (this.ctx != null) {
            if (this.ctx.imports != null) {
                for (const plugin of this.ctx.imports.plugins) {
                    await this._importPlugin(plugin);
                }
            }
        }
    }

    public async importPluginOnCompletion(pluginName:string) {
        if (pluginNameRegex.test(pluginName)) {
            this._importPlugin(pluginName);
        }
    }

    private async _importPlugin(pluginName:string) {
        if ((pluginName == null) || (!(typeof pluginName === 'string'))) {
            return '';
        }

        let pluginSubString = pluginName.match('^cloudify-[a-z]*-plugin$') as string[];
        if (pluginSubString == null) {
            pluginSubString = [];
        }

        if (pluginSubString.length == 1) {
            const pluginName:string = pluginSubString[0];
            if (!this.importedPlugins.includes(pluginName)) {
                const nodeTypes = await getNodeTypesForPluginVersion(pluginName);
                for (const nodeType of nodeTypes) {
                    if (nodeType.type.startsWith('cloudify.nodes.')) {
                        this.importedNodeTypeObjects.push(nodeType);
                        this.importedNodeTypeNames.push(nodeType.type);
                        this.appendCompletionItem(nodeType.type, this.importedNodeTypes);   
                    }
                }
                this.importedPlugins.push(pluginName);
            }
        }
    }

    refreshCursor=(textDoc:TextDocumentPositionParams|null)=>{
        if (textDoc != null) {
            this.textDoc = textDoc;
            this.ctx.cursor = new documentCursor(textDoc);
        }
    };

    public contextualizedKeywords(textDoc:TextDocumentPositionParams):CompletionItem[] {
        // We want to suggest keywords based on the current situation.
        this.refreshCursor(textDoc);
    
        const currentKeywordOptions:CompletionItem[] = [];

        if ((this.ctx.cursor.lineNumber == 1) && (this.ctx.cursor.indentation < 1)) {
            // Is this tosca_definitions_version line?
            if (isMatch(this.ctx.cursor.line, `^${toscaDefinitionsVersionName}(:\\s){1}(cloudify_dsl_1_){0,1}$`)) {
                this.appendCompletionItems(toscaDefinitionsVersionKeywords, currentKeywordOptions);
            } else {
                this.appendCompletionItem(toscaDefinitionsVersionName, currentKeywordOptions)
            }
        } else if (this.ctx.cursor.indentation < 1) {
            // Is this some other top level?
            // TODO: Remove all other keys that are already in use.
            const indexTosca = cloudifyTopLevelNames.indexOf(toscaDefinitionsVersionName);
            if (indexTosca > -1) {
                cloudifyTopLevelNames.splice(indexTosca, 1);
            }
            this.appendCompletionItems(cloudifyTopLevelNames, currentKeywordOptions);
        } else if (this.ctx.section === importsName) {
            if (this.ctx.cursor.line.match(/^(\s){0,4}(\-){1}/)) {
                this.appendCompletionItems(importKeywords, currentKeywordOptions);
                const importableYamls:string[] = getImportableYamls(textDoc.textDocument.uri);
                this.appendCompletionItems(importableYamls, currentKeywordOptions);
                if (this.ctx.cursor.line.match(pluginRegex)) {
                    this.appendPluginCompletionItems(pluginNames, currentKeywordOptions);
                }
            } else if (this.ctx.cursor.line.match(/^(\s){0,4}/)) {
                this.appendCompletionItem('- ', currentKeywordOptions);
            }
        } else if (this.ctx.section === inputsName) {
            // Is this an Inputs Section?
            if (this.ctx.cursor.line.match(/^(\s){0,4}/)) {
                if (this.ctx.cursor.line.match(/^(\s){0,4}(type:){1}/)) {
                    this.appendCompletionItems(inputTypes, currentKeywordOptions);
                } else if (this.ctx.cursor.lines[this.ctx.cursor.lineNumber - 2].match(/^(\s){0,4}[A-Za-z0-9\-\_]{1,}(:){1}/)) {
                    this.appendCompletionItems(inputKeywords, currentKeywordOptions);
                } else {
                    this.appendCompletionItem(inputTemplate, currentKeywordOptions);
                }
            }
        } else if (this.ctx.section === nodeTemplateName) {
            if (this.ctx.cursor.line.match(/^(\s){0,4}(type:){1}/)) {
                this.appendCompletionItems(nodeTypeKeywords, currentKeywordOptions);
                this.appendCompletionItems(this.importedNodeTypeNames, currentKeywordOptions);
            } else {
                if (getParentSection(this.ctx.cursor) !== '') {
                    this.appendCompletionItems(nodeTemplateKeywords, currentKeywordOptions);
                    const nodeTypeName = getNodeType(this.ctx.cursor);
                    // Get the suggested properties for node type.
                    for (const nodeTypeObject of this.importedNodeTypeObjects) {
                        if (nodeTypeObject.type === nodeTypeName) {
                            const suggested = nodeTemplates.get(nodeTypeName);
                            if (suggested !== undefined) {
                                this.appendCompletionItem(stringify({'properties': suggested}), currentKeywordOptions);
                            } else {
                                const properties = getPropertiesAsString(nodeTypeObject.properties);
                                this.appendCompletionItem(properties, currentKeywordOptions);    
                            }
                        }
                    }
            

                } else {
                    this.appendCompletionItems(nodeTemplateKeywords, currentKeywordOptions);
                }
            }

        }

        if (this.isIntrinsicFunction()) {
            if (lineContainsFn(this.ctx.cursor.line)) {
                if (lineContainsGetInput(this.ctx.cursor.line)) {
                    for (const inputName of Object.keys(this.inputs)) {
                        this.appendCompletionItem(inputName, currentKeywordOptions);
                    }
                }
                if (lineContainsGetNodeTemplate(this.ctx.cursor.line)) {
                    for (const nodeTemplateName of Object.keys(this.nodeTemplates)) {
                        const argument = `[ ${nodeTemplateName}, INSERT_PROPERTY_NAME ]`;
                        this.appendCompletionItem(argument, currentKeywordOptions);
                    }
                }
            }
            this.appendCompletionItems(intrinsicFunctionKeywords, currentKeywordOptions);
        }

        return currentKeywordOptions;
    }

    isIntrinsicFunction=():boolean=>{
        if (lineMayContainFn(this.ctx.cursor.line)) {
            return true;
        } else if (wordsMayIndicateFn(this.ctx.cursor.words))  {
            return true;
        }
        return false;
    };
    isConcatIntrinsicFunction=():boolean=>{
        return lineContainsConcatFn(this.ctx.cursor.line);
    };
}

export const cloudify = new CloudifyWords();

function privateRefresh() {
    if (cloudify.ctx.cursor.raw == null) {
        // pass
    } else {
        const latestContent:string = readFile(cloudify.ctx.cursor.raw.textDocument.uri);
        investigateYaml(latestContent);
    }
}


function areRawYAMLSectionsEquivalent(str:string, sectionName:string):boolean {
    if (sectionName === toscaDefinitionsVersionName) {
        if ((cloudify.ctx.rawDslVersion != null) && (cloudify.ctx.rawDslVersion === str)) {
            return true;
        }
    } else if (sectionName === importsName) {
        if ((cloudify.ctx.rawImports != null) && (cloudify.ctx.rawImports === str)) {
            return true;
        }
    } else if (sectionName === inputsName) {
        if ((cloudify.ctx.rawInputs != null) && (cloudify.ctx.rawInputs === str)) {
            return true;
        }
    } else if (sectionName === nodeTemplateName) {
        if ((cloudify.ctx.rawNodeTemplates != null) && (cloudify.ctx.rawNodeTemplates === str)) {
            return true;
        }
    }
    return false;   
}

function assignRawTopLevel(item:Pair) {
    const key = item.key as Scalar;
    const keyValue = key.value as string;
    const itemStr = item.toString(); // Change this to use some lower level object than string.

    if (keyValue === toscaDefinitionsVersionName) {
        // @ts-ignore
        const toscaDSL = item.value.value as string; 
        if (areRawYAMLSectionsEquivalent(itemStr, toscaDefinitionsVersionName)) {
            console.debug('assignRawTopLevel: The DSL has not changed.');
        } else if (toscaDefinitionsVersionKeywords.includes(toscaDSL)) {
            console.debug('assignRawTopLevel: Assigning DSL.');
            cloudify.ctx.rawDslVersion = itemStr;
            cloudify.ctx.dslVersion = toscaDSL;
        } else {
            console.debug('assignRawTopLevel: Could not assign tosca.');
        }
    } else if (keyValue === importsName) {
        // This is the imports section.
        if (areRawYAMLSectionsEquivalent(itemStr, importsName)) {
            console.debug('assignRawTopLevel: The imports section has not changed.');
        } else {
            console.debug('assignRawTopLevel: Assigning imports.');
            cloudify.ctx.rawImports = itemStr;
        }
    } else if (keyValue === inputsName) {
        // This is a inputs section.
        if (areRawYAMLSectionsEquivalent(itemStr, inputsName)) {
            console.debug('assignRawTopLevel: The inputs section has not changed.');
        } else {
            console.debug('assignRawTopLevel: Assigning inputs.');
            cloudify.ctx.rawInputs = itemStr;
        }
    } else if (keyValue === nodeTemplateName) {
        // This is a node templates section.
        if (areRawYAMLSectionsEquivalent(itemStr, nodeTemplateName)) {
            console.debug('assignRawTopLevel: The node templates section has not changed.');
        } else {
            console.debug('assignRawTopLevel: Assigning node templates.');
            cloudify.ctx.rawNodeTemplates = itemStr;
        }
    }
    return true;
}

function recurseParsedDocument(item:any) {
    console.log(`@Investigating ${typeof item}: ${item}.`);
    if (isPair(item)) {
        if (isTopLevel(item)) {
            assignRawTopLevel(item);
        }
        recurseParsedDocument(item.value);
    } else if (isScalar(item)) {
        console.log(`>The item ${item} is a Scalar. Range: ${item.range}`);
        cloudify.ctx.cursor.getCurrentPositionYAML();
    } else if (isYAMLMap(item)) {
        console.log(`>The item ${item} is a YAMLMap.`);
        for (const mapItem of item.items) {
            if (pairIsInstrinsicFunction(mapItem)) {
                console.log(`?The item ${item} is an intrinsic function.`);
            } else {
                recurseParsedDocument(mapItem.value);    
            }
        }
    } else if (isYAMLSeq(item)) {
        console.log(`>The item ${item} is a YAMLSeq.`);
        for (const seqItem of item.items) {
            recurseParsedDocument(seqItem);
        }
    } else {
        console.log(`!!! The item ${item} is unknown.`);
    }
}

function investigateYaml(file:string) {
    try {
        const doc = parseDocument(file);
        if ((doc.contents != null) && (doc.contents instanceof YAMLMap)) {
            for (const item of doc.contents.items) {
                recurseParsedDocument(item);
            }
        }
    } catch (error) {
        console.error(`An error occurred while reading YAML file: ${error}.`);
    }
}
