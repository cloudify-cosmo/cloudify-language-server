/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'dsl_definitions';

export class validator {
    name:string;

    constructor(name:string) {
        this.name = name;
    }
}

export const documentation = `A section reserved for defining arbitrary data structures that can then be reused in different parts of the blueprint using YAML anchors and aliases. 

For more information, see: https://docs.cloudify.co/latest/developer/blueprints/spec-dsl-definitions/`;
