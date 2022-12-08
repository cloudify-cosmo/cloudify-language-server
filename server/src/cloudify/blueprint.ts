/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {JSONItems} from './utils';
import {cursor, readLines, getParsed} from './parsing';
import {name as toscaDefinitionsVersionName, Validator as CloudifyToscaDefinitionsVersionValidator} from './sections/tosca-definitions-version';
import {name as descriptionName} from './sections/description';
import {name as labelsName} from './sections/labels';
import {name as blueprintLabelsName} from './sections/blueprint-labels';
import {name as importsKeyword, Validator as ImportsValidator} from './sections/imports';
import {name as inputsKeyword, Validator as InputValidator} from './sections/inputs';
import {name as dslDefnitionName} from './sections/dsl-definitions';
import {name as nodeTypeKeyword, Validator as NodeTypeValidator} from './sections/node-types';
import {name as nodeTemplatesName} from './sections/node-templates';
import {name as relationshipsName} from './sections/relationships';
import {name as workflowsName} from './sections/workflows';
import {name as capabilitiesName, alternateName as outputsName} from './sections/capabilities';

export const cloudifyTopLevelKeywords = [
    toscaDefinitionsVersionName,
    descriptionName,
    labelsName,
    blueprintLabelsName,
    importsKeyword,
    inputsKeyword,
    dslDefnitionName,
    nodeTypeKeyword,
    nodeTemplatesName,
    relationshipsName,
    workflowsName,
    outputsName,
    capabilitiesName,
];

export class CloudifyYAML {
    parsed:JSONItems<object|string|[]>;  // The raw parsed YAML data (JSON).
    lines:string[]; // The current lines in the blueprint file.
    cursor:cursor; // Where we are located in the file.
    section:string|null;  // The current section we are editing, e.g. inputs, imports.
    dslVersion:string; // The resolved current DSL version. May not be null.
    imports:ImportsValidator|null; // A list of imports.
    inputs:InputValidator|null; // A dictionary of inputs.
    nodeTypes:NodeTypeValidator|null; // A dictionary of node types.

    constructor() {
        this.parsed = {};
        this.lines = [];
        this.cursor = {
            indentation: 0,
            line: '',
            lines: [],
            lineNumber: 0,
            word: '',
            words: []
        } as cursor;
        this.section = null;
        this.dslVersion = ''; // All others may be null, but this must be a string for other fns that use it.
        this.imports = null;
        this.inputs = null;
        this.nodeTypes = null;
    }

    getSection = (sectionName:string)=>{
        try {
            return this.parsed[sectionName];
        } catch {
            return null;
        }
    };

    getDslVersion=()=>{
        const rawVersion = this.getSection(toscaDefinitionsVersionName);
        if (rawVersion == null) {
            return '';
        } else if (typeof rawVersion === 'object') {
            return '';
        }
        // console.log('Raw version '.concat(rawVersion));
        const _version = new CloudifyToscaDefinitionsVersionValidator(rawVersion);
        return _version.toString();
    };

    getImports=()=>{
        const rawImports = this.getSection('imports');
        // console.log('Raw imports ' + rawImports);
        const _imports = new ImportsValidator(this.dslVersion, rawImports);
        return _imports;
    };

    getInputs=()=>{
        const rawInputs = this.getSection('inputs');
        const _inputs = new InputValidator(rawInputs);
        return _inputs;
    };

    getDataTypes=()=>{
        return [];
    };

    getNodeTypes=()=>{
        const rawNodeTypes = this.getSection('node_types');
        // console.log('Raw node_types: ' + rawNodeTypes);
        const _nodeTypes = new NodeTypeValidator(rawNodeTypes);
        return _nodeTypes;
    };

    refresh=()=>{
        // pass
    };

    getDSLSection=(currentLineNumber:number|null)=>{

        let dslSection = cloudifyTopLevelKeywords[0];

        if (typeof this.section === 'string') {
            dslSection = this.section;
        }

        if (currentLineNumber == null) {
            currentLineNumber = 0;
        }

        const lines:string[] = this.lines;
        for (let lineNumber = 0; lineNumber <= currentLineNumber; lineNumber++) {
            const line = lines[lineNumber];

            if (line === undefined) {
                continue;
            } else if (line.length < 1) {
                continue;
            }

            const firstKey:string[] = line.split(':');
            const candidate = cloudifyTopLevelKeywords.find(element => element == firstKey[0]) as string;

            if (cloudifyTopLevelKeywords.includes(candidate)) {
                dslSection = candidate;
            }

        }
        return dslSection;
    };

    setDSLSection=(currentLineNumber:number)=>{
        const section:string = this.getDSLSection(currentLineNumber);
        if (section !== undefined) {
            this.section = section;
        }
    };

}

export class BlueprintContext extends CloudifyYAML {

    // Blueprint Context stores the current YAML state.
    // It then initializes each of the top level sections, e.g. inputs, imports, node_types.
    // // For each top level section, it checks what we currently have as a value, e.g:
    // // tosca_definitions_version: cloudify_dsl_1_3
    // // the value is "cloudify_dsl_1_3." Values can also be complex, lists, maps, etc.
    // After we know the current values of the sections we can determine if there are
    // other actions to perform. For example:
    // Should we try to import node types from an imported plugin or file?
    // Should we activate or deactivate certain capabilities, based on DSL version?
    // Suggest keywords, based on node instance properties.
    // Suggest instrinsic function arguments, based on existing inputs or node templates.

    uri:string; // The file location of master blueprint file.

    // TODO: Add Data types:
    // dataTypes; // A dictionary of data types.
    // TODO: Add node templates.
    // TODO: Add relationships.
    // TODO: Add capabilities and outputs. (They are basically identical.)
    // TODO: Add DSL Definitions.
    // TODO: Add description.

    constructor(uri:string) {
        super();
        this.uri = uri;
        this.refresh();
    }

    refresh=()=>{
        this.parsed = getParsed(this.uri);
        this.lines = readLines(this.uri);
        this.dslVersion = this.getDslVersion();
        this.imports = this.getImports();
        this.nodeTypes = this.getNodeTypes();
        this.inputs = this.getInputs();
    };

}
