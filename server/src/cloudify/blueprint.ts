/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */


import {getIndentation, JSONItems} from './utils';
import {name as labelsName} from './sections/labels';
import {name as workflowsName} from './sections/workflows';
import {documentCursor, readLines, getParsed} from './parsing';
import {name as descriptionName} from './sections/description';
import {name as relationshipsName} from './sections/relationships';
import {name as nodeTemplatesName} from './sections/node-templates';
import {name as dslDefnitionName} from './sections/dsl-definitions';
import {name as blueprintLabelsName} from './sections/blueprint-labels';
import {
    name as inputsName,
    Validator as InputValidator
} from './sections/inputs';
import {
    name as importsName,
    Validator as ImportsValidator
} from './sections/imports';
import {
    name as nodeTypeName,
    Validator as NodeTypeValidator
} from './sections/node-types';
import {
    name as capabilitiesName,
    alternateName as outputsName
} from './sections/capabilities';
import {
    name as toscaDefinitionsVersionName,
    Validator as CloudifyToscaDefinitionsVersionValidator
} from './sections/tosca-definitions-version';

export const cloudifyTopLevelNames = [
    inputsName,
    labelsName,
    importsName,
    outputsName,
    nodeTypeName,
    workflowsName,
    descriptionName,
    capabilitiesName,
    dslDefnitionName,
    nodeTemplatesName,
    relationshipsName,
    blueprintLabelsName,
    toscaDefinitionsVersionName,
];

export class CloudifyYAML {
    parsed:JSONItems<object|string|[]>;  // The raw parsed YAML data (JSON).
    lines:string[]; // The current lines in the blueprint file.
    dslVersion:string; // The resolved current DSL version. May not be null.
    imports:ImportsValidator|null; // A list of imports.
    inputs:InputValidator|null; // A dictionary of inputs.
    nodeTypes:NodeTypeValidator|null; // A dictionary of node types.
    private _cursor:documentCursor; // Where we are located in the file.
    private _section:string;  // The current section we are editing, e.g. inputs, imports.

    constructor() {
        this.parsed = {};
        this.lines = [];
        this._cursor = new documentCursor(null);
        this._section = '';
        this.dslVersion = ''; // All others may be null, but this must be a string for other fns that use it.
        this.imports = null;
        this.inputs = null;
        this.nodeTypes = null;
    }

    public get cursor() {
        if (this._cursor == null) {
            this._cursor = new documentCursor(null);
        }
        return this._cursor;
    }

    public set cursor(cursor:documentCursor) {
        this._cursor = cursor;
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

    public get section() {
        // We want to reverse from our current line number.
        for (let i = this.cursor.lineNumber - 1; i >= 0; i--) {
            const line = this.cursor.lines[i];
            // If the line isn't 0 indentation or contain any strings,
            // then it's not the start of a new section.
            if ((line === undefined) || (line.length == 0) || (getIndentation(line) != 0)) {
                continue;
            }
            // Let's look at the first key.
            const keys:string[] = line.split(':');
            if (cloudifyTopLevelNames.includes(keys[0])) {
                // If it fits, use it.
                this._section = keys[0];
                break;
            }
        }
        return this._section;
    }

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
