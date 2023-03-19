/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'capabilities';
export const alternateName = 'outputs';

export class validator {
    name:string;

    constructor(name:string) {
        this.name = name;
    }
}

export const documentation = `Expose stored or manipulated data from a deployment.

For more information, see https://docs.cloudify.co/latest/developer/blueprints/spec-capabilities/`;
