/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'labels';

export class validator {
    name:string;

    constructor(name:string) {
        this.name = name;
    }
}

export const documentation = `Tag deployments. Label's keys are saved in lowercase.

For more information, see: https://docs.cloudify.co/latest/developer/blueprints/spec-labels/`;
