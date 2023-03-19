/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'relationships';

export class validator {
    name:string;

    constructor(name:string) {
        this.name = name;
    }
}

export const documentation = `Create dependencies between node templates.
Define operations to be called before and after node resolution.

For more information, see https://docs.cloudify.co/latest/developer/blueprints/spec-relationships/`;
