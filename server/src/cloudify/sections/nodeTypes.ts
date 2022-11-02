/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'node_types';
export class Validator {
    name:string;
    derivedFrom:string;
    properties:NodeTypeProperties;
    interfaces:NodeTypeInterfaces;
    constructor (name:string, derivedFrom:string, properties:object, interfaces:object) {
        this.name = name;
        this.derivedFrom = derivedFrom;
        this.properties = properties as NodeTypeProperties;
        this.interfaces = interfaces as NodeTypeInterfaces;
    }
}

class NodeTypeProperties {
    [key: string]: object;
}

class NodeTypeInterfaces {
    [key: string]: object;
}
