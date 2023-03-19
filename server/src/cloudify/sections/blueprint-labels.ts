/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'blueprint_labels';

export class validator {
    name:string;

    constructor(name:string) {
        this.name = name;
    }
}

export const documentation = `Automatically attach labels to a blueprint.
The label's keys should be lowercase.

For more information, see: https://docs.cloudify.co/latest/developer/blueprints/spec-blueprint-labels/`;
