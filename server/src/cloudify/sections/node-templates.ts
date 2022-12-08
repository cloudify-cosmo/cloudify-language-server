/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { stringify } from 'yaml';
import {nodeTypeProperty} from './node-types';
export const name = 'node_templates';

export const keywords:string[] = [
    'type',
    'properties',
    'relationships',
];

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

export function getPropertiesAsString(properties:Record<string, nodeTypeProperty>) {
    const asDict = {'properties': new Map()};
    for (const key in properties) {
        const [
            cleanedValue,
            typeValue,
            defaultValue,
            requiredValue,
            descriptionValue] = cleanUpNodeTypeProperty(properties[key]);

        console.log('We have the following objects: ');
        console.log(`${key} type is ${typeValue}.`);
        console.log(`${key} default is ${defaultValue}.`);
        console.log(`${key} required is ${requiredValue}.`);
        console.log(`${key} description is ${descriptionValue}.`);

        if (defaultValue !== undefined) {
            asDict['properties'].set(key, defaultValue);
        } else {
            asDict['properties'].set(key, cleanedValue);
        }
    }

    const asString = stringify(asDict);
    return asString;
}

export class validator {
    name:string;

    constructor(name:string) {
        this.name = name;
    }
}
