/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'node_types';
export class validator {
    name:string;
    derivedFrom:string;
    properties:nodeTypeProperties;
    interfaces:nodeTypeInterfaces;
    constructor (name:string, derivedFrom:string, properties:object, interfaces:object) {
        this.name = name;
        this.derivedFrom = derivedFrom;
        this.properties = properties as nodeTypeProperties;
        this.interfaces = interfaces as nodeTypeInterfaces;
    }
}

class nodeTypeProperties {
    [key: string]: object;
}

class nodeTypeInterfaces {
    [key: string]: object;
}
