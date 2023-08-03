/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { stringify } from 'yaml';
import {nodeTypeProperty} from './node-types';
export const name = 'node_templates';
export const documentation = `An infrastructure or application component in a blueprint.
A node template is based on a node type defined in a blueprint or plugin.

For more information, see: https://docs.cloudify.co/latest/developer/blueprints/spec-node-templates/`;

export const keywords:string[] = [
    'type',
    'properties',
    'relationships',
];


export class NodeTemplateItem {
    raw;
    name:string;
    type:string;
    properties:object;

    constructor(raw:null|object) {
        if (raw == null) {
            raw = {};
        }

        this.raw = raw;

        this.name = '';
        this.type = '';
        this.properties = {};
        this.assign();

    }

    assign=()=>{
        const nodeTemplate = Object(this.raw);
        for (const key of Object.keys(this.raw)) {          
            if (key == 'name') {
                this.name = nodeTemplate[key];
            } else if (key == 'type') {
                this.type = nodeTemplate[key];
            } else if (key == 'properties') {
                this.properties = nodeTemplate[key];
            }
        }
    };
}

export interface NodeTemplateItems<T> {
    [key: string]: T;
}


function cleanUpNodeTypeProperty(prop:nodeTypeProperty) {
    let typeValue = undefined;
    let defaultValue = undefined;
    let requiredValue = undefined;
    let descriptionValue = undefined;
    if ('type' in prop) {
        typeValue = prop.type;
        delete prop.type;
    }
    if ('default' in prop) {
        defaultValue = prop.default;
        delete prop.default;
    }
    if ('required' in prop) {
        requiredValue = prop.required;
        delete prop.required;
    } 
    if ('description' in prop) {
        descriptionValue = prop.description;
        delete prop.description;
    }
    return [prop, typeValue, defaultValue, requiredValue, descriptionValue];
}

//eslint-disable-next-line
export function getPropertiesAsString(properties:Record<string, nodeTypeProperty>, asDict:any) {
    for (const key in properties) {
        const [
            cleanedValue,
            //eslint-disable-next-line
            _,
            defaultValue,
            //eslint-disable-next-line
            __,
            //eslint-disable-next-line
            ___] = cleanUpNodeTypeProperty(properties[key]);

        if (defaultValue !== undefined) {
            asDict.set(key, defaultValue);
        } else {
            asDict.set(key, cleanedValue);
        }
    }

    const asString = stringify(asDict);
    return asString;
}

export class Validator {
    raw;
    contents:NodeTemplateItems<NodeTemplateItem>;
    constructor(raw:null|object|string) {
        if (raw == null) {
            raw = {};
        } else if (typeof raw === 'string') {
            raw = {};
        }
        this.raw = raw;
        this.contents = Object();
        this.assign();
    }
    assign=()=>{
        const inputs = Object(this.raw);
        for (const key of Object.keys(this.raw)) {
            this.contents[key] = new NodeTemplateItem(inputs[key]);
        }
    };
}
