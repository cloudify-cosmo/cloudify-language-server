
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
// import {cfyLint} from './cfy-lint';
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
    makeCamelCase,
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
import { getIndentation } from './utils';


export class CloudifyWords extends words {

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
    _currentKeywords:CompletionItem[];
    _importsReload:boolean;

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
        this._currentKeywords = [];
        this._importsReload = false;
    }

    public get importsReload() {
        return this._importsReload;
    }

    public set importsReload(value:boolean) {
        this._importsReload = value;
    }

    public get currentKeywords() {
        return this._currentKeywords;
    }

    public set currentKeywords(value:CompletionItem[]) {
        this._currentKeywords = value;
    }

    public appendCurrentKeyword(value:string) {
        this.appendCompletionItem(value, this._currentKeywords);
    }

    public appendCurrentKeywords(values:string[]) {
        this.appendCompletionItems(values, this._currentKeywords);
    }

    private registerImports() {
        if (this.ctx.section !== importsName) {
            return;
        }
        if (this.ctx.cursor.line.match(/^(\s){0,4}(\-(\s)plugin:)/)) {
            this.registerPluginImports();
        } else if (this.ctx.cursor.line.match(/^(\s){0,4}(\-){1}/)) {
            for (let kw of importKeywords) {
                if ((!(this.ctx.rawImports.includes(kw)) || (kw === 'plugin:'))) {
                    this.appendCurrentKeyword(kw);
                }
            }
            if (this.textDoc != null) {
                const importableYamls:string[] = getImportableYamls(this.textDoc.textDocument.uri);
                this.appendCurrentKeywords(importableYamls);
            }
        }
    }

    private registerInputs() {
        if (this.ctx.section !== inputsName) {
            return;
        }
        // const splitYamlPath = this.ctx.yamlPath.split('.');
        // if ((splitYamlPath.length == 3) && (splitYamlPath[2].match(/^(type|default|required|description|display_label){0,1}$/))) {
        //     for (let name of inputKeywords) {
        //         this.appendCurrentKeyword(`${name}:`);
        //     }
        // } else if (this.ctx.cursor.line.match(/^(\s){2,4}/)) {
        //     if (this.ctx.cursor.line.match(/^(\s){2,4}(type:){1}/)) {
        //         this.appendCurrentKeywords(inputTypes);
        //     } else if (this.ctx.cursor.line.match(/^(\s){2,4}(type:){1}/)) {
        //         this.appendCurrentKeyword(makeCamelCase(splitYamlPath[1]));
        //     } else if (this.ctx.cursor.indentation - this.ctx.cursor.fileIndentation == 2) {
        //         this.appendCurrentKeyword(inputTemplate);
        //     } else if (this.ctx.cursor.indentation - this.ctx.cursor.fileIndentation == 0) {
        //         this.appendCurrentKeyword(`  ${inputTemplate}`);
        //     }
        // }
    }

    private registerDescription() {
        if (this.ctx.section !== 'description') {
            return;
        }
        this.currentKeywords = [];
        this.appendCurrentKeyword('This blueprint does xyz...');
    }

    private registerToscaVersions() {
        if (this.ctx.cursor.line.match(/^tosca_definitions_version:(\s){1}/)) {
            this.currentKeywords = [];
            this.appendCurrentKeywords(toscaDefinitionsVersionKeywords);   
        }
    }

    private registerPluginImports() {
        if (this.ctx.section !== importsName) {
            return;
        }
        const unimportedPlugins = [];
        for (let name of pluginNames) {
            if (!(this.ctx.rawImports.includes(name))) {
                unimportedPlugins.push(name);
            }
        }
        this.appendPluginCompletionItems(unimportedPlugins, this._currentKeywords);
    }

    private registerNodeTemplates() {
        if (this.ctx.section !== nodeTemplateName) {
            return;
        }
        const indentation = this.ctx.cursor.indentation - 1;
        let fileIndentation = this.ctx.cursor.fileIndentation;
        if (fileIndentation == null) {
            fileIndentation = indentation;
        }
        if (fileIndentation === indentation) {
            const neededIndent = ' '.repeat(fileIndentation);
            this.appendCurrentKeyword(neededIndent);
        } else if (this.ctx.cursor.line.match(/^(\s){0,4}(type:){1}/)) {
            this.appendCurrentKeywords(nodeTypeKeywords);
            this.appendCurrentKeywords(this.importedNodeTypeNames);
        } else if (this.ctx.cursor.line.match(/^(\s){0,4}$/)) {
            console.log(`1`);
            for (let name of nodeTemplateKeywords) {
                if (!(name.endsWith(':'))) {
                    name = `${name}:`;
                }
                this.appendCurrentKeyword(name);
            }
        } else {
            console.log(`2`);
            if (getParentSection(this.ctx.cursor) !== '') {
                this.appendCurrentKeywords(nodeTemplateKeywords);
                const nodeTypeName = getNodeType(this.ctx.cursor);
                // Get the suggested properties for node type.
                for (const nodeTypeObject of this.importedNodeTypeObjects) {
                    if (nodeTypeObject.type === nodeTypeName) {
                        const suggested = nodeTemplates.get(nodeTypeName);
                        if (suggested !== undefined) {
                            this.appendCurrentKeyword(stringify({'properties': suggested}));
                        } else {
                            const properties = getPropertiesAsString(nodeTypeObject.properties);
                            this.appendCurrentKeyword(properties);
                        }
                    }
                }
            }
        }

    }

    private registerSpaces() {
        if (this.ctx.cursor.line.match(/(:){1}(\s){1,}$/)) {
            return;
        }
        const currentIndent = this.ctx.cursor.fileIndentation - this.ctx.cursor.indentation;
        let space = '';
        if (currentIndent > 0) {
            space = `${'  '.repeat(currentIndent)}`;
        }
        if ((this.ctx.cursor.lineNumber > 1) && (this.ctx.cursor.line !== undefined)) {
            if ((this.ctx.section === importsName) && !(this.ctx.cursor.line.match(/^(\s){0,4}[\-]{1}/))) {
                space += '- ';
                this.appendCurrentKeyword(space);
            } else {
                this.appendCurrentKeyword(space);
            }
        }
    }

    public async refresh(textDocument:TextDocument) {
        if (this.ctx.dslVersion === '') {
            this.ctx = new BlueprintContext(textDocument.uri);
        }
        if ((this.ctx instanceof BlueprintContext) && (this.timer.isReady())) {
            try {
                this.ctx.refresh();
            } catch {
                this.registerTopLevelCursor();
            }
        }
        if (this.cfyLintTimer.isReady()) {
            // this.diagnostics = await cfyLint(textDocument).then((result) => {return result;});
            this.diagnostics = [];
        }

        await this.privateRefresh();
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

    public async privateRefresh() {
    
        let doRefresh = false;
        let latestContent = '';
        if ((this.ctx.cursor.raw == null) && (this.textDoc == null)) {
            // console.warn('Unable to execute refresh, because we do not have raw text document.');
        } else if (this.ctx.cursor.raw != null) {
            latestContent = readFile(this.ctx.cursor.raw.textDocument.uri);
            doRefresh = true;
        } else if (this.textDoc != null) {
            latestContent = readFile(this.textDoc.textDocument.uri);
            doRefresh = true;
        }
        if ((doRefresh == true) && (latestContent !== '')) {
            this._currentKeywords = [];
            this.investigateYaml(latestContent);
            this.inputs = this.ctx.assignInputs();
            this.nodeTemplates = this.ctx.assignNodeTemplates();
        } else {
            this.appendCurrentKeyword(`${toscaDefinitionsVersionName}: `);
        }
    }

    public areRawYAMLSectionsEquivalent(str:string, sectionName:string):boolean {
        if (sectionName === toscaDefinitionsVersionName) {
            if ((this.ctx.rawDslVersion != null) && (this.ctx.rawDslVersion === str)) {
                return true;
            }
        } else if (sectionName === importsName) {
            if ((this.ctx.rawImports != null) && (this.ctx.rawImports === str)) {
                return true;
            }
        } else if (sectionName === inputsName) {
            if ((this.ctx.rawInputs != null) && (this.ctx.rawInputs === str)) {
                return true;
            }
        } else if (sectionName === nodeTemplateName) {
            if ((this.ctx.rawNodeTemplates != null) && (this.ctx.rawNodeTemplates === str)) {
                return true;
            }
        }
        return false;   
    }

    public assignRawTopLevel(item:Pair) {
        const key = item.key as Scalar;
        this.ctx.processingSection = key.value as string;
        const itemStr = item.toString(); // Change this to use some lower level object than string.
        
        if (this.ctx.processingSection === toscaDefinitionsVersionName) {
            // @ts-ignore
            const toscaDSL = item.value.value as string; 
            if (this.areRawYAMLSectionsEquivalent(itemStr, toscaDefinitionsVersionName)) {
                // console.debug('assignRawTopLevel: The DSL has not changed.');
            } else if (toscaDefinitionsVersionKeywords.includes(toscaDSL)) {
                this.ctx.rawDslVersion = itemStr;
                this.ctx.dslVersion = toscaDSL;
            } else {
                // console.debug('assignRawTopLevel: Could not assign tosca.');
            }
        } else if (this.ctx.processingSection === importsName) {
            // This is the imports section.
            if (this.areRawYAMLSectionsEquivalent(itemStr, importsName)) {
                // console.debug('assignRawTopLevel: The imports section has not changed.');
            } else {
                this.ctx.rawImports = itemStr;
                this.importsReload = true;
            }
        } else if (this.ctx.processingSection === inputsName) {
            // This is a inputs section.
            if (this.areRawYAMLSectionsEquivalent(itemStr, inputsName)) {
                // console.debug('assignRawTopLevel: The inputs section has not changed.');
            } else {
                this.ctx.rawInputs = itemStr;
            }
        } else if (this.ctx.processingSection === nodeTemplateName) {
            // This is a node templates section.
            if (this.areRawYAMLSectionsEquivalent(itemStr, nodeTemplateName)) {
                // console.debug('assignRawTopLevel: The node templates section has not changed.');
            } else {
                this.ctx.rawNodeTemplates = itemStr;
            }
        }
        return true;
    }

    private unAssignDocumentation(item:any):boolean {
        if ((item.key.value === 'description') && (item.value.value.length > 1)) {
            if ((item.value.type === 'BLOCK_FOLDED') && (this.ctx.cursor.indentation < 1)) {
                return true;
            } else if ((item.value.type === 'BLOCK_LITERAL') && (this.ctx.cursor.indentation < 1)) {
                return true;
            }
        }
        return false;
    }

    private assignSections(nextItem:any, item:any) {
        console.log(`The item is: `)
        console.log(item);
        if ((item.value != null) && (item.key != null)) {
            if (this.unAssignDocumentation(item)) {
                this.ctx.section = '';  
                return;
            }
            if ((nextItem == null) && (this.ctx.cursor.currentCharacter > item.key.range[2])) {
                this.ctx.sectionStart = item.key.range[0];
                this.ctx.sectionEnd = this.ctx.cursor.finalCharacter;
                this.ctx.section = item.key.value;
                this.ctx.yamlPath = '';
            } else if (this.ctx.cursor.currentCharacter <= item.value.range[2] + 1) {
                this.ctx.sectionStart = item.key.range[0];
                this.ctx.sectionEnd = item.value.range[2] + 1;   
            } else if ((nextItem.key != null) && (this.ctx.cursor.character <= nextItem.key.range[0])) {
                this.ctx.sectionStart = item.key.range[0];
                this.ctx.sectionEnd = nextItem.key.range[0] + 1;   
            }
        }

        if ((this.ctx.cursor.currentCharacter <= this.ctx.sectionEnd) && (this.ctx.cursor.currentCharacter >= this.ctx.sectionStart) && (cloudifyTopLevelNames.includes(item.key.value))) {
            this.ctx.section = item.key.value;
            this.ctx.yamlPath = '';
        }
    }
    
    public recurseParsedDocument(nextItem:any, item:any, parentItem:any) {
        if (item === undefined) {
            return false;
        }
        let charInside:boolean = false;
        if (isPair(item)) {
            // @ts-ignore
            const itemKeyRange = item.key.range;
            const itemLineNumber = this.ctx.cursor.getLineNumberFromCurrentCharacter(itemKeyRange[0] + 1);
            if ((this.ctx.cursor.lines[itemLineNumber].split(/^(\s)+/).length == 1) && isTopLevel(item)) {
                this.assignRawTopLevel(item);
                if (isPair(nextItem)) {
                    this.assignSections(nextItem, item);
                } else if (nextItem == null) {
                    this.assignSections(nextItem, item);
                }
            }
            const charInsideValue = this.recurseParsedDocument(nextItem, item.value, item);
            if (charInsideValue) {
                charInside = true;
                // @ts-ignore
                this.ctx.yamlPath = item.key.value + '.' + this.ctx.yamlPath;
            } else if (nextItem == null) {
                // @ts-ignore
                this.ctx.yamlPath = item.key.value + '.' + this.ctx.yamlPath;
            }
        } else if (isScalar(item)) {
            charInside = this.ctx.cursor.currentCharInsideScalar(item.range);
            if ((!charInside) && (item.value == null) && (this.ctx.cursor.currentCharacter + 1 >= this.ctx.cursor.finalCharacter)) {
                charInside = true;
            }
            return charInside;
        } else if (isYAMLSeq(item)) {
            let insideSequence = false;
            for (const seqItem of item.items) {
                insideSequence = this.recurseParsedDocument(nextItem, seqItem, item);
                if (insideSequence == true) {
                    charInside = true;
                }
            }
        } else if (isYAMLMap(item)) {
            let insideMap = false;
            for (const mapItem of item.items) {
                if (pairIsInstrinsicFunction(mapItem)) {
                    console.log(`?The item ${item} is an intrinsic function.`);
                } else {
                    if (!(this.registerNestedInput(mapItem, parentItem))) {
                        insideMap = this.recurseParsedDocument(nextItem, mapItem, item);
                        if (insideMap == true) {
                            charInside = true;
                        }
                    }
                }
            }
        }
        return charInside;
    }

    private registerNestedInput(nextItem:any, parentItem:any):boolean {
        let contains = true;
        try {
            if (parentItem.key.value === 'inputs') {
                if ((isPair(nextItem)) && (isScalar(nextItem.key))) {
                    const char = this.ctx.cursor.currentCharacter;
                    // @ts-ignore
                    const nextItemKeyValue:string = nextItem.key.value;
                    // @ts-ignore
                    const nextItemValueRange:Array = nextItem.value.range;
                    // @ts-ignore
                    const nextValueItems:Array = nextItem.value.items;
                    // @ts-ignore
                    const nextItemValueJSON = nextItem.value.toJSON();
                    if ((isYAMLMap(nextItem.value)) || (isScalar(nextItem.value))) {
                        console.log('6');
                        console.log(nextItemKeyValue);
                        console.log(char);
                        console.log(nextItemValueRange);
                        if ((nextItemValueRange[0] < char) && (char <= nextItemValueRange[2] + 4)) {
                            this.currentKeywords = [];
                            if (this.ctx.cursor.line.match(/^(\s){2,4}(type:){1}/)) {
                                this.appendCurrentKeywords(inputTypes);
                            } else if (this.ctx.cursor.line.match(/^(\s){2,4}(required:){1}/)) {
                                this.appendCurrentKeywords(['true', 'false']);
                            } else if (this.ctx.cursor.line.match(/^(\s){2,4}(display_label:){1}/)) {
                                this.appendCurrentKeyword(makeCamelCase(nextItemKeyValue));
                            } else if (this.ctx.cursor.line.match(/^(\s){2,4}(default:){1}/)) {
                                if (isYAMLMap(nextItem.value) && (nextItemValueJSON.hasOwnProperty('type'))) {
                                    if (nextItemValueJSON['type'] === 'boolean') {
                                        this.appendCurrentKeywords(['true', 'false']);
                                    }
                                }
                            }
                        } else if ((nextItemValueRange[1] + 8 >= char) && (this.ctx.cursor.isLineIndentedLevel(2))) {
                            console.log(`7`);
                            for (let name of inputKeywords) {
                                if (isYAMLMap(nextItem.value)) {
                                    const nextItemValueJSON = nextItem.value.toJSON();
                                    if (nextItemValueJSON.hasOwnProperty(name)) {
                                        continue;
                                    }
                                }
                                this.appendCurrentKeyword(`${name}:`);
                            }
                        }
                    }
                }
            }
        } catch {
            contains = false;
        }
        return contains;
    }

    public investigateYaml(file:string) {
        console.log('>Starting Investigating YAML.\n');
        let doc;
        try {
            doc = parseDocument(file);
        } catch (error) {
            console.log(`Unable to parse ${file}. Error: ${error}`);
        }
        this.ctx.cursor.lines = file.split('\n');
        if (doc !== undefined) {
            if ((doc.contents != null) && (doc.contents instanceof YAMLMap)) {
                let previousItem:any;
                let parentItem:any;
                for (const nextItem of doc.contents.items) {
                    try {
                        this.recurseParsedDocument(nextItem, previousItem, parentItem);
                    } catch (error) {
                        console.error(`An error occured while parsing item: ${nextItem}.`);
                        console.error(`Error: ${error}`);
                    }
                    parentItem = previousItem;
                    previousItem = nextItem;
                }
                this.recurseParsedDocument(null, previousItem, parentItem);
                this.registerTopLevelJson(doc.contents.toJSON());
            }
        }
        // this.registerTopLevelCursor();
        this.registerToscaVersions();
        this.registerDescription();
        this.registerImports();
        this.registerInputs();
        this.registerSpaces();
        console.log('>Ending Investigating YAML.\n');
    }

    public registerTopLevelCursor() {
        if (this.ctx.cursor.character < 1) {
            this.currentKeywords = [];
            const elements = this.ctx.cursor.lines.map(line => line.split(' ')[0]);
            for (let name of cloudifyTopLevelNames) {
                if (!(elements.hasOwnProperty(name))) {
                    if (['description', toscaDefinitionsVersionName].includes(name)) {
                        name = `${name}: `;
                    } else if (name === importsName) {
                        name = `${name}:\n  - `;
                    } else {
                        name = `${name}:\n\n  `;
                    }
                    this.appendCurrentKeyword(name);
                }
            }
        }
    }

    public registerTopLevelJson(json:any) {
        if (this.ctx.cursor.character < 1) {
            this.currentKeywords = [];
            for (let name of cloudifyTopLevelNames) {
                if (!(json.hasOwnProperty(name))) {
                    if (['description', toscaDefinitionsVersionName].includes(name)) {
                        name = `${name}: `;
                    } else if (name === importsName) {
                        name = `${name}:\n  - `;
                    } else {
                        name = `${name}:\n\n  `;
                    }
                    this.appendCurrentKeyword(name);
                }
            }
        }
    }

    public contextualizedKeywords() {
        this.contextualizedKeywordsFromLines();
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

    private contextualizedKeywordsFromLines() {

        if (this.ctx.section === 'description') {
            this.appendCurrentKeyword('This blueprint does xyz...');
        } else if (this.ctx.section === importsName) {
            console.log(`<<<<<<<<<<<<<IMPORTS`);
            // pass
            // this.registerImports();
        } else if (this.ctx.section === inputsName) {
            console.log(`<<<<<<<<<<<<<INPUTS`);
            // this.registerInputs();
        } else if (this.ctx.section === nodeTemplateName) {
            console.log(`<<<<<<<<<<<<<NODE TEMPLATES`);
            // if (this.ctx.cursor.line.match(/^(\s){0,4}(type:){1}/)) {
            //     this.appendCurrentKeywords(nodeTypeKeywords);
            //     this.appendCurrentKeywords(this.importedNodeTypeNames);
            // } else {
            //     if (getParentSection(this.ctx.cursor) !== '') {
            //         this.appendCurrentKeywords(nodeTemplateKeywords);
            //         const nodeTypeName = getNodeType(this.ctx.cursor);
            //         // Get the suggested properties for node type.
            //         for (const nodeTypeObject of this.importedNodeTypeObjects) {
            //             if (nodeTypeObject.type === nodeTypeName) {
            //                 const suggested = nodeTemplates.get(nodeTypeName);
            //                 if (suggested !== undefined) {
            //                     this.appendCurrentKeyword(stringify({'properties': suggested}));
            //                 } else {
            //                     const properties = getPropertiesAsString(nodeTypeObject.properties);
            //                     this.appendCurrentKeyword(properties);
            //                 }
            //             }
            //         }
            //     } else {
            //         this.appendCurrentKeywords(nodeTemplateKeywords);
            //     }
            // }

        }

        if (this.isIntrinsicFunction()) {
            if (lineContainsFn(this.ctx.cursor.line)) {
                if (lineContainsGetInput(this.ctx.cursor.line)) {
                    for (const inputName of Object.keys(this.inputs)) {
                        this.appendCurrentKeyword(inputName);
                    }
                }
                if (lineContainsGetNodeTemplate(this.ctx.cursor.line)) {
                    for (const nodeTemplateName of Object.keys(this.nodeTemplates)) {
                        const argument = `[ ${nodeTemplateName}, INSERT_PROPERTY_NAME ]`;
                        this.appendCurrentKeyword(argument);
                    }
                }
            }
            this.appendCurrentKeywords(intrinsicFunctionKeywords);
        }


    }

}
