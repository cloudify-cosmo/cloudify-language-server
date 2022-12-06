/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { stringify } from 'yaml';
import {nodeTypeProperty} from './nodeTypes';
export const name = 'node_templates';

export const keywords:string[] = [
    'type',
    'properties',
    'relationships',
];

export function getPropertiesAsString(properties:Record<string, nodeTypeProperty>) {
    const asDict = {'properties': new Map()};
    for (const key in properties) {
        const value = properties[key];

        if (value.default !== undefined) {
            asDict['properties'].set(key, value.default);
        } else if (value.type == 'dict') {
            asDict['properties'].set(key, {});
        } else if (value.type == 'list') {
            asDict['properties'].set(key, []);
        } else if (value.type == 'string') {
            asDict['properties'].set(key, ''); 
        } else if (value.type == 'integer') {
            asDict['properties'].set(key, ''); 
        } else if (value.type == 'boolean') {
            asDict['properties'].set(key, false); 
        } else {
            asDict['properties'].set(key, 'foo'); 
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
